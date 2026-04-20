#!/usr/bin/env python3
"""
Extract art embeddings for every card PNG using a small torchvision CNN.

Why v2 needs this:
  v1's training collapsed to val loss 0.083 (the dataset mean of random
  labels) because the 62-dim feature vector (card type, rarity, keywords,
  context, cost/atk/hp) didn't distinguish cards within the same
  class/type combo — so the model saw many different "good" target
  params for identical feature vectors and averaged them.

  The art is the missing signal. Two minions with the same keywords
  and cost can have wildly different visual rhythms (a hulking taunt
  mech vs a nimble stealth elf both read as DEREK+MINION+TAUNT etc.).
  A CNN embedding of the PNG captures the art "mood" so the model can
  learn per-card rhythm instead of per-bin means.

Output: data/animation-art-embeddings.json — { cardCode: [128 floats] }
Uses ResNet18 pre-classifier (512-dim) compressed to 128 via linear
random-projection (fixed seed) — keeps embedding file small.
"""
from __future__ import annotations

import argparse
import io
import json
import sys
import time
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torchvision.models as models
from PIL import Image
from torchvision import transforms

ROOT = Path(__file__).resolve().parents[2]
CARDS_DIR = ROOT / "client" / "public" / "cards"
OUTPUT_PATH = ROOT / "data" / "animation-art-embeddings.json"
PROJECTION_SEED = 0xC0FFEE
RAW_DIM = 512
PROJECTED_DIM = 128


def build_projection(rng: np.random.Generator) -> np.ndarray:
    # Random orthonormal projection — preserves pairwise distances.
    A = rng.standard_normal((PROJECTED_DIM, RAW_DIM)).astype(np.float32) / np.sqrt(RAW_DIM)
    return A


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--device", default="mps")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    if OUTPUT_PATH.exists() and not args.force:
        cached = json.loads(OUTPUT_PATH.read_text())
        print(f"Cached {len(cached)} embeddings at {OUTPUT_PATH}. Use --force to regen.")
        return 0

    device = torch.device(args.device if torch.backends.mps.is_available() and args.device == "mps" else "cpu")
    print(f"Device: {device}")

    net = models.resnet18(weights=models.ResNet18_Weights.IMAGENET1K_V1)
    net.fc = nn.Identity()  # strip classifier head, keep 512-dim pre-pool
    net = net.to(device).eval()

    preprocess = transforms.Compose([
        transforms.Resize(256),
        transforms.CenterCrop(224),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])

    proj = build_projection(np.random.default_rng(PROJECTION_SEED))

    pngs = sorted(CARDS_DIR.glob("*.png"))
    print(f"Embedding {len(pngs)} PNGs...")

    out: dict[str, list[float]] = {}
    t0 = time.time()
    with torch.no_grad():
        for i, p in enumerate(pngs, 1):
            img = Image.open(p).convert("RGB")
            x = preprocess(img).unsqueeze(0).to(device)
            y = net(x).cpu().numpy().reshape(-1)
            if y.shape[0] != RAW_DIM:
                print(f"Unexpected dim {y.shape[0]} for {p.stem}", file=sys.stderr)
                continue
            z = (proj @ y).astype(float).tolist()
            out[p.stem] = z
            if i % 20 == 0:
                print(f"  {i}/{len(pngs)} — {time.time() - t0:.1f}s")

    OUTPUT_PATH.write_text(json.dumps(out))
    print(f"Wrote {len(out)} embeddings to {OUTPUT_PATH} ({OUTPUT_PATH.stat().st_size / 1024:.0f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
