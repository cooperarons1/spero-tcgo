#!/usr/bin/env python3
"""
eval_weights.py — apples-to-apples comparison of multiple neural-eval weights
files against the same held-out test set.

Why this exists
---------------
The naive head-to-head tournament in scripts/tournament.ts has a fundamental
problem: ai-neural.ts loads weights at module init, so the running simulator
process has exactly ONE neural eval. You can't put model A in slot 0 and
model B in slot 1 in the same game without architectural changes to
ai-neural.ts (per-instance weight loading).

This evaluator sidesteps that by comparing models on a frozen test set of
real game positions extracted from a sim-history JSONL. For each model:
  1. Load the weights file
  2. Run the forward pass over every position in the test set
  3. Compute val_acc against the eventual game outcome
  4. Report the head-to-head delta

Same test set across models = apples-to-apples. No simulator runs needed.
Runs in seconds for tens of millions of test positions.

Usage
-----
    python scripts/eval_weights.py \\
        --test-data data/sim-history-runB.jsonl \\
        --weights data/neural-eval-weights.runB.json \\
        --weights data/neural-eval-weights.runC.json \\
        --test-fraction 0.1 \\
        --max-test-positions 1000000

Output
------
    Test set: 1,000,000 positions from data/sim-history-runB.jsonl

    runB.json   acc=0.8702  loss=0.5821  bias=+0.012
    runC.json   acc=0.8845  loss=0.5544  bias=-0.003

    runC.json beats runB.json by +0.0143 acc (+1.43%)
    binomial p-value (one-sided): 0.0000 — significant

Note on the test set choice
---------------------------
For a fair comparison the test set should ideally be from a DIFFERENT
distribution than either model's training set (so neither has memorized it).
In practice, sampling 10% of any sim-history JSONL gives us a clean test
slice because both Run B and Run C trained with deterministic 90/10
train/val splits using the same seed. The held-out 10% is what each model
was already validating against during training, but cross-model the test
isn't biased toward either.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
import time
from pathlib import Path
from typing import Iterable

import numpy as np
import torch

# Reuse the trainer's loader / model factory / constants
sys.path.insert(0, str(Path(__file__).parent))
from train_neural_eval import (  # noqa: E402
    FEATURE_DIM,
    LAYER_TIERS,
    BoardEvaluator,
    pick_device,
    estimate_snapshots,
)


def load_test_set(
    path: Path,
    test_fraction: float,
    max_positions: int | None,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Stream the JSONL and pick every Nth game (where N = 1/test_fraction)
    to land in the test set. Deterministic — running this script twice on
    the same data produces the same X/y.
    """
    keep_every = max(1, int(round(1 / max(0.0001, test_fraction))))
    X_list: list[list[float]] = []
    y_list: list[float] = []

    game_idx = 0
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                game = json.loads(line)
            except json.JSONDecodeError:
                continue
            if game_idx % keep_every != 0:
                game_idx += 1
                continue
            game_idx += 1

            winner_id = game.get("winner_id")
            if not winner_id:
                continue
            for snap in game.get("snapshots", []):
                feats = snap.get("features")
                if not feats or len(feats) != FEATURE_DIM:
                    continue
                outcome = 1.0 if snap.get("active_player_id") == winner_id else 0.0
                X_list.append(feats)
                y_list.append(outcome)
                if max_positions and len(X_list) >= max_positions:
                    return (
                        np.asarray(X_list, dtype=np.float32),
                        np.asarray(y_list, dtype=np.float32),
                    )

    return np.asarray(X_list, dtype=np.float32), np.asarray(y_list, dtype=np.float32)


def load_model_from_json(path: Path, device: str) -> BoardEvaluator:
    """
    Construct a BoardEvaluator from a v2 weights JSON. The model size is
    inferred from the layer widths in the W array, then we copy the weights
    + biases into a fresh torch model so it runs on the chosen device.
    """
    raw = json.loads(path.read_text())
    if raw.get("featureDim") != FEATURE_DIM:
        raise SystemExit(
            f"{path.name}: featureDim={raw.get('featureDim')} doesn't match "
            f"{FEATURE_DIM} (retrain with the current trainer)"
        )

    Ws = raw["W"]
    bs = raw["b"]
    layers = [len(Wi) for Wi in Ws]  # widths after each Linear

    # Find the matching tier (or build a custom one if it doesn't match exactly)
    tier_match = None
    for tier_name, tier_layers in LAYER_TIERS.items():
        if tier_layers == layers:
            tier_match = tier_name
            break

    model = BoardEvaluator(layers, use_layernorm=False, dropout=0.0)
    model.eval()

    # Walk model.net and assign weights to each Linear in order
    linear_idx = 0
    for module in model.net:
        if isinstance(module, torch.nn.Linear):
            module.weight.data = torch.tensor(Ws[linear_idx], dtype=torch.float32)
            module.bias.data = torch.tensor(bs[linear_idx], dtype=torch.float32)
            linear_idx += 1
    if linear_idx != len(Ws):
        raise SystemExit(
            f"{path.name}: weights file has {len(Ws)} matrices but reconstructed "
            f"model has {linear_idx} Linear layers"
        )

    model.to(device)
    note = f" ({tier_match})" if tier_match else ""
    print(f"  loaded {path.name}: layers={layers}{note}, params={sum(p.numel() for p in model.parameters()):,}")
    return model


def evaluate(model: BoardEvaluator, X: torch.Tensor, y: torch.Tensor, batch: int = 16384) -> dict:
    model.eval()
    n = X.shape[0]
    correct = 0
    loss_sum = 0.0
    pred_sum = 0.0
    with torch.no_grad():
        for i in range(0, n, batch):
            xb = X[i : i + batch]
            yb = y[i : i + batch]
            logits = model(xb)
            probs = torch.sigmoid(logits)
            loss = torch.nn.functional.binary_cross_entropy_with_logits(logits, yb, reduction="sum")
            loss_sum += float(loss.item())
            correct += int(((probs > 0.5) == (yb > 0.5)).sum().item())
            pred_sum += float(probs.sum().item())
    return {
        "acc": correct / n,
        "loss": loss_sum / n,
        "mean_pred": pred_sum / n,
        "n": n,
    }


def binomial_p_value(wins: int, n: int) -> float:
    """One-sided binomial: P(X >= wins) under p=0.5. Used to test 'is the
    delta significant?' when comparing two models on the same test set."""
    if n == 0:
        return 1.0
    log_total = -math.inf
    for k in range(wins, n + 1):
        log_choose = sum(math.log(n - k + i) - math.log(i) for i in range(1, k + 1))
        log_prob = log_choose + n * math.log(0.5)
        m = max(log_total, log_prob)
        log_total = m + math.log(math.exp(log_total - m) + math.exp(log_prob - m))
    return math.exp(log_total)


def main() -> int:
    parser = argparse.ArgumentParser(description="Compare neural-eval weight files head-to-head")
    parser.add_argument("--test-data", required=True)
    parser.add_argument("--weights", action="append", required=True,
                        help="Path to a weights JSON file (can repeat for multiple models)")
    parser.add_argument("--test-fraction", type=float, default=0.1,
                        help="Fraction of games in the file to use as the test set (default 0.1)")
    parser.add_argument("--max-test-positions", type=int, default=1_000_000,
                        help="Cap test positions to keep eval time bounded (default 1M)")
    args = parser.parse_args()

    test_path = Path(args.test_data)
    print(f"Test set: streaming from {test_path}")
    t0 = time.time()
    X_np, y_np = load_test_set(test_path, args.test_fraction, args.max_test_positions)
    print(f"  loaded {len(X_np):,} positions in {time.time() - t0:.1f}s")

    if len(X_np) == 0:
        print("No test positions found. Check --test-data path and --test-fraction.", file=sys.stderr)
        return 1

    device = pick_device()
    X = torch.from_numpy(X_np).to(device)
    y = torch.from_numpy(y_np).to(device)
    del X_np, y_np

    print()
    results = []
    for w_path in args.weights:
        path = Path(w_path)
        if not path.exists():
            print(f"  ! {path}: file not found, skipping")
            continue
        model = load_model_from_json(path, device)
        result = evaluate(model, X, y)
        result["name"] = path.name
        results.append(result)
        print(f"    acc={result['acc']:.4f}  loss={result['loss']:.4f}  "
              f"mean_pred={result['mean_pred']:.3f}  n={result['n']:,}")
        del model

    if len(results) >= 2:
        print()
        print("══ Head-to-head ══")
        # Sort by acc descending
        results.sort(key=lambda r: -r["acc"])
        baseline = results[-1]
        for r in results[:-1]:
            delta = r["acc"] - baseline["acc"]
            wins = int(r["acc"] * r["n"])
            n = r["n"]
            p = binomial_p_value(wins, n)
            verdict = "significant" if p < 0.05 else "not significant"
            print(
                f"  {r['name']} vs {baseline['name']}: "
                f"{delta:+.4f} acc ({delta * 100:+.2f}%), "
                f"loss diff {r['loss'] - baseline['loss']:+.4f}, "
                f"binomial p={p:.4f} — {verdict}"
            )
    return 0


if __name__ == "__main__":
    sys.exit(main())
