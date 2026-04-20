#!/usr/bin/env python3
"""
Rank-learning variant of train.py — alternative objective for when data
density finally catches up but score-weighted MSE still predicts the mean.

Grouping: samples are bucketed by (card_code, anim_context). Within each
bucket with ≥2 samples, we build all pairs (i, j) with score_i > score_j
by a margin ≥ MARGIN_THRESHOLD. The model is trained so that predicting
the param vector closer to the higher-scored sample's params than to the
lower-scored sample's params — a margin-rank loss on distances.

Loss per pair: max(0, margin + d(pred, y_pos) − d(pred, y_neg))
  where y_pos is the better sample's params, y_neg the worse one.

This assumes the model's output SHOULD be closer to high-score params
than to low-score params per-bin — sidesteps the "mean-of-random"
collapse by teaching relative preference rather than absolute target.

Usage (after generate.py produces ≥20k samples so bins have ≥5 each):
    python train_rank.py                             # defaults
    python train_rank.py --min-score-gap 15          # larger margin
    python train_rank.py --pairs-per-bin 20          # cap pair count

Exports weights to data/animation-weights-rank.json (separate from
train.py's data/animation-weights.json).
"""

from __future__ import annotations

import argparse
import json
import random
import sys
import time
from collections import defaultdict
from pathlib import Path

try:
    import numpy as np
    import torch
    import torch.nn as nn
except ImportError as e:
    print(f"Missing dependency: {e}. Install with: pip install torch numpy", file=sys.stderr)
    sys.exit(1)

from schema import (
    ANIM_PARAM_DIM,
    CARD_FEATURE_DIM,
    PARAM_NAMES,
)
from train import AnimationMLP

WEIGHTS_SCHEMA_VERSION = 1
DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
DEFAULT_DATA = DATA_DIR / "animation-training.jsonl"
DEFAULT_OUTPUT = DATA_DIR / "animation-weights-rank.json"


def load_and_group(
    path: Path,
    min_score_gap: float = 10.0,
    pairs_per_bin: int = 50,
    seed: int = 42,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """
    Load samples, group by (card_code, anim_context), form ranked pairs.

    Returns:
        X_pair: (P, CARD_FEATURE_DIM) — features for each pair (both
                sides share features since same bin)
        Y_pos:  (P, ANIM_PARAM_DIM)  — params of the higher-scored sample
        Y_neg:  (P, ANIM_PARAM_DIM)  — params of the lower-scored sample
        gaps:   (P,) — score gap (for weighting if desired)
    """
    rng = random.Random(seed)
    bins: dict[tuple[str, str], list[dict]] = defaultdict(list)

    with open(path) as f:
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
            key = (r.get("card_code", ""), r.get("anim_context", ""))
            bins[key].append(r)

    print(f"  Bins: {len(bins)}, samples: {sum(len(v) for v in bins.values())}")
    multi_bins = [b for b in bins.values() if len(b) >= 2]
    print(f"  Bins with ≥2 samples: {len(multi_bins)}")

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
            X_pair.append(pos["features"])
            Y_pos.append(pos["params_normalized"])
            Y_neg.append(neg["params_normalized"])
            gaps.append(gap)

    print(f"  Total pairs: {len(X_pair)}")
    if not X_pair:
        print("  ERROR: no pairs formed — data density too low or gap too strict")

    return (
        np.array(X_pair, dtype=np.float32),
        np.array(Y_pos, dtype=np.float32),
        np.array(Y_neg, dtype=np.float32),
        np.array(gaps, dtype=np.float32),
    )


def rank_loss(
    pred: torch.Tensor, y_pos: torch.Tensor, y_neg: torch.Tensor,
    margin: float = 0.05,
) -> torch.Tensor:
    """Margin-rank loss on per-sample L2 distances in param space."""
    d_pos = torch.sqrt(((pred - y_pos) ** 2).mean(dim=1) + 1e-8)
    d_neg = torch.sqrt(((pred - y_neg) ** 2).mean(dim=1) + 1e-8)
    return torch.clamp(margin + d_pos - d_neg, min=0.0).mean()


def train_rank_model(
    X: np.ndarray,
    Y_pos: np.ndarray,
    Y_neg: np.ndarray,
    gaps: np.ndarray,
    epochs: int = 100,
    batch_size: int = 256,
    lr: float = 1e-3,
    val_split: float = 0.1,
    margin: float = 0.05,
    hidden: list[int] | None = None,
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

    model = AnimationMLP(CARD_FEATURE_DIM, ANIM_PARAM_DIM, hidden).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    scheduler = torch.optim.lr_scheduler.OneCycleLR(
        optimizer, max_lr=lr, total_steps=epochs,
    )

    total_params = sum(p.numel() for p in model.parameters())
    print(f"  Model params: {total_params:,}")
    print(f"  Pairs: train={n_train}, val={n_val}, margin={margin}")
    print()

    best_val_loss = float("inf")
    best_state = None
    patience = 15
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
            # Weighted margin-rank: bigger score gaps get bigger weight
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


def export_weights(model: AnimationMLP, out: Path, num_pairs: int) -> None:
    W: list[list[list[float]]] = []
    b: list[list[float]] = []
    for module in model.net:
        if isinstance(module, nn.Linear):
            W.append(module.weight.detach().to(torch.float32).cpu().numpy().tolist())
            b.append(module.bias.detach().to(torch.float32).cpu().numpy().tolist())

    payload = {
        "version": WEIGHTS_SCHEMA_VERSION,
        "featureDim": CARD_FEATURE_DIM,
        "outputDim": ANIM_PARAM_DIM,
        "paramNames": PARAM_NAMES,
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "trainedPairs": num_pairs,
        "objective": "margin_rank",
        "W": W,
        "b": b,
    }

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload))
    size_kb = out.stat().st_size / 1024
    print(f"  Exported weights to {out} ({size_kb:.0f} KB)")


def main() -> int:
    parser = argparse.ArgumentParser(description="Train animation MLP with rank loss")
    parser.add_argument("--data", default=str(DEFAULT_DATA))
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    parser.add_argument("--epochs", type=int, default=100)
    parser.add_argument("--batch-size", type=int, default=256)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--margin", type=float, default=0.05)
    parser.add_argument("--min-score-gap", type=float, default=10.0,
                        help="Min score delta between pos/neg within a bin")
    parser.add_argument("--pairs-per-bin", type=int, default=50)
    parser.add_argument("--hidden", type=str, default="256,128,64")
    parser.add_argument("--val-split", type=float, default=0.1)
    args = parser.parse_args()

    data_path = Path(args.data)
    if not data_path.exists():
        print(f"ERROR: Training data not found: {data_path}")
        return 1

    hidden = [int(x) for x in args.hidden.split(",")]

    print(f"Loading + grouping data from {data_path}...")
    X, Y_pos, Y_neg, gaps = load_and_group(
        data_path,
        min_score_gap=args.min_score_gap,
        pairs_per_bin=args.pairs_per_bin,
    )
    if len(X) < 10:
        print("ERROR: Too few pairs — generate more data or lower --min-score-gap")
        return 1

    print(f"\nTraining rank-loss MLP ({CARD_FEATURE_DIM} → {' → '.join(map(str, hidden))} → {ANIM_PARAM_DIM})...")
    model = train_rank_model(
        X, Y_pos, Y_neg, gaps,
        epochs=args.epochs,
        batch_size=args.batch_size,
        lr=args.lr,
        val_split=args.val_split,
        margin=args.margin,
        hidden=hidden,
    )

    print(f"\nExporting weights...")
    export_weights(model, Path(args.output), len(X))
    return 0


if __name__ == "__main__":
    sys.exit(main())
