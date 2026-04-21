#!/usr/bin/env python3
"""VLM audit: score every card PNG for match + NSFW + copyright.

For each card in data/cards.json with a PNG in client/public/cards/,
ask Gemma-4-26B-A4B three yes/no questions. Results land in
/tmp/art-audit.jsonl, one JSON object per card, plus a summary at the
end listing cards flagged in any category.

Usage:
    python scripts/vlm-art-audit.py                 # all cards
    python scripts/vlm-art-audit.py --limit 20      # sample run
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
CARDS_JSON = REPO_ROOT / "data" / "cards.json"
PNG_DIR = REPO_ROOT / "client" / "public" / "cards"
OUT = Path("/tmp/art-audit.jsonl")

MODEL = "mlx-community/gemma-3-27b-it-4bit"  # Gemma-3 VLM available on MPS

PROMPT_TMPL = (
    "You are auditing a trading card game art. The card is:\n"
    "  NAME:  {name}\n"
    "  TYPE:  {type}{tribe}\n"
    "  TEXT:  {text}\n\n"
    "Answer each question with YES or NO on its own line, then a short "
    "reason.\n\n"
    "Q1: Does the image visually match the card name and effect? "
    "(e.g. 'Frost Shock' should show frost/ice, not a crab)\n"
    "Q2: Is the image NSFW or contain nudity or vulgar content?\n"
    "Q3: Does the image resemble any copyrighted or trademarked "
    "character (e.g. Despicable Me Minions, Pokemon, Disney, Marvel)?\n\n"
    "Format:\n"
    "Q1: YES|NO — reason\n"
    "Q2: YES|NO — reason\n"
    "Q3: YES|NO — reason"
)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--codes", type=str, default=None)
    args = ap.parse_args()

    cards = json.loads(CARDS_JSON.read_text())
    pngs = {p.stem for p in PNG_DIR.glob("*.png") if p.stem != "card-back"}

    if args.codes:
        want = set(args.codes.split(","))
        todo = [c for c in cards if c["cardCode"] in want]
    else:
        todo = [c for c in cards if c["cardCode"] in pngs]
    if args.limit:
        todo = todo[: args.limit]

    print(f"[vlm] loading {MODEL}...", flush=True)
    from mlx_vlm import load, generate
    from mlx_vlm.prompt_utils import apply_chat_template

    model, processor = load(MODEL)
    config = model.config

    flagged = []
    OUT.write_text("")  # clear
    start = time.time()

    for i, card in enumerate(todo, 1):
        code = card["cardCode"]
        img = str(PNG_DIR / f"{code}.png")
        if not Path(img).exists():
            continue

        tribe = f" ({card.get('minionType')})" if card.get("minionType") else ""
        prompt = PROMPT_TMPL.format(
            name=card.get("name", ""),
            type=card.get("type", ""),
            tribe=tribe,
            text=card.get("text", "") or "(no text)",
        )
        chat_prompt = apply_chat_template(processor, config, prompt, num_images=1)

        t0 = time.time()
        try:
            reply = generate(
                model, processor, chat_prompt, image=[img],
                verbose=False, max_tokens=200, temperature=0.2,
            )
            # mlx-vlm returns a GenerationResult; extract text
            resp = getattr(reply, "text", str(reply))
        except Exception as e:
            resp = f"ERROR: {e}"

        # Parse Q1/Q2/Q3
        def q(n: int) -> tuple[str, str]:
            m = re.search(rf"Q{n}:\s*(YES|NO)\s*[—-]*\s*(.*?)(?=\nQ\d:|\Z)",
                          resp, re.IGNORECASE | re.DOTALL)
            if not m: return ("?", "")
            return (m.group(1).upper(), m.group(2).strip()[:120])

        q1 = q(1); q2 = q(2); q3 = q(3)
        match_ok = q1[0] == "YES"
        nsfw = q2[0] == "YES"
        copyright = q3[0] == "YES"

        entry = {
            "cardCode": code,
            "name": card.get("name"),
            "match": match_ok, "match_reason": q1[1],
            "nsfw":  nsfw,      "nsfw_reason":  q2[1],
            "copyright": copyright, "copyright_reason": q3[1],
        }
        with OUT.open("a") as f:
            f.write(json.dumps(entry) + "\n")

        if not match_ok or nsfw or copyright:
            flagged.append(entry)
            tag = "✗" if (not match_ok or nsfw or copyright) else "✓"
            print(f"[vlm] {i}/{len(todo)} {tag} {code} ({card.get('name')!r}) "
                  f"match={q1[0]} nsfw={q2[0]} copy={q3[0]} "
                  f"[{time.time()-t0:.1f}s]", flush=True)
        else:
            if i % 10 == 0:
                print(f"[vlm] {i}/{len(todo)} ok ({time.time()-start:.0f}s)",
                      flush=True)

    print(f"\n=== VLM audit: {len(flagged)}/{len(todo)} flagged "
          f"in {time.time()-start:.0f}s ===")
    for f in flagged:
        tags = []
        if not f["match"]: tags.append("MISMATCH")
        if f["nsfw"]: tags.append("NSFW")
        if f["copyright"]: tags.append("COPYRIGHT")
        print(f"  {f['cardCode']:<18} {f['name']:<30} [{'/'.join(tags)}]")
        if not f["match"]:     print(f"    mismatch: {f['match_reason']}")
        if f["nsfw"]:          print(f"    nsfw:     {f['nsfw_reason']}")
        if f["copyright"]:     print(f"    copyright:{f['copyright_reason']}")

    print(f"\nFull audit → {OUT}")


if __name__ == "__main__":
    main()
