#!/usr/bin/env python3
"""
Train the animation parameter MLP for Miro TCG.

Reads teacher-labeled data from generate.py and trains a feedforward network
that predicts animation parameters from card features. Higher-scoring params
are weighted more heavily during training so the model learns to predict
parameters that produce good animations.

Architecture: CARD_FEATURE_DIM → 256 → 128 → 64 → ANIM_PARAM_DIM
Loss: Score-weighted MSE on normalized parameters

Exports weights as JSON matching the pattern in train_neural_eval.py,
loadable by the Node.js inference module (server/animation-model.ts).

Usage:
    python train.py                                    # defaults
    python train.py --epochs 100 --lr 1e-3             # custom
    python train.py --data data/animation-training.jsonl  # explicit data path
"""

from __future__ import annotations

import argparse
import json
import sys
import time
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

# ── Constants ────────────────────────────────────────────────────────

WEIGHTS_SCHEMA_VERSION = 1
DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
DEFAULT_DATA = DATA_DIR / "animation-training.jsonl"
DEFAULT_OUTPUT = DATA_DIR / "animation-weights.json"


# ── Model ────────────────────────────────────────────────────────────

class AnimationMLP(nn.Module):
    """
    Feedforward network: card features → animation parameters.
    ReLU activations on hidden layers, sigmoid on output (params are [0,1] normalized).
    """

    def __init__(self, input_dim: int, output_dim: int, hidden: list[int] | None = None):
        super().__init__()
        if hidden is None:
            hidden = [256, 128, 64]

        layers: list[nn.Module] = []
        prev = input_dim
        for h in hidden:
            layers.append(nn.Linear(prev, h))
            layers.append(nn.ReLU())
            prev = h
        layers.append(nn.Linear(prev, output_dim))
        layers.append(nn.Sigmoid())  # output in [0, 1] for normalized params

        self.net = nn.Sequential(*layers)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


# ── Data loading ─────────────────────────────────────────────────────

def load_training_data(
    path: Path,
    min_score: float = 0.0,
    max_samples: int | None = None,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Load JSONL training data.

    Returns:
        features: (N, CARD_FEATURE_DIM) — input card features
        params: (N, ANIM_PARAM_DIM) — target animation params (normalized)
        weights: (N,) — sample weights based on total_score
    """
    features_list: list[list[float]] = []
    params_list: list[list[float]] = []
    scores_list: list[float] = []
    skipped = 0

    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                skipped += 1
                continue

            total = record.get("total_score", 0)
            if total < min_score:
                skipped += 1
                continue

            feats = record.get("features")
            params = record.get("params_normalized")
            if feats is None or params is None:
                skipped += 1
                continue

            if len(feats) != CARD_FEATURE_DIM or len(params) != ANIM_PARAM_DIM:
                skipped += 1
                continue

            features_list.append(feats)
            params_list.append(params)
            scores_list.append(total)

            if max_samples and len(features_list) >= max_samples:
                break

    if skipped:
        print(f"  Skipped {skipped} records (malformed or below threshold)")

    X = np.array(features_list, dtype=np.float32)
    Y = np.array(params_list, dtype=np.float32)

    # Score-based sample weights: higher scores → higher weight
    # Normalize to mean=1 so loss scale is consistent
    raw_weights = np.array(scores_list, dtype=np.float32)
    raw_weights = np.maximum(raw_weights, 1.0)  # avoid zero weights
    raw_weights = raw_weights / raw_weights.mean()

    return X, Y, raw_weights


# ── Training ─────────────────────────────────────────────────────────

def train_model(
    X: np.ndarray,
    Y: np.ndarray,
    weights: np.ndarray,
    epochs: int = 100,
    batch_size: int = 256,
    lr: float = 1e-3,
    val_split: float = 0.1,
    hidden: list[int] | None = None,
) -> AnimationMLP:
    """Train the animation MLP with score-weighted MSE loss."""

    device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
    print(f"  Device: {device}")

    # Train/val split
    n = len(X)
    n_val = max(1, int(n * val_split))
    n_train = n - n_val
    perm = np.random.permutation(n)

    X_train = torch.from_numpy(X[perm[:n_train]]).to(device)
    Y_train = torch.from_numpy(Y[perm[:n_train]]).to(device)
    W_train = torch.from_numpy(weights[perm[:n_train]]).to(device)

    X_val = torch.from_numpy(X[perm[n_train:]]).to(device)
    Y_val = torch.from_numpy(Y[perm[n_train:]]).to(device)

    model = AnimationMLP(CARD_FEATURE_DIM, ANIM_PARAM_DIM, hidden).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    scheduler = torch.optim.lr_scheduler.OneCycleLR(
        optimizer, max_lr=lr, total_steps=epochs,
    )

    total_params = sum(p.numel() for p in model.parameters())
    print(f"  Model params: {total_params:,}")
    print(f"  Training: {n_train} samples, Validation: {n_val} samples")
    print(f"  Batch size: {batch_size}, Epochs: {epochs}")
    print()

    best_val_loss = float("inf")
    best_state = None
    patience = 15
    no_improve = 0

    for epoch in range(epochs):
        model.train()
        # Shuffle
        perm_train = torch.randperm(n_train, device=device)
        epoch_loss = 0.0
        num_batches = 0

        for i in range(0, n_train, batch_size):
            idx = perm_train[i : i + batch_size]
            xb = X_train[idx]
            yb = Y_train[idx]
            wb = W_train[idx]

            pred = model(xb)
            # Score-weighted MSE
            mse = ((pred - yb) ** 2).mean(dim=1)  # per-sample MSE
            loss = (mse * wb).mean()

            optimizer.zero_grad()
            loss.backward()
            optimizer.step()

            epoch_loss += loss.item()
            num_batches += 1

        scheduler.step()
        avg_train = epoch_loss / max(1, num_batches)

        # Validation
        model.eval()
        with torch.no_grad():
            val_pred = model(X_val)
            val_loss = ((val_pred - Y_val) ** 2).mean().item()

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

    # Restore best weights
    if best_state:
        model.load_state_dict(best_state)
        model.to(device)
    print(f"\n  Best val loss: {best_val_loss:.6f}")

    return model


# ── Weight export ────────────────────────────────────────────────────

def export_weights(model: AnimationMLP, out: Path, num_samples: int) -> None:
    """
    Export trained weights as JSON for the Node.js inference module.
    Format matches train_neural_eval.py: {version, W: [...], b: [...]}.
    """
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
        "trainedSamples": num_samples,
        "W": W,
        "b": b,
    }

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload))
    size_kb = out.stat().st_size / 1024
    print(f"  Exported weights to {out} ({size_kb:.0f} KB)")
    print(f"  Layers: {len(W)} linear ({' → '.join(str(w.shape[1]) + '→' + str(w.shape[0]) for w in [np.array(w) for w in W])})")


# ── CLI ──────────────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(description="Train animation parameter MLP")
    parser.add_argument("--data", default=str(DEFAULT_DATA), help="Training data JSONL")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT), help="Output weights JSON")
    parser.add_argument("--epochs", type=int, default=100)
    parser.add_argument("--batch-size", type=int, default=256)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--hidden", type=str, default="256,128,64",
                        help="Hidden layer sizes (comma-separated)")
    parser.add_argument("--min-score", type=float, default=0.0,
                        help="Minimum total_score to include in training")
    parser.add_argument("--max-samples", type=int, default=None)
    parser.add_argument("--val-split", type=float, default=0.1)
    args = parser.parse_args()

    data_path = Path(args.data)
    if not data_path.exists():
        print(f"ERROR: Training data not found: {data_path}")
        print("Run generate.py first to create training data.")
        return 1

    hidden = [int(x) for x in args.hidden.split(",")]

    print(f"Loading training data from {data_path}...")
    X, Y, weights = load_training_data(data_path, args.min_score, args.max_samples)
    print(f"  Loaded {len(X)} samples")
    print(f"  Feature dim: {X.shape[1]}, Param dim: {Y.shape[1]}")
    print(f"  Weight range: [{weights.min():.2f}, {weights.max():.2f}]")
    print()

    if len(X) < 10:
        print("ERROR: Too few samples for training. Generate more data first.")
        return 1

    print(f"Training MLP ({CARD_FEATURE_DIM} → {' → '.join(map(str, hidden))} → {ANIM_PARAM_DIM})...")
    model = train_model(
        X, Y, weights,
        epochs=args.epochs,
        batch_size=args.batch_size,
        lr=args.lr,
        val_split=args.val_split,
        hidden=hidden,
    )

    print(f"\nExporting weights...")
    export_weights(model, Path(args.output), len(X))

    return 0


if __name__ == "__main__":
    sys.exit(main())
