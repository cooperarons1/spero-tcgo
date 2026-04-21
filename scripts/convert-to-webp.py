#!/usr/bin/env python3
"""Batch-convert PNG card/hero/icon assets to WebP.

PNGs at 768x1024 × 337 cards = 185MB total — the primary cause of
in-game lag on hero-power and card-art load. WebP at quality=85 reduces
each asset 3-5× with no perceptible quality loss. After conversion,
update client/src/utils/cardArtPngs.ts + cardArt.tsx + component PNG
paths to .webp.

Usage:
    python scripts/convert-to-webp.py                    # all dirs
    python scripts/convert-to-webp.py --dir cards        # cards only
    python scripts/convert-to-webp.py --quality 80
"""
from __future__ import annotations

import argparse
import time
from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parent.parent
PUBLIC = REPO / "client" / "public"

DIRS = ["cards", "heroes", "hero-powers"]


def convert(path: Path, quality: int) -> tuple[int, int]:
    """Convert one PNG to WebP alongside it. Returns (png_bytes, webp_bytes)."""
    out = path.with_suffix(".webp")
    png_sz = path.stat().st_size
    img = Image.open(path)
    # method=6 is slowest encode / best compression
    img.save(out, format="WEBP", quality=quality, method=6)
    webp_sz = out.stat().st_size
    return png_sz, webp_sz


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", type=str, default=None, help="only this subdir under client/public/")
    ap.add_argument("--quality", type=int, default=85)
    args = ap.parse_args()

    dirs = [args.dir] if args.dir else DIRS
    start = time.time()
    total_png = 0
    total_webp = 0
    n = 0

    for d in dirs:
        root = PUBLIC / d
        if not root.exists():
            print(f"[skip] {root} does not exist")
            continue
        for png in sorted(root.glob("*.png")):
            png_sz, webp_sz = convert(png, args.quality)
            total_png += png_sz
            total_webp += webp_sz
            n += 1
            if n % 25 == 0:
                print(f"  [{n}] {png.name}: "
                      f"{png_sz/1024:.0f}KB → {webp_sz/1024:.0f}KB "
                      f"({100*webp_sz/png_sz:.0f}%)")

    elapsed = time.time() - start
    ratio = 100 * total_webp / max(1, total_png)
    print(f"\nConverted {n} files in {elapsed:.1f}s")
    print(f"PNG total:   {total_png/1048576:.1f} MB")
    print(f"WebP total:  {total_webp/1048576:.1f} MB  ({ratio:.0f}% of original)")
    print(f"Savings:     {(total_png-total_webp)/1048576:.1f} MB")


if __name__ == "__main__":
    main()
