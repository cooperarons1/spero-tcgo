#!/usr/bin/env python3
"""
Rank-learning v2 — augments features with ResNet18 art embeddings so the
model can distinguish cards with identical metadata (same class/keywords/
cost/atk/hp) by their actual art.

v1 rank-loss stalled near val loss 0.083 because many samples shared
identical 62-dim feature vectors (every DEREK+MINION+TAUNT+5mana card
looks the same to the model, but the VLM gave different scores based
on what the art actually depicts). Adding the art embedding gives the
model a signal to tell those cards apart.

Usage:
    python scripts/animation-model/embed_art.py          # one-time
    python scripts/animation-model/train_rank_v2.py       # trains v2

Outputs data/animation-weights-v2.json, loaded by server/animation-model.ts.
"""

from __future__ import annotations

import argparse
import json
import random
import sys
import time
from collections import defaultdict
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn

from schema import ANIM_PARAM_DIM, CARD_FEATURE_DIM, PARAM_NAMES
from train import AnimationMLP
from train_rank import rank_loss, export_weights

ART_EMBED_DIM = 128
CARD_FEATURE_DIM_V2 = CARD_FEATURE_DIM + ART_EMBED_DIM  # 62 + 128 = 190

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
DEFAULT_DATA = DATA_DIR / "animation-training.jsonl"
DEFAULT_EMBEDS = DATA_DIR / "animation-art-embeddings.json"
DEFAULT_OUTPUT = DATA_DIR / "animation-weights-v2.json"


def load_pairs(
    data_path: Path,
    embed_path: Path,
    min_score_gap: float = 10.0,
    pairs_per_bin: int = 50,
    seed: int = 42,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    embeds: dict[str, list[float]] = json.loads(embed_path.read_text())
    print(f"  Loaded {len(embeds)} art embeddings")

    rng = random.Random(seed)
    bins: dict[tuple[str, str], list[dict]] = defaultdict(list)

    dropped_no_embed = 0
    with open(data_path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                r = json.loads(line)
            except json.JSONDecodeError:
                continue
            if len(r.get("features", [])) != CARD_FEATURE_DIM:
                continue
            if len(r.get("params_normalized", [])) != ANIM_PARAM_DIM:
                continue
            code = r.get("card_code", "")
            if code not in embeds:
                dropped_no_embed += 1
                continue
            # Extend features with art embedding
            r["features_v2"] = list(r["features"]) + list(embeds[code])
            key = (code, r.get("anim_context", ""))
            bins[key].append(r)

    print(f"  Bins: {len(bins)}, samples: {sum(len(v) for v in bins.values())}, dropped_no_embed: {dropped_no_embed}")
    multi_bins = [b for b in bins.values() if len(b) >= 2]
    print(f"  Bins with >=2 samples: {len(multi_bins)}")

    X_pair: list[list[float]] = []
    Y_pos: list[list[float]] = []
    Y_neg: list[list[float]] = []
    gaps: list[float] = []

    for samples in multi_bins:
        samples = sorted(samples, key=lambda s: s["total_score"], reverse=True)
        pairs = []
        for i in range(len(samples)):
            for j in range(i + 1, len(samples)):
                gap = samples[i]["total_score"] - samples[j]["total_score"]
                if gap < min_score_gap:
                    continue
                pairs.append((samples[i], samples[j], gap))
        if len(pairs) > pairs_per_bin:
            pairs = rng.sample(pairs, pairs_per_bin)
        for pos, neg, gap in pairs:
            X_pair.append(pos["features_v2"])
            Y_pos.append(pos["params_normalized"])
            Y_neg.append(neg["params_normalized"])
            gaps.append(gap)

    print(f"  Total pairs: {len(X_pair)}")
    return (
        np.array(X_pair, dtype=np.float32),
        np.array(Y_pos, dtype=np.float32),
        np.array(Y_neg, dtype=np.float32),
        np.array(gaps, dtype=np.float32),
    )


def train(
    X: np.ndarray,
    Y_pos: np.ndarray,
    Y_neg: np.ndarray,
    gaps: np.ndarray,
    epochs: int = 120,
    batch_size: int = 256,
    lr: float = 1e-3,
    val_split: float = 0.1,
    margin: float = 0.05,
) -> AnimationMLP:
    device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
    print(f"  Device: {device}")

    n = len(X)
    n_val = max(1, int(n * val_split))
    n_train = n - n_val
    perm = np.random.permutation(n)

    X_train = torch.from_numpy(X[perm[:n_train]]).to(device)
    Yp_train = torch.from_numpy(Y_pos[perm[:n_train]]).to(device)
    Yn_train = torch.from_numpy(Y_neg[perm[:n_train]]).to(device)
    W_train = torch.from_numpy(
        np.clip(gaps[perm[:n_train]] / 50.0, 0.1, 3.0)
    ).to(device)

    X_val = torch.from_numpy(X[perm[n_train:]]).to(device)
    Yp_val = torch.from_numpy(Y_pos[perm[n_train:]]).to(device)
    Yn_val = torch.from_numpy(Y_neg[perm[n_train:]]).to(device)

    # Deeper MLP — 190 input dim warrants a larger hidden layer.
    model = AnimationMLP(CARD_FEATURE_DIM_V2, ANIM_PARAM_DIM, [384, 192, 96]).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=1e-5)
    scheduler = torch.optim.lr_scheduler.OneCycleLR(
        optimizer, max_lr=lr, total_steps=epochs,
    )

    total_params = sum(p.numel() for p in model.parameters())
    print(f"  Model params: {total_params:,}")
    print(f"  Pairs: train={n_train}, val={n_val}, margin={margin}")
    print()

    best_val_loss = float("inf")
    best_state = None
    patience = 20
    no_improve = 0

    for epoch in range(epochs):
        model.train()
        perm_train = torch.randperm(n_train, device=device)
        epoch_loss = 0.0
        num_batches = 0

        for i in range(0, n_train, batch_size):
            idx = perm_train[i : i + batch_size]
            xb = X_train[idx]
            yb_pos = Yp_train[idx]
            yb_neg = Yn_train[idx]
            wb = W_train[idx]

            pred = model(xb)
            d_pos = torch.sqrt(((pred - yb_pos) ** 2).mean(dim=1) + 1e-8)
            d_neg = torch.sqrt(((pred - yb_neg) ** 2).mean(dim=1) + 1e-8)
            per = torch.clamp(margin + d_pos - d_neg, min=0.0)
            loss = (per * wb).mean()

            optimizer.zero_grad()
            loss.backward()
            optimizer.step()

            epoch_loss += loss.item()
            num_batches += 1

        scheduler.step()
        avg_train = epoch_loss / max(1, num_batches)

        model.eval()
        with torch.no_grad():
            vp = model(X_val)
            val_loss = rank_loss(vp, Yp_val, Yn_val, margin=margin).item()

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_state = {k: v.cpu().clone() for k, v in model.state_dict().items()}
            no_improve = 0
        else:
            no_improve += 1

        if (epoch + 1) % 10 == 0 or epoch == 0 or no_improve == 0:
            marker = " *" if no_improve == 0 else ""
            print(
                f"  Epoch {epoch+1:3d}/{epochs}  "
                f"train={avg_train:.6f}  val={val_loss:.6f}  "
                f"lr={scheduler.get_last_lr()[0]:.2e}{marker}"
            )

        if no_improve >= patience:
            print(f"  Early stopping at epoch {epoch+1} (no improvement for {patience} epochs)")
            break

    if best_state:
        model.load_state_dict(best_state)
        model.to(device)
    print(f"\n  Best val rank-loss: {best_val_loss:.6f}")

    return model


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", type=Path, default=DEFAULT_DATA)
    ap.add_argument("--embeds", type=Path, default=DEFAULT_EMBEDS)
    ap.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    ap.add_argument("--min-score-gap", type=float, default=10.0)
    ap.add_argument("--pairs-per-bin", type=int, default=50)
    ap.add_argument("--epochs", type=int, default=120)
    ap.add_argument("--margin", type=float, default=0.05)
    args = ap.parse_args()

    if not args.embeds.exists():
        print(f"Embeddings missing at {args.embeds}. Run embed_art.py first.", file=sys.stderr)
        return 1

    print(f"Loading pairs from {args.data}...")
    X, Y_pos, Y_neg, gaps = load_pairs(
        args.data, args.embeds,
        min_score_gap=args.min_score_gap,
        pairs_per_bin=args.pairs_per_bin,
    )

    if len(X) == 0:
        print("No training pairs — aborting.", file=sys.stderr)
        return 1

    print("\nTraining v2...")
    t0 = time.time()
    model = train(X, Y_pos, Y_neg, gaps, epochs=args.epochs, margin=args.margin)
    print(f"\nTraining took {time.time() - t0:.1f}s")

    export_weights(model, args.output, num_pairs=len(X))
    print(f"Weights exported to {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
