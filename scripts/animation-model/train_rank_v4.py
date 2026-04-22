#!/usr/bin/env python3
"""
Rank-learning v4 — wider network + residual skip from input to first
hidden + a blended loss (pairwise rank + auxiliary MSE on the positive
sample) so the model doesn't converge to a "mean" output that's merely
closer to pos than neg.

Rationale:
  v2 val rank-loss plateaus ~0.012-0.019. Inspecting the outputs shows
  many per-card predictions are close to the per-context mean. Rank
  loss alone doesn't require the model to match the positive — it just
  needs pred closer to pos than neg. A 0.1 * MSE(pred, pos) auxiliary
  pulls the output toward the actual high-scoring param vector.

  Wider net (190 → 512 → 256 → 128 → 38) has ~290K params vs v2's
  ~130K, giving it enough capacity to capture per-card variation.
  A single residual projection from the 190-dim input to the first
  hidden (512) layer prevents the art embedding's signal from getting
  buried in the early activations.

Outputs data/animation-weights-v4.json. Can be swapped in by repointing
server/animation-model.ts to load the v4 file. v2 stays as fallback.

Usage:
    python scripts/animation-model/train_rank_v4.py
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
import torch.nn.functional as F

from schema import ANIM_PARAM_DIM, CARD_FEATURE_DIM, PARAM_NAMES
from train_rank import rank_loss, export_weights

ART_EMBED_DIM = 128
INPUT_DIM = CARD_FEATURE_DIM + ART_EMBED_DIM  # 190

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
DEFAULT_DATA = DATA_DIR / "animation-training.jsonl"
DEFAULT_EMBEDS = DATA_DIR / "animation-art-embeddings.json"
DEFAULT_OUTPUT = DATA_DIR / "animation-weights-v4.json"


class AnimationMLPv4(nn.Module):
    """
    Wider feed-forward + residual skip from input to first hidden.

    [190] → Linear→ReLU [512] + residual(190→512) → Linear→ReLU [256]
         → Linear→ReLU [128] → Linear→Sigmoid [38]

    The `export_weights` helper from train_rank expects a flat
    nn.Sequential.net attribute to walk, so we expose `self.net` as a
    Sequential that ignores the residual during export — the weights
    get serialized layer-by-layer matching the MLP naming convention
    and the inference layer in server/animation-model.ts stays the
    same. The residual is trained in the `forward` path but folded
    into the first hidden's bias at export time (the server doesn't
    need it — the post-training MLP has absorbed the skip).
    """

    def __init__(self, input_dim: int = INPUT_DIM, output_dim: int = ANIM_PARAM_DIM):
        super().__init__()
        self.fc1 = nn.Linear(input_dim, 512)
        self.skip = nn.Linear(input_dim, 512, bias=False)  # projects input into the first hidden space
        self.fc2 = nn.Linear(512, 256)
        self.fc3 = nn.Linear(256, 128)
        self.fc4 = nn.Linear(128, output_dim)

        # `net` exposes the plain MLP path so export_weights walks it.
        # Inference will use this exact path; the residual is absorbed
        # by increasing fc1.weight = fc1.weight + skip.weight at export.
        self.net = nn.Sequential(
            self.fc1, nn.ReLU(),
            self.fc2, nn.ReLU(),
            self.fc3, nn.ReLU(),
            self.fc4, nn.Sigmoid(),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        h = F.relu(self.fc1(x) + self.skip(x))
        h = F.relu(self.fc2(h))
        h = F.relu(self.fc3(h))
        return torch.sigmoid(self.fc4(h))

    def fold_skip_into_fc1(self) -> None:
        """Absorb self.skip into self.fc1.weight so the Sequential path
        equals the forward path. Call before export."""
        with torch.no_grad():
            self.fc1.weight.add_(self.skip.weight)
        # zero out skip so the Sequential path ignores it on re-forward
        nn.init.zeros_(self.skip.weight)


def load_pairs(
    data_path: Path,
    embed_path: Path,
    min_score_gap: float = 8.0,
    pairs_per_bin: int = 80,
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


def combined_loss(
    pred: torch.Tensor,
    pos: torch.Tensor,
    neg: torch.Tensor,
    weights: torch.Tensor,
    margin: float,
    mse_weight: float,
) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
    """Rank loss + auxiliary MSE on the positive. Weights are per-pair."""
    d_pos = torch.sqrt(((pred - pos) ** 2).mean(dim=1) + 1e-8)
    d_neg = torch.sqrt(((pred - neg) ** 2).mean(dim=1) + 1e-8)
    rank = torch.clamp(margin + d_pos - d_neg, min=0.0)
    rank_weighted = (rank * weights).mean()

    # Auxiliary MSE: pull pred toward the positive, weighted by the
    # same per-pair confidence so small-gap pairs contribute less.
    mse = ((pred - pos) ** 2).mean(dim=1)
    mse_weighted = (mse * weights).mean()

    total = rank_weighted + mse_weight * mse_weighted
    return total, rank_weighted, mse_weighted


def train(
    X: np.ndarray,
    Y_pos: np.ndarray,
    Y_neg: np.ndarray,
    gaps: np.ndarray,
    epochs: int = 150,
    batch_size: int = 256,
    lr: float = 1e-3,
    val_split: float = 0.1,
    margin: float = 0.05,
    mse_weight: float = 0.15,
) -> AnimationMLPv4:
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

    model = AnimationMLPv4().to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.OneCycleLR(
        optimizer, max_lr=lr, total_steps=epochs,
    )

    total_params = sum(p.numel() for p in model.parameters())
    print(f"  Model params: {total_params:,}")
    print(f"  Pairs: train={n_train}, val={n_val}, margin={margin}, mse_weight={mse_weight}")
    print()

    best_val_rank = float("inf")
    best_state = None
    patience = 25
    no_improve = 0

    for epoch in range(epochs):
        model.train()
        perm_train = torch.randperm(n_train, device=device)
        ep_total = 0.0
        ep_rank = 0.0
        ep_mse = 0.0
        num_batches = 0

        for i in range(0, n_train, batch_size):
            idx = perm_train[i : i + batch_size]
            xb = X_train[idx]
            yb_pos = Yp_train[idx]
            yb_neg = Yn_train[idx]
            wb = W_train[idx]

            pred = model(xb)
            loss, rk, ms = combined_loss(pred, yb_pos, yb_neg, wb, margin, mse_weight)

            optimizer.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()

            ep_total += loss.item()
            ep_rank += rk.item()
            ep_mse += ms.item()
            num_batches += 1

        scheduler.step()

        model.eval()
        with torch.no_grad():
            vp = model(X_val)
            val_rank = rank_loss(vp, Yp_val, Yn_val, margin=margin).item()
            val_mse = ((vp - Yp_val) ** 2).mean().item()

        if val_rank < best_val_rank:
            best_val_rank = val_rank
            best_state = {k: v.cpu().clone() for k, v in model.state_dict().items()}
            no_improve = 0
        else:
            no_improve += 1

        if (epoch + 1) % 10 == 0 or epoch == 0 or no_improve == 0:
            marker = " *" if no_improve == 0 else ""
            print(
                f"  Epoch {epoch+1:3d}/{epochs}  "
                f"train={ep_total/num_batches:.6f} (rk={ep_rank/num_batches:.6f} ms={ep_mse/num_batches:.6f})  "
                f"val_rank={val_rank:.6f} val_mse={val_mse:.6f}{marker}"
            )

        if no_improve >= patience:
            print(f"  Early stopping at epoch {epoch+1}")
            break

    if best_state:
        model.load_state_dict(best_state)
        model.to(device)
    print(f"\n  Best val rank-loss: {best_val_rank:.6f}")

    # Fold the residual into fc1 so the exported Sequential path matches
    # what the server will run at inference.
    model.fold_skip_into_fc1()
    # Sanity check: post-fold, model.forward ≈ model.net
    with torch.no_grad():
        sample = X_val[:32]
        a = model(sample)
        b = model.net(sample)
        diff = (a - b).abs().max().item()
        print(f"  Post-fold fwd/net diff: {diff:.2e}")

    return model


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", type=Path, default=DEFAULT_DATA)
    ap.add_argument("--embeds", type=Path, default=DEFAULT_EMBEDS)
    ap.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    ap.add_argument("--min-score-gap", type=float, default=8.0)
    ap.add_argument("--pairs-per-bin", type=int, default=80)
    ap.add_argument("--epochs", type=int, default=150)
    ap.add_argument("--margin", type=float, default=0.05)
    ap.add_argument("--mse-weight", type=float, default=0.15)
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

    print("\nTraining v4...")
    t0 = time.time()
    model = train(
        X, Y_pos, Y_neg, gaps,
        epochs=args.epochs, margin=args.margin, mse_weight=args.mse_weight,
    )
    print(f"\nTraining took {time.time() - t0:.1f}s")

    export_weights(model, args.output, num_pairs=len(X))
    print(f"Weights exported to {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
