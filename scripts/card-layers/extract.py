#!/usr/bin/env python3
"""
Per-card foreground/background layer extractor.

For each card PNG, produce two PNGs:
  {cardCode}-fg.png — subject on transparent background (rembg U^2-Net cutout)
  {cardCode}-bg.png — subject painted over with a Gaussian-blurred fill

The client then layers these as:
  [ background, subject (breathes), atmosphere overlay ]
giving a Pokemon-TCG-Pocket-style parallax illusion without SVD.

Usage:
  python scripts/card-layers/extract.py --cards DRK032 JIM022 AST021
  python scripts/card-layers/extract.py --all
  python scripts/card-layers/extract.py --all --force  # overwrite existing

Input:  client/public/cards/{cardCode}.png
Output: client/public/cards/layers/{cardCode}-fg.png
        client/public/cards/layers/{cardCode}-bg.png
"""
from __future__ import annotations

import argparse
import io
import sys
import time
from pathlib import Path

from PIL import Image, ImageFilter
from rembg import new_session, remove

ROOT = Path(__file__).resolve().parents[2]
SRC_DIR = ROOT / "client" / "public" / "cards"
DST_DIR = SRC_DIR / "layers"


def extract_one(session, card_code: str, force: bool = False) -> tuple[bool, str]:
    src = SRC_DIR / f"{card_code}.png"
    if not src.exists():
        return False, "missing source"

    fg_path = DST_DIR / f"{card_code}-fg.png"
    bg_path = DST_DIR / f"{card_code}-bg.png"
    if not force and fg_path.exists() and bg_path.exists():
        return True, "cached"

    # rembg returns RGBA cutout
    with src.open("rb") as f:
        input_bytes = f.read()
    cutout_bytes = remove(input_bytes, session=session)
    fg = Image.open(io.BytesIO(cutout_bytes)).convert("RGBA")
    fg.save(fg_path, "PNG", optimize=True)

    # Background: composite the original over a Gaussian-blurred inpaint of
    # itself, then mask out the subject region and feather-fill from the
    # surround. Simple cheat: take the original, blur heavily, and over-
    # paint the subject area with the blurred version so the subject
    # outline disappears.
    orig = Image.open(src).convert("RGBA")
    if orig.size != fg.size:
        orig = orig.resize(fg.size, Image.LANCZOS)

    # Alpha channel of fg = subject mask
    subject_mask = fg.split()[-1]
    # Expand the mask a little so we inpaint a few pixels past the subject
    # edge — otherwise rembg's soft edge leaves a ghost outline in bg.
    expanded_mask = subject_mask.filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.GaussianBlur(3))

    # Heavily blurred version of the original — this is our "plate"
    blurred = orig.filter(ImageFilter.GaussianBlur(24))

    # Paste blurred over original using the subject mask, so subject
    # region gets the blurred plate and non-subject stays crisp.
    bg = orig.copy()
    bg.paste(blurred, (0, 0), expanded_mask)
    bg.save(bg_path, "PNG", optimize=True)

    return True, "ok"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cards", nargs="*", help="specific card codes to extract")
    ap.add_argument("--all", action="store_true", help="extract every PNG in cards/")
    ap.add_argument("--force", action="store_true", help="overwrite cached layers")
    args = ap.parse_args()

    if not args.all and not args.cards:
        ap.error("pass --cards CODE1 CODE2 or --all")

    DST_DIR.mkdir(parents=True, exist_ok=True)

    if args.all:
        codes = sorted(p.stem for p in SRC_DIR.glob("*.png"))
    else:
        codes = args.cards

    # isnet-general-use handles painted / atmospheric art better than
    # u2netp (which retained clouds of smoke around the subject in early
    # tests). Still fast enough (~0.5s / card on M5 CPU).
    session = new_session("isnet-general-use")

    t0 = time.time()
    ok = 0
    skipped = 0
    failed: list[str] = []
    for i, code in enumerate(codes, 1):
        ts = time.time()
        success, note = extract_one(session, code, force=args.force)
        if not success:
            failed.append(f"{code}: {note}")
            print(f"[{i}/{len(codes)}] {code} — FAIL ({note})")
            continue
        if note == "cached":
            skipped += 1
            print(f"[{i}/{len(codes)}] {code} — cached")
        else:
            ok += 1
            print(f"[{i}/{len(codes)}] {code} — {time.time() - ts:.1f}s")

    total = time.time() - t0
    print()
    print(f"Done: {ok} extracted, {skipped} cached, {len(failed)} failed — {total:.1f}s total")
    for f in failed:
        print(f"  FAIL {f}")

    write_manifest()
    return 0 if not failed else 1


def write_manifest() -> None:
    """Rewrite client/src/utils/cardArtLayers.ts as a Set of card codes
    for which both fg and bg files exist. The CardArt component reads
    this to decide whether to render the 3-layer parallax stack."""
    codes = sorted({
        p.stem.removesuffix("-fg")
        for p in DST_DIR.glob("*-fg.png")
        if (DST_DIR / f"{p.stem.removesuffix('-fg')}-bg.png").exists()
    })
    out = ROOT / "client" / "src" / "utils" / "cardArtLayers.ts"
    body = "export const CARD_LAYER_CODES: ReadonlySet<string> = new Set([\n"
    for code in codes:
        body += f"  '{code}',\n"
    body += "]);\n\nexport function hasLayers(cardCode: string): boolean {\n"
    body += "  return CARD_LAYER_CODES.has(cardCode);\n}\n"
    out.write_text(body)
    print(f"Manifest written: {out} ({len(codes)} cards)")


if __name__ == "__main__":
    sys.exit(main())
