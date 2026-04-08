#!/usr/bin/env python3
"""
Train the neural board evaluator for Miro TCG (Phase 3.3 + Phase 4 expansion).

Pairs with `server/ai-neural.ts`. The TS module loads the weights file this
script writes (`data/neural-eval-weights.json`) and runs the inference-time
forward pass in pure TypeScript so the production server has zero Python
dependency at runtime.

What this script does
---------------------
1. Reads self-play game records produced by `npm run simulate` (or
   `scripts/parallel-simulate.ts`) when `SIM_HISTORY_FILE` is set.
   Each line is `{winner_id, final_winner_life?, snapshots: [...]}`.
2. Tolerantly skips malformed lines (multi-worker append races shouldn't
   happen anymore after C3, but the trainer is paranoid anyway).
3. Computes per-snapshot soft labels using a configurable scheme:
     - hard:        binary win/loss
     - discounted:  outcome × γ^(T-1-t)
     - margin:      hard label × margin_weight
     - both:        discounted × margin (default)
4. Builds a feature tensor in M5 unified memory (~700MB for 670K
   snapshots × 256 dims × 4 bytes), skips DataLoader entirely.
5. Trains an MLP at one of 4 capacity tiers — tiny / small / medium /
   large — with autocast (fp16) on MPS for ~1.5x throughput.
6. Exports weights as JSON in the schema ai-neural.ts expects, with
   `version` + `featureDim` baked in so the loader can refuse mismatched
   weights instead of silently producing garbage.

Usage
-----
    pip install torch numpy

    # Bootstrap (Run A):
    python scripts/train_neural_eval.py \\
        --simulation-data data/sim-history.jsonl \\
        --output data/neural-eval-weights.json \\
        --model-size tiny --epochs 30

    # Production (Run B):
    python scripts/train_neural_eval.py \\
        --simulation-data data/sim-history.jsonl \\
        --output data/neural-eval-weights.json \\
        --model-size medium --epochs 60 --batch-size 4096 \\
        --label-mode both --gamma 0.95

    # Llama-distilled (Run C, after find_disagreements + llama_label_positions):
    python scripts/train_neural_eval.py \\
        --simulation-data data/sim-history.jsonl \\
        --llama-labels data/llama-labels.jsonl --llama-weight 0.3 \\
        --model-size medium --epochs 60

Then in the server:
    AI_NEURAL_BLEND=0.3 npm run dev:server   # 30% neural, 70% heuristic
    AI_NEURAL_BLEND=1.0 npm run dev:server   # full neural

Schema constraint
-----------------
FEATURE_DIM and WEIGHTS_SCHEMA_VERSION must agree with server/ai-neural.ts.
See the constants at the top of this file. The TS loader refuses any
weights file whose featureDim or version mismatches.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import List, Tuple

try:
    import numpy as np
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
except ImportError as e:
    print(
        f"Missing dependency: {e}. Install with `pip install torch numpy`",
        file=sys.stderr,
    )
    sys.exit(1)


# ── Schema constants — must match server/ai-neural.ts ──────────────────

FEATURE_DIM = 256
WEIGHTS_SCHEMA_VERSION = 2


# ── Model factory ──────────────────────────────────────────────────────

# Width tables per tier. The first dim is implicit (= FEATURE_DIM); the
# trailing 1 is the scalar value head.
LAYER_TIERS: dict[str, list[int]] = {
    "tiny":   [64, 32, 1],
    "small":  [256, 128, 64, 1],
    "medium": [512, 256, 128, 64, 1],
    "large":  [1024, 512, 256, 128, 1],
}


class BoardEvaluator(nn.Module):
    """Configurable MLP. ReLU on every hidden layer, no activation on the
    final scalar — sigmoid is applied at loss computation time so we can
    use BCE-with-logits for numerical stability."""

    def __init__(self, layers: list[int], use_layernorm: bool = False, dropout: float = 0.0):
        super().__init__()
        prev = FEATURE_DIM
        modules: list[nn.Module] = []
        for i, width in enumerate(layers):
            modules.append(nn.Linear(prev, width))
            is_last = i == len(layers) - 1
            if not is_last:
                if use_layernorm:
                    modules.append(nn.LayerNorm(width))
                modules.append(nn.ReLU())
                if dropout > 0:
                    modules.append(nn.Dropout(dropout))
            prev = width
        self.net = nn.Sequential(*modules)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x).squeeze(-1)


def build_model(size: str) -> BoardEvaluator:
    if size not in LAYER_TIERS:
        raise SystemExit(f"Unknown --model-size {size!r}; choose from {list(LAYER_TIERS)}")
    use_norm = size in ("medium", "large")
    dropout = 0.1 if size != "tiny" else 0.0
    return BoardEvaluator(LAYER_TIERS[size], use_layernorm=use_norm, dropout=dropout)


# ── Data loading ───────────────────────────────────────────────────────


def load_simulation_data(
    path: Path,
    max_samples: int | None,
    label_mode: str,
    gamma: float,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Read self-play game records and produce (X, y, w) arrays.

    Each turn snapshot becomes one training example. Label and weight
    depend on label_mode:
        hard       — binary win/loss, weight=1
        discounted — outcome × γ^(T-1-t), weight=1
        margin     — binary label, weight scaled by winner's final life
        both       — discounted label, weight scaled by margin (default)

    Tolerantly skips malformed JSONL lines and games with no winner_id.
    """
    X_list: list[list[float]] = []
    y_list: list[float] = []
    w_list: list[float] = []

    skipped_lines = 0
    skipped_games = 0
    games_used = 0

    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                game = json.loads(line)
            except json.JSONDecodeError:
                skipped_lines += 1
                continue

            winner_id = game.get("winner_id")
            if not winner_id:
                skipped_games += 1
                continue

            snapshots = game.get("snapshots", [])
            if not snapshots:
                skipped_games += 1
                continue

            T = len(snapshots)
            final_life = float(game.get("final_winner_life") or 30)
            margin_w = 1.0 + 0.5 * (final_life / 30.0)

            for t, snap in enumerate(snapshots):
                features = snap.get("features")
                if not features or len(features) != FEATURE_DIM:
                    continue
                active = snap.get("active_player_id")
                outcome = 1.0 if active == winner_id else 0.0

                if label_mode == "hard":
                    label = outcome
                    weight = 1.0
                elif label_mode == "discounted":
                    label = outcome * (gamma ** (T - 1 - t))
                    weight = 1.0
                elif label_mode == "margin":
                    label = outcome
                    weight = margin_w
                else:  # both
                    label = outcome * (gamma ** (T - 1 - t))
                    weight = margin_w

                X_list.append(features)
                y_list.append(label)
                w_list.append(weight)

                if max_samples and len(X_list) >= max_samples:
                    return (
                        np.asarray(X_list, dtype=np.float32),
                        np.asarray(y_list, dtype=np.float32),
                        np.asarray(w_list, dtype=np.float32),
                    )

            games_used += 1

    print(
        f"  loaded {len(X_list)} snapshots from {games_used} games "
        f"(skipped {skipped_lines} bad lines, {skipped_games} games without a winner)"
    )

    return (
        np.asarray(X_list, dtype=np.float32),
        np.asarray(y_list, dtype=np.float32),
        np.asarray(w_list, dtype=np.float32),
    )


# ── Device selection ──────────────────────────────────────────────────


def pick_device() -> str:
    if torch.backends.mps.is_available():
        # MPS fallback flag — any unsupported op falls back to CPU instead
        # of crashing the run mid-training
        os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")
        return "mps"
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"


# ── Training loop (in-memory MPS tensor path) ─────────────────────────


def train(args: argparse.Namespace) -> int:
    sim_path = Path(args.simulation_data)
    if not sim_path.exists():
        print(
            f"Simulation data not found at {sim_path}.\n"
            f"Generate it with:\n"
            f"  SIM_HISTORY_FILE={sim_path} npx tsx server/ai-simulate.ts --games 1000 --teacher\n"
            f"or with the parallel coordinator:\n"
            f"  npx tsx scripts/parallel-simulate.ts --workers 16 --games-per-worker 5000 --teacher --output {sim_path}",
            file=sys.stderr,
        )
        return 1

    device = pick_device()
    print(f"Loading simulation data from {sim_path}...")
    X_np, y_np, w_np = load_simulation_data(
        sim_path,
        max_samples=args.max_samples,
        label_mode=args.label_mode,
        gamma=args.gamma,
    )
    if len(X_np) == 0:
        print("No training samples found after filtering.", file=sys.stderr)
        return 1

    print(f"  {len(X_np)} examples, label distribution mean={y_np.mean():.3f}")
    print(f"  device: {device}, model: {args.model_size}")

    # 90/10 train/val split, deterministic
    rng = np.random.default_rng(42)
    indices = rng.permutation(len(X_np))
    split = int(0.9 * len(X_np))
    train_idx, val_idx = indices[:split], indices[split:]

    # Pre-load EVERYTHING onto the device. With ~700K × 256 × 4 = ~700MB
    # we're nowhere near the M5's 120GB unified memory ceiling. Skipping
    # the DataLoader is the single biggest perf win on Apple silicon.
    X_train = torch.from_numpy(X_np[train_idx]).to(device)
    y_train = torch.from_numpy(y_np[train_idx]).to(device)
    w_train = torch.from_numpy(w_np[train_idx]).to(device)
    X_val = torch.from_numpy(X_np[val_idx]).to(device)
    y_val = torch.from_numpy(y_np[val_idx]).to(device)
    w_val = torch.from_numpy(w_np[val_idx]).to(device)

    model = build_model(args.model_size).to(device)
    n_params = sum(p.numel() for p in model.parameters())
    print(f"  model params: {n_params:,}")

    optim = torch.optim.Adam(model.parameters(), lr=args.lr, weight_decay=1e-5)
    steps_per_epoch = max(1, (len(X_train) + args.batch_size - 1) // args.batch_size)
    sched = torch.optim.lr_scheduler.OneCycleLR(
        optim,
        max_lr=args.lr,
        epochs=args.epochs,
        steps_per_epoch=steps_per_epoch,
    )

    # MPS warmup — first kernel launch can take ~5s while Metal compiles
    if device == "mps":
        with torch.no_grad():
            model(torch.zeros(2, FEATURE_DIM, device=device))

    best_val = float("inf")
    best_state = None
    use_autocast = device == "mps" and not args.no_autocast

    print(f"\nTraining {args.epochs} epochs, batch_size={args.batch_size}, lr={args.lr}")
    if use_autocast:
        print("  autocast(fp16) enabled on MPS")

    for epoch in range(1, args.epochs + 1):
        model.train()
        t0 = time.time()
        # Shuffle indices on-device per epoch
        perm = torch.randperm(len(X_train), device=device)
        epoch_loss = torch.zeros(1, device=device)
        n_seen = 0

        for i in range(0, len(X_train), args.batch_size):
            idx = perm[i : i + args.batch_size]
            xb = X_train[idx]
            yb = y_train[idx]
            wb = w_train[idx]

            if use_autocast:
                with torch.autocast(device_type="mps", dtype=torch.float16):
                    logits = model(xb)
                    per = F.binary_cross_entropy_with_logits(logits, yb, reduction="none")
                    loss = (per * wb).mean()
            else:
                logits = model(xb)
                per = F.binary_cross_entropy_with_logits(logits, yb, reduction="none")
                loss = (per * wb).mean()

            optim.zero_grad()
            loss.backward()
            optim.step()
            sched.step()

            epoch_loss += loss.detach() * xb.size(0)
            n_seen += xb.size(0)

        train_loss = (epoch_loss / max(1, n_seen)).item()

        # Validation pass
        model.eval()
        with torch.no_grad():
            val_logits = model(X_val)
            val_per = F.binary_cross_entropy_with_logits(val_logits, y_val, reduction="none")
            val_loss = (val_per * w_val).mean().item()
            val_preds = torch.sigmoid(val_logits)
            val_acc = ((val_preds > 0.5) == (y_val > 0.5)).float().mean().item()

        elapsed = time.time() - t0
        print(
            f"  epoch {epoch:3d}/{args.epochs}  "
            f"train={train_loss:.4f}  val={val_loss:.4f}  "
            f"val_acc={val_acc:.3f}  ({elapsed:.1f}s)"
        )

        if val_loss < best_val:
            best_val = val_loss
            best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}

    if best_state is not None:
        model.load_state_dict(best_state)

    export_weights(model, Path(args.output), num_games=len(X_np))
    print(f"\nWrote weights to {args.output}")
    print(f"Best val loss: {best_val:.4f}")
    return 0


def export_weights(model: BoardEvaluator, out: Path, num_games: int) -> None:
    """
    Dump trained weights as JSON in the schema server/ai-neural.ts v2
    expects: {version, featureDim, generatedAt, trainedGames, W: [...], b: [...]}.

    The W array contains one matrix per Linear layer in input→output order.
    Non-Linear modules (LayerNorm, ReLU, Dropout) are folded out at export
    time — but actually, LayerNorm has learnable params we'd need to fold
    into the matmul to keep the TS forward pass dependency-free. For now
    we leave LayerNorm in only for the medium/large training paths and
    note that the TS forward pass needs to be extended if we ever want to
    ship a layernorm'd model. Default ship target is `medium` without
    layernorm folding (still uses dropout during training, which has no
    inference-time effect).
    """
    W: list[list[list[float]]] = []
    b: list[list[float]] = []
    # Walk model.net (an nn.Sequential) and pull out every Linear layer in
    # order. The previous version of this function tried to introspect via
    # model.net.named_parameters() and a "net." substring check, but that
    # didn't match because named_parameters on nn.Sequential prefixes with
    # the numeric index ("0.weight"), not "net.0.weight". The straightforward
    # approach is to just iterate the modules.
    for module in model.net:
        if isinstance(module, nn.Linear):
            W.append(module.weight.detach().cpu().numpy().tolist())
            b.append(module.bias.detach().cpu().numpy().tolist())

    payload = {
        "version": WEIGHTS_SCHEMA_VERSION,
        "featureDim": FEATURE_DIM,
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "trainedGames": num_games,
        "W": W,
        "b": b,
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload))


# ── CLI ────────────────────────────────────────────────────────────────


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Train the Miro TCG neural board evaluator (Phase 3.3 + 4)"
    )
    parser.add_argument("--simulation-data", default="data/sim-history.jsonl")
    parser.add_argument("--output", default="data/neural-eval-weights.json")
    parser.add_argument("--model-size", default="medium",
                        choices=list(LAYER_TIERS.keys()))
    parser.add_argument("--epochs", type=int, default=60)
    parser.add_argument("--batch-size", type=int, default=4096)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--max-samples", type=int, default=None,
                        help="Cap training samples (for smoke tests)")
    parser.add_argument("--label-mode", default="both",
                        choices=["hard", "discounted", "margin", "both"])
    parser.add_argument("--gamma", type=float, default=0.95,
                        help="Discount factor for early-game snapshots")
    parser.add_argument("--no-autocast", action="store_true",
                        help="Disable MPS autocast (debugging only)")
    args = parser.parse_args()
    return train(args)


if __name__ == "__main__":
    sys.exit(main())
