#!/usr/bin/env python3
"""Batch-generate SDXL art for every Spero card missing a PNG.

Reads data/cards.json, filters to cards without an existing PNG in
client/public/cards/, composes a flavor-aware prompt from name + text +
hero class, runs SDXL on MPS, saves at 768x1024 to match the card art
aspect ratio used by CardArt.tsx.

Skip gracefully if the PNG appears mid-run (idempotent — safe to kill + resume).

Usage:
    python scripts/batch-generate-art.py          # all missing
    python scripts/batch-generate-art.py --limit 10
    python scripts/batch-generate-art.py --codes LUC045,DRK072

Paths are resolved relative to repo root so the script runs from anywhere.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import torch

REPO_ROOT = Path(__file__).resolve().parent.parent
CARDS_JSON = REPO_ROOT / "data" / "cards.json"
PNG_DIR = REPO_ROOT / "client" / "public" / "cards"

CLASS_STYLE = {
    "JIMMY": "fiery archer, forge embers, red-orange palette",
    "TALA": "verdant healer, priestly glow, holy warm-gold palette",
    "DEREK": "druid of the wild, deep forest, mossy green palette",
    "ANDERS": "ice warrior, frost armor, steel-blue palette",
    "DES": "shadow warlock, dark purples, eerie violet palette",
    "ASTRID": "stealthy rogue, moonlit night, indigo and silver palette",
    "AVA": "paladin of light, silver and gold, holy cathedral light",
    "LUCAS": "storm shaman, elemental lightning, teal and gold palette",
    "IZZY": "arcane mage, spellbound sparks, blue-purple arcane palette",
    "NEUTRAL": "fantasy style, balanced palette",
}

TYPE_STYLE = {
    "MINION":   "character portrait, full body, detailed fantasy character",
    "SPELL":    "magical spell effect, glowing energy, dynamic action scene",
    "WEAPON":   "ornate weapon rendered in 3/4 view, detailed blade or staff",
    "LOCATION": "fantasy landscape scene, atmospheric environment",
}

NEGATIVE = (
    "blurry, low quality, deformed, text, watermark, logo, signature, "
    "cartoon, anime, childish, photograph, realistic, UI elements, "
    "hearthstone logo, border, frame, card template"
)

BASE_PROMPT = (
    "Hearthstone trading card game art, dynamic fantasy illustration, "
    "painterly digital art, dramatic lighting, vivid colors, centered "
    "composition, no text, no border, no frame"
)


def build_prompt(card: dict) -> str:
    name = card.get("name", "")
    text = card.get("text", "") or ""
    hero = card.get("heroClass", "NEUTRAL")
    ctype = card.get("type", "MINION")
    class_style = CLASS_STYLE.get(hero, CLASS_STYLE["NEUTRAL"])
    type_style = TYPE_STYLE.get(ctype, TYPE_STYLE["MINION"])
    # Limit text so the prompt doesn't run away
    short_text = text[:140]
    return (
        f"{name}: {short_text}. {type_style}. {class_style}. {BASE_PROMPT}"
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--codes", type=str, default=None,
                    help="Comma-separated cardCodes to generate (override filter).")
    ap.add_argument("--steps", type=int, default=30)
    ap.add_argument("--width", type=int, default=768)
    ap.add_argument("--height", type=int, default=1024)
    args = ap.parse_args()

    cards = json.loads(CARDS_JSON.read_text())
    if args.codes:
        target = set(args.codes.split(","))
        todo = [c for c in cards if c["cardCode"] in target]
    else:
        existing = {p.stem for p in PNG_DIR.glob("*.png")}
        todo = [
            c for c in cards
            if c["cardCode"] not in existing
            and "TOKEN" not in c["cardCode"]
            and "ORB" not in c["cardCode"]
            and c["cardCode"] != "COIN"
        ]
    if args.limit:
        todo = todo[: args.limit]

    print(f"[batch] {len(todo)} card(s) to generate", flush=True)
    if not todo:
        return

    print("[batch] loading SDXL...", flush=True)
    from diffusers import StableDiffusionXLPipeline

    pipe = StableDiffusionXLPipeline.from_pretrained(
        "stabilityai/stable-diffusion-xl-base-1.0",
        torch_dtype=torch.float16,
        variant="fp16",
        use_safetensors=True,
    ).to("mps")
    pipe.set_progress_bar_config(disable=True)

    start = time.time()
    for i, card in enumerate(todo, 1):
        code = card["cardCode"]
        out = PNG_DIR / f"{code}.png"
        if out.exists():
            print(f"[batch] skip {code} (exists)", flush=True)
            continue
        prompt = build_prompt(card)
        t0 = time.time()
        # Deterministic seed per card so re-runs match.
        seed = abs(hash(code)) % (2**31)
        generator = torch.Generator("mps").manual_seed(seed)
        img = pipe(
            prompt,
            negative_prompt=NEGATIVE,
            num_inference_steps=args.steps,
            guidance_scale=7.5,
            height=args.height,
            width=args.width,
            generator=generator,
        ).images[0]
        img.save(str(out))
        elapsed = time.time() - t0
        total = time.time() - start
        print(f"[batch] {i}/{len(todo)} {code} ({card['name']!r}) "
              f"{elapsed:.1f}s; total {total:.0f}s", flush=True)

    print(f"[batch] done. wall time {time.time() - start:.0f}s", flush=True)


if __name__ == "__main__":
    main()
