#!/usr/bin/env python3
"""
Train the neural board evaluator for Miro TCG (Phase 3.3).

Pairs with `server/ai-neural.ts`. The TS module loads the weights file this
script writes (`data/neural-eval-weights.json`) and runs the inference-time
forward pass in pure TypeScript so the production server has zero Python
dependency at runtime.

What this script does
---------------------
1. Reads self-play game records produced by `npm run simulate` (server/
   ai-simulate.ts) — those games already include final outcomes plus
   per-turn snapshots of the game state.
2. Converts each per-turn snapshot into a fixed-length feature vector
   (matching the layout in extractFeatures() in server/ai-neural.ts —
   FEATURE_DIM = 80).
3. The label for each snapshot is the eventual game outcome from the
   perspective of the active player at that turn (1 = win, 0 = loss).
4. Trains a small 80→64→32→1 MLP with PyTorch (BCE loss, Adam, OneCycleLR).
5. Exports the trained weights as a JSON file with the schema
   server/ai-neural.ts expects.

Why this lives separately from the existing ai-distill.ts / ai-teacher.ts
------------------------------------------------------------------------
The existing TS distillation pipeline produces hand-crafted *categorical*
weights (per-card matchup bonuses, attack-face thresholds by class, etc.)
that ai.ts blends into its heuristic evaluator. This script produces
*continuous* MLP weights for the new neural-eval path. They're complementary:
the heuristic path stays as a fallback / blend partner via `AI_NEURAL_BLEND`.

Usage
-----
    pip install torch numpy
    python scripts/train_neural_eval.py \\
        --simulation-data data/sim-history.jsonl \\
        --output data/neural-eval-weights.json \\
        --epochs 30

    # Smaller / faster smoke test
    python scripts/train_neural_eval.py --epochs 3 --max-samples 10000

Then in the server:
    AI_NEURAL_BLEND=0.3 npm run dev:server   # 30% neural, 70% heuristic
    AI_NEURAL_BLEND=1.0 npm run dev:server   # full neural

Input format
------------
The script expects a JSONL file where each line is one self-play game:

    {
      "winner_id": "ai-bot-1",
      "snapshots": [
        {
          "turn": 1,
          "active_player_id": "ai-bot-1",
          "features": [0.0, 0.5, ...]   # 80 floats matching FEATURE_DIM
        },
        ...
      ]
    }

If you don't have such a file yet, generate one by extending
server/ai-simulate.ts to dump features per turn (call extractFeatures()
from server/ai-neural.ts). See the README at the bottom of this file for
the minimal patch.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from typing import List, Tuple

try:
    import numpy as np
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
    from torch.utils.data import DataLoader, TensorDataset
except ImportError as e:
    print(
        f"Missing dependency: {e}. Install with `pip install torch numpy`",
        file=sys.stderr,
    )
    sys.exit(1)


# Must match FEATURE_DIM in server/ai-neural.ts
FEATURE_DIM = 80
HIDDEN1 = 64
HIDDEN2 = 32

DEVICE = (
    "mps"
    if torch.backends.mps.is_available()
    else "cuda"
    if torch.cuda.is_available()
    else "cpu"
)


class BoardEvaluator(nn.Module):
    """Small MLP — 80 → 64 → 32 → 1, sigmoid output. Total params ~5K, runs
    in <1ms in pure TS at inference time. The architecture is intentionally
    small so the JSON weights file stays under 50KB."""

    def __init__(self) -> None:
        super().__init__()
        self.fc1 = nn.Linear(FEATURE_DIM, HIDDEN1)
        self.fc2 = nn.Linear(HIDDEN1, HIDDEN2)
        self.fc3 = nn.Linear(HIDDEN2, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = F.relu(self.fc1(x))
        x = F.relu(self.fc2(x))
        return torch.sigmoid(self.fc3(x)).squeeze(-1)


def load_simulation_data(
    path: Path, max_samples: int | None
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Read self-play game records and produce (X, y) tensors.

    Each turn snapshot becomes one training example. The label is 1 if the
    snapshot's active player ended up winning the game, else 0.
    """
    X_list: List[List[float]] = []
    y_list: List[int] = []

    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                game = json.loads(line)
            except json.JSONDecodeError:
                continue

            winner_id = game.get("winner_id")
            for snap in game.get("snapshots", []):
                features = snap.get("features")
                if not features or len(features) != FEATURE_DIM:
                    continue
                active = snap.get("active_player_id")
                label = 1 if active and active == winner_id else 0
                X_list.append(features)
                y_list.append(label)

                if max_samples and len(X_list) >= max_samples:
                    return np.array(X_list, dtype=np.float32), np.array(
                        y_list, dtype=np.float32
                    )

    return np.array(X_list, dtype=np.float32), np.array(y_list, dtype=np.float32)


def train(args: argparse.Namespace) -> int:
    sim_path = Path(args.simulation_data)
    if not sim_path.exists():
        print(
            f"Simulation data not found at {sim_path}.\n"
            f"Generate it by running `npm run simulate` after applying the\n"
            f"feature-dump patch documented at the bottom of this script.",
            file=sys.stderr,
        )
        return 1

    print(f"Loading simulation data from {sim_path}...")
    X, y = load_simulation_data(sim_path, args.max_samples)
    if len(X) == 0:
        print("No training samples found.", file=sys.stderr)
        return 1

    print(f"  Loaded {len(X)} examples (positives: {y.sum():.0f})")
    print(f"  Device: {DEVICE}")

    # 90/10 train/val split, deterministic
    rng = np.random.default_rng(42)
    indices = rng.permutation(len(X))
    split = int(0.9 * len(X))
    train_idx, val_idx = indices[:split], indices[split:]

    train_ds = TensorDataset(
        torch.from_numpy(X[train_idx]), torch.from_numpy(y[train_idx])
    )
    val_ds = TensorDataset(
        torch.from_numpy(X[val_idx]), torch.from_numpy(y[val_idx])
    )

    train_loader = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=args.batch_size)

    model = BoardEvaluator().to(DEVICE)
    optim = torch.optim.Adam(model.parameters(), lr=args.lr)
    sched = torch.optim.lr_scheduler.OneCycleLR(
        optim,
        max_lr=args.lr,
        epochs=args.epochs,
        steps_per_epoch=len(train_loader),
    )

    best_val = float("inf")
    best_state = None

    for epoch in range(1, args.epochs + 1):
        model.train()
        t0 = time.time()
        train_loss = 0.0
        for xb, yb in train_loader:
            xb, yb = xb.to(DEVICE), yb.to(DEVICE)
            preds = model(xb)
            loss = F.binary_cross_entropy(preds, yb)
            optim.zero_grad()
            loss.backward()
            optim.step()
            sched.step()
            train_loss += loss.item() * xb.size(0)
        train_loss /= len(train_ds)

        # Eval
        model.eval()
        val_loss = 0.0
        val_correct = 0
        with torch.no_grad():
            for xb, yb in val_loader:
                xb, yb = xb.to(DEVICE), yb.to(DEVICE)
                preds = model(xb)
                loss = F.binary_cross_entropy(preds, yb)
                val_loss += loss.item() * xb.size(0)
                val_correct += ((preds > 0.5) == (yb > 0.5)).sum().item()
        val_loss /= len(val_ds)
        val_acc = val_correct / len(val_ds)

        elapsed = time.time() - t0
        print(
            f"  epoch {epoch:2d}/{args.epochs}  "
            f"train_loss={train_loss:.4f}  val_loss={val_loss:.4f}  "
            f"val_acc={val_acc:.3f}  ({elapsed:.1f}s)"
        )

        if val_loss < best_val:
            best_val = val_loss
            best_state = {k: v.cpu().clone() for k, v in model.state_dict().items()}

    # Restore best
    if best_state is not None:
        model.load_state_dict(best_state)

    export_weights(model, Path(args.output), num_games=args.epochs * len(train_ds))
    print(f"\nWrote weights to {args.output}")
    print(f"Best val loss: {best_val:.4f}")
    return 0


def export_weights(model: BoardEvaluator, out: Path, num_games: int) -> None:
    """Dump the trained weights as JSON in the schema server/ai-neural.ts
    expects. Float32 → float for JSON compatibility."""
    state = {k: v.cpu().numpy().tolist() for k, v in model.state_dict().items()}
    payload = {
        "version": 1,
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "trainedGames": num_games,
        "W1": state["fc1.weight"],
        "b1": state["fc1.bias"],
        "W2": state["fc2.weight"],
        "b2": state["fc2.bias"],
        "W3": state["fc3.weight"],
        "b3": state["fc3.bias"],
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, indent=2))


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Train the neural board evaluator (Phase 3.3)"
    )
    parser.add_argument("--simulation-data", default="data/sim-history.jsonl")
    parser.add_argument("--output", default="data/neural-eval-weights.json")
    parser.add_argument("--epochs", type=int, default=30)
    parser.add_argument("--batch-size", type=int, default=256)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--max-samples", type=int, default=None)
    args = parser.parse_args()
    return train(args)


if __name__ == "__main__":
    sys.exit(main())


# ── Note: required patch to ai-simulate.ts ────────────────────────────────
#
# This trainer expects each game in `data/sim-history.jsonl` to include
# per-turn feature snapshots. ai-simulate.ts doesn't currently dump those.
# The minimal patch is, inside the simulator's per-turn loop:
#
#   import { extractFeatures } from './ai-neural.js';
#
#   // After each turn:
#   gameRecord.snapshots.push({
#     turn: state.turn,
#     active_player_id: state.activePlayerId,
#     features: extractFeatures(state, state.activePlayerId),
#   });
#
#   // After the game ends:
#   gameRecord.winner_id = state.winnerId;
#   fs.appendFileSync('data/sim-history.jsonl', JSON.stringify(gameRecord) + '\n');
#
# That's it — the simulator already runs thousands of self-play games via
# `npm run simulate`, so feeding 100k+ snapshots into this trainer is
# straightforward overnight on the M5.
