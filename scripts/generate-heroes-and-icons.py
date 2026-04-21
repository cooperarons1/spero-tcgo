#!/usr/bin/env python3
"""Generate SDXL art for missing hero portraits + hero power icons.

Outputs:
  client/public/heroes/{CLASS}.png           (full portrait, 768x1024)
  client/public/hero-powers/{CLASS}.png      (square icon, 512x512)

Only generates the portraits that don't already exist on disk. All 9
hero power icons always get regenerated since no PNGs exist yet.

Usage:
    python scripts/generate-heroes-and-icons.py          # all missing
    python scripts/generate-heroes-and-icons.py --icons-only
    python scripts/generate-heroes-and-icons.py --portraits-only
"""
from __future__ import annotations

import argparse
import time
from pathlib import Path

import torch

REPO_ROOT = Path(__file__).resolve().parent.parent
HEROES_DIR = REPO_ROOT / "client" / "public" / "heroes"
ICONS_DIR = REPO_ROOT / "client" / "public" / "hero-powers"

# HS-classic archetype + HS-inspired portrait prompt for each hero.
HERO_PROMPTS = {
    "JIMMY":  ("male hunter, rugged archer, fur cloak and leather armor, "
               "fiery quiver, red-orange warm palette, determined face, "
               "mountain backdrop"),
    "TALA":   ("female priest, flowing green robes, golden halo glow, "
               "wise kind face, vines and leaves, holy warm light, "
               "sacred grove backdrop"),
    "DEREK":  ("male druid, antlers and moss on shoulders, wooden staff, "
               "earth-tone brown and green robes, ancient forest backdrop, "
               "wild beard, serene expression"),
    "ANDERS": ("male warrior, frost-plated armor, ice runes on pauldrons, "
               "steel-blue palette, snow drifting, stern face, icy tundra "
               "backdrop, blunt cold look"),
    "DES":    ("male warlock, dark hooded robes, purple and black flame, "
               "eerie violet glow in eyes, shadow tendrils, twisted spire "
               "backdrop, menacing presence"),
    "ASTRID": ("female rogue, dark leather armor, hooded cloak, twin "
               "daggers sheathed at hips, indigo and silver palette, "
               "moonlit alley backdrop, sly half-smile"),
    "AVA":    ("female paladin, shining silver and gold plate armor, "
               "holy light halo, sword and shield, stained-glass cathedral "
               "backdrop, noble determined face"),
    "LUCAS":  ("male shaman, storm-beaded robes, feathers and totems, "
               "crackling lightning at his fingers, teal and gold palette, "
               "windswept plateau backdrop"),
    "IZZY":   ("female mage, flowing arcane robes, glowing runes on sleeves, "
               "spellbook hovering, blue-purple arcane palette, "
               "starlit observatory backdrop, curious clever face"),
}

# Hearthstone-style round medallion icons — custom power names for the
# new class archetypes (Scout / Catalyst / Operator / Guardian / Striker /
# Sentinel / Conduit / Dominion / Architect).
POWER_PROMPTS = {
    "JIMMY":  ("Precision Shot: a fiery arrowhead aimed forward, sparks "
               "trailing, red-orange palette, Scout archetype"),
    "IZZY":   ("Catalyze: a crackling arcane spark igniting into a small "
               "fireball, blue-purple arcane palette, Catalyst archetype"),
    "ASTRID": ("Concealed Blade: a sheathed dagger revealing its edge in "
               "moonlight, indigo and silver palette, Operator archetype"),
    "TALA":   ("Safeguard: a glowing golden cross of light surrounded by "
               "a soft halo, holy warm-gold palette, Guardian archetype"),
    "ANDERS": ("Brace: a stylized steel-plated pauldron angled forward "
               "with frost runes, steel-blue palette, Striker archetype"),
    "AVA":    ("Deploy Sentinel: a shining silver helm over a golden "
               "banner, bright holy palette, Sentinel archetype"),
    "LUCAS":  ("Invoke Orb: four glowing elemental orbs (fire, water, "
               "air, healing green) in a spiral, teal-gold palette, "
               "Conduit archetype"),
    "DES":    ("Blood Pact: a purple-black open hand dripping shadow "
               "blood, eerie violet palette, Dominion archetype"),
    "DEREK":  ("Reforge: a silhouette morphing from humanoid into bear "
               "with blueprint schematic lines overlayed, moss-green and "
               "earth-brown palette, Architect archetype"),
}

BASE_POWER = (
    "Hearthstone hero power medallion icon, centered, round composition, "
    "dark circular border, single clear symbol, painterly fantasy art, "
    "no text, no frame, high contrast"
)
BASE_HERO = (
    "Hearthstone hero portrait, painterly fantasy illustration, "
    "dramatic lighting, chest-up shot, vivid colors, no text, no frame"
)

NEGATIVE = (
    "blurry, low quality, deformed, text, watermark, logo, signature, "
    "cartoon, anime, photograph, realistic, UI elements, border, frame, "
    "multiple characters"
)


def run(pipe, prompt: str, out: Path, width: int, height: int, steps: int, seed: int):
    gen = torch.Generator("mps").manual_seed(seed)
    img = pipe(
        prompt,
        negative_prompt=NEGATIVE,
        num_inference_steps=steps,
        guidance_scale=7.5,
        height=height,
        width=width,
        generator=gen,
    ).images[0]
    img.save(str(out))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--icons-only", action="store_true")
    ap.add_argument("--portraits-only", action="store_true")
    ap.add_argument("--steps", type=int, default=30)
    args = ap.parse_args()

    HEROES_DIR.mkdir(parents=True, exist_ok=True)
    ICONS_DIR.mkdir(parents=True, exist_ok=True)

    todo: list[tuple[str, str, Path, int, int]] = []  # (kind, cls, out, w, h)

    if not args.icons_only:
        for cls, flavor in HERO_PROMPTS.items():
            out = HEROES_DIR / f"{cls}.png"
            if out.exists():
                continue
            todo.append(("portrait", cls, out, 768, 1024))

    if not args.portraits_only:
        for cls, _flavor in POWER_PROMPTS.items():
            out = ICONS_DIR / f"{cls}.png"
            if out.exists():
                continue
            todo.append(("icon", cls, out, 512, 512))

    print(f"[hero] {len(todo)} image(s) to generate", flush=True)
    if not todo:
        return

    print("[hero] loading SDXL...", flush=True)
    from diffusers import StableDiffusionXLPipeline

    pipe = StableDiffusionXLPipeline.from_pretrained(
        "stabilityai/stable-diffusion-xl-base-1.0",
        torch_dtype=torch.float16,
        variant="fp16",
        use_safetensors=True,
    ).to("mps")
    pipe.set_progress_bar_config(disable=True)

    start = time.time()
    for i, (kind, cls, out, w, h) in enumerate(todo, 1):
        flavor = HERO_PROMPTS[cls] if kind == "portrait" else POWER_PROMPTS[cls]
        base = BASE_HERO if kind == "portrait" else BASE_POWER
        prompt = f"{flavor}. {base}"
        seed = abs(hash(f"{kind}-{cls}")) % (2**31)
        t0 = time.time()
        run(pipe, prompt, out, w, h, args.steps, seed)
        elapsed = time.time() - t0
        total = time.time() - start
        print(f"[hero] {i}/{len(todo)} {kind}/{cls} "
              f"({elapsed:.1f}s; total {total:.0f}s)", flush=True)

    print(f"[hero] done. wall time {time.time() - start:.0f}s", flush=True)


if __name__ == "__main__":
    main()
