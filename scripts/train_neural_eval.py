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
    # LayerNorm is intentionally OFF for all sizes — the TS inference path
    # in server/ai-neural.ts only knows how to fold Linear+ReLU layers, so
    # adding LayerNorm in training would break inference. Bf16 is stable
    # enough for this MLP without normalization. If quality plateaus we
    # can either fold LN params into the matmul at export time or extend
    # the TS forward pass.
    use_norm = False
    dropout = 0.1 if size != "tiny" else 0.0
    return BoardEvaluator(LAYER_TIERS[size], use_layernorm=use_norm, dropout=dropout)


# ── Data loading ───────────────────────────────────────────────────────


def _label_for(outcome: float, t: int, T: int, margin_w: float, label_mode: str, gamma: float) -> tuple[float, float]:
    """Compute (label, weight) for a single snapshot. Centralized so the
    chunked loader and the legacy non-chunked path agree."""
    if label_mode == "hard":
        return outcome, 1.0
    if label_mode == "discounted":
        return outcome * (gamma ** (T - 1 - t)), 1.0
    if label_mode == "margin":
        return outcome, margin_w
    # both
    return outcome * (gamma ** (T - 1 - t)), margin_w


def estimate_snapshots(path: Path, sample_lines: int = 200) -> int:
    """
    Estimate total snapshots in a JSONL game file by sampling the first
    `sample_lines` games and extrapolating from file size.

    Beats a full count pass on huge datasets — for a 95 GB file the count
    pass would take ~15 minutes of pure JSON parsing, while sampling 200
    lines runs in <1 second. The estimate is high enough to pre-allocate
    a buffer; the actual fill loop tracks the true count and trims at the
    end if we over-allocated.

    Returns a 10% over-estimate of the snapshot count so the pre-allocated
    tensor can hold everything without reallocation.
    """
    file_size = path.stat().st_size
    if file_size == 0:
        return 0

    sampled_bytes = 0
    sampled_snapshots = 0
    with path.open("r", encoding="utf-8") as f:
        for i, raw_line in enumerate(f):
            if i >= sample_lines:
                break
            sampled_bytes += len(raw_line)
            line = raw_line.strip()
            if not line:
                continue
            try:
                game = json.loads(line)
            except json.JSONDecodeError:
                continue
            if not game.get("winner_id"):
                continue
            for snap in game.get("snapshots", []):
                feats = snap.get("features")
                if feats and len(feats) == FEATURE_DIM:
                    sampled_snapshots += 1

    if sampled_bytes == 0 or sampled_snapshots == 0:
        return 0

    snapshots_per_byte = sampled_snapshots / sampled_bytes
    estimate = int(file_size * snapshots_per_byte * 1.1)  # 10% headroom
    return estimate


def load_simulation_data_chunked(
    path: Path,
    label_mode: str,
    gamma: float,
    device: str,
    dtype: torch.dtype,
    max_samples: int | None = None,
    chunk_rows: int = 1_048_576,  # 1M snapshots per fp32 staging buffer (~1 GB)
) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
    """
    Two-pass loader that streams JSONL into pre-allocated device tensors.

    Why two passes
    --------------
    The naive Python-list-then-asarray path peaks at ~3× the final memory
    footprint while it builds the lists. For 100M snapshots × 256 dims that's
    ~300 GB peak — way over the M5's 128 GB ceiling.

    The two-pass version peaks at:
      - device tensor at chosen dtype (50 GB at bf16, 100 GB at fp32)
      - one staging numpy chunk at fp32 (~1 GB)
      - one transient torch fp32 chunk during dtype conversion (~1 GB)

    Total peak ~52 GB at bf16 for 100M snapshots, well inside 128 GB.

    The first pass is a counting pass through the file (just to get the row
    count); the second pass actually fills the tensors. The first pass is
    cheap because we only json.loads each line — we don't keep the data.
    """
    # Sample-based estimate replaces a full count pass — for a 95 GB file
    # the count pass needs ~15 min of pure JSON parsing while sampling 200
    # lines runs in <1 second. The estimate is intentionally over by ~10%
    # so we never under-allocate; the fill loop trims trailing zeros after.
    print(f"  estimating snapshot count from sample of first 200 games...")
    n_rows = estimate_snapshots(path)
    if max_samples and n_rows > max_samples:
        n_rows = max_samples
    if n_rows == 0:
        return (
            torch.empty((0, FEATURE_DIM), dtype=dtype, device=device),
            torch.empty((0,), dtype=dtype, device=device),
            torch.empty((0,), dtype=dtype, device=device),
        )

    bytes_per_row = FEATURE_DIM * (2 if dtype == torch.bfloat16 else 4)
    est_gb = (n_rows * bytes_per_row) / (1024 ** 3)
    print(f"  estimated ~{n_rows:,} snapshots, allocating ~{est_gb:.1f} GB on {device} ({dtype})")

    X = torch.empty((n_rows, FEATURE_DIM), dtype=dtype, device=device)
    y = torch.empty((n_rows,), dtype=dtype, device=device)
    w = torch.empty((n_rows,), dtype=dtype, device=device)

    # Staging buffers — fp32 numpy is the smallest native format json yields
    X_buf = np.empty((chunk_rows, FEATURE_DIM), dtype=np.float32)
    y_buf = np.empty((chunk_rows,), dtype=np.float32)
    w_buf = np.empty((chunk_rows,), dtype=np.float32)

    print(f"  streaming JSONL into device tensors (chunks of {chunk_rows:,})...")
    written = 0
    chunk_pos = 0
    skipped_lines = 0
    skipped_games = 0
    games_used = 0
    t_start = time.time()
    last_progress = t_start

    def flush_chunk():
        nonlocal chunk_pos, written
        if chunk_pos == 0:
            return
        end = written + chunk_pos
        # numpy → torch fp32 → device → cast to dtype
        x_t = torch.from_numpy(X_buf[:chunk_pos]).to(device=device, dtype=dtype)
        y_t = torch.from_numpy(y_buf[:chunk_pos]).to(device=device, dtype=dtype)
        w_t = torch.from_numpy(w_buf[:chunk_pos]).to(device=device, dtype=dtype)
        X[written:end].copy_(x_t)
        y[written:end].copy_(y_t)
        w[written:end].copy_(w_t)
        del x_t, y_t, w_t
        written = end
        chunk_pos = 0

    # Single-pass fill. The estimated capacity is ~10% over the true count
    # so we should never overflow; if we do (estimate was too low), grow
    # the buffers in-place via torch.cat. If we have leftover capacity at
    # the end we trim.
    capacity = n_rows
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
                feats = snap.get("features")
                if not feats or len(feats) != FEATURE_DIM:
                    continue
                # Stop if we hit capacity AND the user supplied --max-samples;
                # otherwise accept that the estimate was low and accept the loss
                # of the trailing snapshots (rare with the 10% over-estimate).
                if max_samples and (written + chunk_pos) >= max_samples:
                    flush_chunk()
                    elapsed = time.time() - t_start
                    print(
                        f"  loaded {written:,} snapshots from {games_used:,} games in {elapsed:.1f}s "
                        f"(skipped {skipped_lines} bad lines, {skipped_games} games without a winner) "
                        f"— hit --max-samples cap"
                    )
                    return X[:written], y[:written], w[:written]

                if (written + chunk_pos) >= capacity:
                    # Estimate was low — flush and grow the device tensors
                    flush_chunk()
                    grow_by = max(chunk_rows, capacity // 10)
                    extra_X = torch.zeros((grow_by, FEATURE_DIM), dtype=dtype, device=device)
                    extra_y = torch.zeros((grow_by,), dtype=dtype, device=device)
                    extra_w = torch.zeros((grow_by,), dtype=dtype, device=device)
                    X = torch.cat([X, extra_X], dim=0)
                    y = torch.cat([y, extra_y], dim=0)
                    w = torch.cat([w, extra_w], dim=0)
                    capacity = X.shape[0]
                    print(f"    capacity grew to {capacity:,}")
                    del extra_X, extra_y, extra_w

                outcome = 1.0 if snap.get("active_player_id") == winner_id else 0.0
                label, weight = _label_for(outcome, t, T, margin_w, label_mode, gamma)
                X_buf[chunk_pos] = feats
                y_buf[chunk_pos] = label
                w_buf[chunk_pos] = weight
                chunk_pos += 1
                if chunk_pos >= chunk_rows:
                    flush_chunk()
                    now = time.time()
                    if now - last_progress >= 5:
                        rate = written / max(1e-6, now - t_start)
                        eta = (n_rows - written) / max(1, rate) if rate > 0 else 0
                        print(f"    streamed {written:,}/{n_rows:,} ({rate/1000:.0f}K rows/s, eta {eta:.0f}s)")
                        last_progress = now

            games_used += 1

    flush_chunk()

    elapsed = time.time() - t_start
    print(
        f"  loaded {written:,} snapshots from {games_used:,} games in {elapsed:.1f}s "
        f"(skipped {skipped_lines} bad lines, {skipped_games} games without a winner)"
    )

    if written < n_rows:
        # Trim trailing unused rows (rare — usually n_rows matches exactly)
        X = X[:written]
        y = y[:written]
        w = w[:written]

    return X, y, w


def load_simulation_data(
    path: Path,
    max_samples: int | None,
    label_mode: str,
    gamma: float,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Legacy non-chunked loader. Builds Python lists then converts to numpy.
    Peak memory ~3× final size — only safe for datasets up to ~10M snapshots
    on a 128 GB box. The chunked loader (load_simulation_data_chunked) is
    the production path for anything bigger.
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
                label, weight = _label_for(outcome, t, T, margin_w, label_mode, gamma)

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
    dtype = torch.bfloat16 if args.dtype == "bf16" else torch.float32
    print(f"Loading simulation data from {sim_path}...")
    n_total: int = 0  # set by both loader paths, used by export_weights for trainedGames

    # For datasets bigger than ~10M snapshots the legacy in-memory list-build
    # path peaks too high (~3× final size). Use the chunked streaming loader
    # by default, which pre-allocates the device tensor and streams the
    # JSONL into it via 1M-row staging buffers. The legacy path is still
    # accessible via --no-chunked for debugging.
    if args.no_chunked:
        X_np, y_np, w_np = load_simulation_data(
            sim_path,
            max_samples=args.max_samples,
            label_mode=args.label_mode,
            gamma=args.gamma,
        )
        if len(X_np) == 0:
            print("No training samples found after filtering.", file=sys.stderr)
            return 1
        n_total = len(X_np)
        print(f"  {n_total} examples, label distribution mean={y_np.mean():.3f}")
        print(f"  device: {device}, dtype: {dtype}, model: {args.model_size}")
        rng = np.random.default_rng(42)
        indices = rng.permutation(len(X_np))
        split = int(0.9 * len(X_np))
        train_idx, val_idx = indices[:split], indices[split:]
        X_train = torch.from_numpy(X_np[train_idx]).to(device=device, dtype=dtype)
        y_train = torch.from_numpy(y_np[train_idx]).to(device=device, dtype=dtype)
        w_train = torch.from_numpy(w_np[train_idx]).to(device=device, dtype=dtype)
        X_val = torch.from_numpy(X_np[val_idx]).to(device=device, dtype=dtype)
        y_val = torch.from_numpy(y_np[val_idx]).to(device=device, dtype=dtype)
        w_val = torch.from_numpy(w_np[val_idx]).to(device=device, dtype=dtype)
        del X_np, y_np, w_np
    else:
        X_all, y_all, w_all = load_simulation_data_chunked(
            sim_path,
            label_mode=args.label_mode,
            gamma=args.gamma,
            device=device,
            dtype=dtype,
            max_samples=args.max_samples,
        )
        n_total = X_all.shape[0]
        if n_total == 0:
            print("No training samples found after filtering.", file=sys.stderr)
            return 1
        # Mean label as float for logging only — small CPU op
        label_mean = float(y_all.float().mean().item())
        print(f"  {n_total:,} examples, label distribution mean={label_mean:.3f}")
        print(f"  device: {device}, dtype: {dtype}, model: {args.model_size}")
        # Permutation done on the device, then split. Avoids sending the full
        # index list back through CPU.
        gen = torch.Generator(device=device).manual_seed(42)
        perm_all = torch.randperm(n_total, device=device, generator=gen)
        split = int(0.9 * n_total)
        train_perm = perm_all[:split]
        val_perm = perm_all[split:]
        X_train = X_all[train_perm].contiguous()
        y_train = y_all[train_perm].contiguous()
        w_train = w_all[train_perm].contiguous()
        X_val = X_all[val_perm].contiguous()
        y_val = y_all[val_perm].contiguous()
        w_val = w_all[val_perm].contiguous()
        # X_all/y_all/w_all are now redundant — free their memory before training
        del X_all, y_all, w_all, perm_all, train_perm, val_perm

    model = build_model(args.model_size).to(device=device, dtype=dtype)
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
            model(torch.zeros(2, FEATURE_DIM, device=device, dtype=dtype))

    best_val = float("inf")
    best_state = None
    # autocast only useful when the resident tensors are fp32 — bf16 already
    # gets us the speedup without any cast overhead
    use_autocast = device == "mps" and not args.no_autocast and dtype == torch.float32

    print(f"\nTraining {args.epochs} epochs, batch_size={args.batch_size}, lr={args.lr}")
    if use_autocast:
        print("  autocast(fp16) enabled on MPS")
    elif dtype == torch.bfloat16:
        print("  resident bf16 tensors — autocast not needed")

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
                    # BCE with logits expects fp32 targets even under autocast
                    per = F.binary_cross_entropy_with_logits(logits.float(), yb.float(), reduction="none")
                    loss = (per * wb.float()).mean()
            else:
                logits = model(xb)
                # bf16 path: BCE-with-logits is numerically fine in bf16 because
                # the logsumexp inside it has wide enough exponent range. Cast
                # the per-sample weight to match the logits dtype to avoid the
                # implicit promotion that happens when shapes line up.
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

    export_weights(model, Path(args.output), num_games=n_total)
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
            # Numpy can't ingest bf16 directly — cast to fp32 first. The
            # final JSON serialization is fp64 anyway so we lose nothing.
            W.append(module.weight.detach().to(torch.float32).cpu().numpy().tolist())
            b.append(module.bias.detach().to(torch.float32).cpu().numpy().tolist())

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
    parser.add_argument("--dtype", default="fp32", choices=["fp32", "bf16"],
                        help="Resident tensor dtype on the device. Use bf16 for "
                             "datasets >50M snapshots to halve memory footprint.")
    parser.add_argument("--no-chunked", action="store_true",
                        help="Use the legacy in-memory list-build loader instead "
                             "of the chunked streaming loader. Don't use for "
                             "datasets >10M snapshots.")
    args = parser.parse_args()
    return train(args)


if __name__ == "__main__":
    sys.exit(main())
