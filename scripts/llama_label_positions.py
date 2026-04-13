#!/usr/bin/env python3
"""
llama_label_positions.py — query Gemma 4 31B for soft labels on disagreement
positions.

Reads the queue JSONL produced by find_disagreements.py, sends each position
to Gemma 4 via mlx_lm.server, and writes a labels JSONL the trainer can
mix into the loss as a third supervision signal.

Concurrency
-----------
asyncio.Semaphore(N) — default 4 in-flight requests. mlx_lm.server serializes
most decode work on the M5 GPU so 4 is the sweet spot:
  - 1 in-flight: ~3-5 s/label, ~12-20 labels/min
  - 4 in-flight: ~1-2 s/label effective, ~30-60 labels/min
  - 8 in-flight: tail latency spikes, throughput barely improves

Resume + checkpointing
----------------------
Writes labels incrementally as they arrive (one JSONL line per label) and
remembers which position indices have already been labeled. Re-running with
the same --output file picks up where it left off — useful if you Ctrl-C
or the M5 reboots overnight.

Usage
-----
    python scripts/llama_label_positions.py \\
        --queue data/llama-queue.jsonl \\
        --output data/llama-labels.jsonl \\
        --concurrency 4 \\
        --max-positions 5000

Output JSONL line shape
-----------------------
    {
      "queue_idx": int,
      "feature_hash": "abcd1234...",  // first 16 hex chars of sha1(features)
      "hard_outcome": 0 or 1,
      "llama_score": float in [0, 1],
      "llama_confidence": float,
      "raw_response": "SCORE: 0.XX | CONF: 0.YY",
      "model": "mlx-community/gemma-4-31b-it-4bit",
      "elapsed_ms": int
    }
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import re
import sys
import time
from pathlib import Path
from typing import Optional

import numpy as np

# Reuse the local LLM client
sys.path.insert(0, str(Path(__file__).parent))
from llm.local_client import (  # noqa: E402
    TEACHER_MODEL,
    LocalLLMUnavailable,
    chat_local,
    probe_server,
)


SYSTEM_PROMPT = """You are an expert evaluator of competitive card game positions, similar to Hearthstone or Magic: the Gathering.

You'll see a snapshot of a 2-player turn-based card game. Your job: estimate the probability that the **active player** (the one whose turn it is) wins the game with optimal play from both sides.

CALIBRATION RULES:
- Early game (turns 1-8) with both players near full life: scores should be CLOSE TO 0.50 unless one side has an overwhelming board or card advantage.
- A 2-minion board advantage with both players near full life is worth about 0.05-0.15 points, NOT 0.30+.
- Reserve scores above 0.75 or below 0.25 for positions where one player is clearly losing (very low life, empty hand, massive board disadvantage).
- When uncertain, bias toward 0.50.

Reply on a SINGLE LINE in this exact format:
SCORE: 0.XX | CONF: 0.YY

Do NOT include any explanation, reasoning, or extra text. Just the SCORE/CONF line."""


USER_PROMPT_TEMPLATE = """Evaluate this position:

{summary}

Reply with the SCORE/CONF line only."""


_SCORE_RX = re.compile(r"SCORE:\s*([01]?\.\d+|[01](?:\.\d+)?)", re.IGNORECASE)
_CONF_RX = re.compile(r"CONF:\s*([01]?\.\d+|[01](?:\.\d+)?)", re.IGNORECASE)


def parse_score(text: str) -> tuple[Optional[float], Optional[float]]:
    """Pull (score, confidence) out of a 'SCORE: 0.XX | CONF: 0.YY' line.
    Returns (None, None) if either field can't be parsed."""
    score_match = _SCORE_RX.search(text)
    conf_match = _CONF_RX.search(text)
    score = float(score_match.group(1)) if score_match else None
    conf = float(conf_match.group(1)) if conf_match else None
    if score is not None:
        score = max(0.0, min(1.0, score))
    if conf is not None:
        conf = max(0.0, min(1.0, conf))
    return score, conf


def feature_hash(features: list[float]) -> str:
    """Stable hash of a feature vector — used as a join key between the
    labels file and the trainer's snapshot stream. Sha1 of the fp32
    byte representation, truncated to 16 hex chars (~64 bits, plenty for
    ~10K positions).

    Why fp32 bytes and not f"{v:.5f}" string formatting:
      - 100x faster, which matters because the trainer will hash 100M+
        snapshots when joining labels back to the training stream
      - bit-exact across the labeler and trainer because JSON numbers
        round-trip as Python fp64, and Python→numpy fp32 cast is
        deterministic
    """
    arr = np.asarray(features, dtype=np.float32)
    return hashlib.sha1(arr.tobytes()).hexdigest()[:16]


async def label_one(
    sem: asyncio.Semaphore,
    idx: int,
    item: dict,
    model: str,
    seed: int,
) -> Optional[dict]:
    """Send one position to Gemma 4 and return its parsed label, or None on
    error. Caller is responsible for incrementing the resume counter and
    writing to the output file."""
    async with sem:
        t0 = time.time()
        try:
            resp = await chat_local(
                system_prompt=SYSTEM_PROMPT,
                user_prompt=USER_PROMPT_TEMPLATE.format(summary=item["summary"]),
                model=model,
                num_predict=1024,
                temperature=0.0,
                seed=seed,
            )
        except LocalLLMUnavailable as e:
            print(f"  [{idx}] LLM unavailable: {e}", file=sys.stderr)
            return None

        elapsed_ms = int((time.time() - t0) * 1000)
        score, conf = parse_score(resp.text)
        if score is None:
            # Parse failure — log and skip. The trainer can fall back to
            # hard labels for this position.
            print(f"  [{idx}] parse failed: {resp.text!r}", file=sys.stderr)
            return None

        return {
            "queue_idx": idx,
            "feature_hash": feature_hash(item["features"]),
            "hard_outcome": item["hard_outcome"],
            "llama_score": score,
            "llama_confidence": conf if conf is not None else 0.5,
            "raw_response": resp.text.strip(),
            "model": resp.model,
            "elapsed_ms": elapsed_ms,
            "turn": item.get("turn"),
            "phase": item.get("phase"),
            "mlp_pred": item.get("mlp_pred"),
        }


def load_already_labeled(output_path: Path) -> set[int]:
    """Re-read the existing output file (if any) to find which queue
    indices have already been labeled. Used by --resume to skip them."""
    done = set()
    if not output_path.exists():
        return done
    with output_path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            if "queue_idx" in row:
                done.add(int(row["queue_idx"]))
    return done


async def main_async(args: argparse.Namespace) -> int:
    queue_path = Path(args.queue)
    if not queue_path.exists():
        print(f"Queue file not found: {queue_path}", file=sys.stderr)
        return 1

    print(f"Probing LLM server for {args.model}...")
    available = await probe_server(args.model)
    if not available:
        print(
            f"LLM server at LLM_HOST is not reachable or {args.model!r} is not loaded.\n"
            f"Start server: python -m mlx_lm.server --model {args.model} --port 8080",
            file=sys.stderr,
        )
        return 1

    queue: list[dict] = []
    with queue_path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                queue.append(json.loads(line))
            except json.JSONDecodeError:
                continue

    if args.max_positions:
        queue = queue[: args.max_positions]
    print(f"Loaded {len(queue):,} queue items from {queue_path.name}")

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    already_done = load_already_labeled(output_path) if args.resume else set()
    if already_done:
        print(f"  resume: {len(already_done):,} positions already labeled, skipping")

    todo = [(i, item) for i, item in enumerate(queue) if i not in already_done]
    if not todo:
        print("nothing to do")
        return 0

    print(f"Labeling {len(todo):,} positions with {args.model} (concurrency {args.concurrency})")

    sem = asyncio.Semaphore(args.concurrency)
    out_file = output_path.open("a", encoding="utf-8")
    out_lock = asyncio.Lock()

    n_ok = 0
    n_fail = 0
    t_start = time.time()
    last_progress = t_start

    async def label_and_write(idx: int, item: dict) -> None:
        nonlocal n_ok, n_fail, last_progress
        result = await label_one(sem, idx, item, args.model, args.seed + idx)
        async with out_lock:
            if result is None:
                n_fail += 1
            else:
                out_file.write(json.dumps(result) + "\n")
                out_file.flush()
                n_ok += 1
            now = time.time()
            if now - last_progress >= 30:
                done = n_ok + n_fail
                rate = done / max(0.001, now - t_start)
                eta_min = (len(todo) - done) / max(0.01, rate) / 60
                print(
                    f"  {done:,}/{len(todo):,}  ok={n_ok}  fail={n_fail}  "
                    f"{rate:.2f} labels/s  eta {eta_min:.0f}m"
                )
                last_progress = now

    await asyncio.gather(*(label_and_write(idx, item) for idx, item in todo))

    out_file.close()
    elapsed_min = (time.time() - t_start) / 60
    print(
        f"\nDone in {elapsed_min:.1f} min — labeled {n_ok}, failed {n_fail} "
        f"({n_ok / max(1, len(todo)) * 100:.1f}% success)"
    )
    return 0 if n_ok > 0 else 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Query Gemma 4 for soft labels on disagreement positions")
    parser.add_argument("--queue", default="data/llama-queue.jsonl")
    parser.add_argument("--output", default="data/llama-labels.jsonl")
    parser.add_argument("--model", default=TEACHER_MODEL)
    parser.add_argument("--concurrency", type=int, default=4)
    parser.add_argument("--max-positions", type=int, default=None)
    parser.add_argument("--seed", type=int, default=42,
                        help="Per-call seed base; each position gets seed+idx")
    parser.add_argument("--resume", action="store_true",
                        help="Skip queue indices already in the output file")
    args = parser.parse_args()
    return asyncio.run(main_async(args))


if __name__ == "__main__":
    sys.exit(main())
