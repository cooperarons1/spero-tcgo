"""
Data generation pipeline for the animation model.

Orchestrates: sample cards → random params → render frames → Gemma 4 score.
Outputs training data as JSONL for train.py.

Usage:
    python generate.py --samples 100    # small test run
    python generate.py --samples 5000   # full training set
    python generate.py --resume         # resume from checkpoint
"""

from __future__ import annotations

import argparse
import asyncio
import json
import random
import sys
import time
from pathlib import Path

import numpy as np

from schema import (
    ANIM_CONTEXTS,
    ANIM_PARAM_DIM,
    CARD_FEATURE_DIM,
    extract_card_features,
    load_cards,
    normalize_params,
    params_to_dict,
    sample_random_params,
)
from render_frames import frames_to_montage, render_animation_frames
from label import (
    SCORE_DIMENSIONS,
    LocalLLMUnavailable,
    compute_total_score,
    image_to_base64,
    score_montage,
)

# Add parent for local_client
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "llm"))
from local_client import probe_server

# ── Constants ────────────────────────────────────────────────────────

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
OUTPUT_FILE = DATA_DIR / "animation-training.jsonl"
CHECKPOINT_FILE = DATA_DIR / "animation-checkpoint.json"

# Contexts weighted by importance (entrance and attack are most common)
CONTEXT_WEIGHTS = {
    "entrance": 0.25,
    "attack":   0.20,
    "death":    0.15,
    "spell":    0.15,
    "damage":   0.10,
    "buff":     0.08,
    "draw":     0.05,
    "idle":     0.02,
}

# ── Data generation ──────────────────────────────────────────────────

def weighted_context_choice(rng: random.Random) -> str:
    """Pick an animation context weighted by importance."""
    contexts = list(CONTEXT_WEIGHTS.keys())
    weights = list(CONTEXT_WEIGHTS.values())
    return rng.choices(contexts, weights=weights, k=1)[0]


async def generate_sample(
    card: dict,
    anim_context: str,
    rng: random.Random,
    sample_id: int,
) -> dict | None:
    """Generate one training sample: render + score."""
    params_vec = sample_random_params(rng)
    params_dict = params_to_dict(params_vec)

    # Render frames
    try:
        frames = render_animation_frames(card, params_dict, anim_context)
        montage = frames_to_montage(frames)
    except Exception as e:
        print(f"  [WARN] Render failed for sample {sample_id}: {e}")
        return None

    # Score with Gemma 4
    montage_b64 = image_to_base64(montage)
    card_info = f"{card['name']} - {card['heroClass']} {card['type']} ({card.get('rarity', 'COMMON')})"

    try:
        scores = await score_montage(montage_b64, card_info=card_info)
    except LocalLLMUnavailable as e:
        print(f"  [WARN] VLM unavailable for sample {sample_id}: {e}")
        return None
    except (ValueError, json.JSONDecodeError) as e:
        print(f"  [WARN] Score parse failed for sample {sample_id}: {e}")
        return None

    total = compute_total_score(scores)

    # Build training record. target_quality is this sample's ACTUAL
    # achieved quality (normalized score) — the trainer uses this to
    # condition "these random params produced this score". Inference
    # always passes 1.0 to ask for top-quality params.
    features = extract_card_features(
        card, anim_context, target_quality=total / 100.0,
    )

    return {
        "sample_id": sample_id,
        "card_code": card.get("cardCode", ""),
        "card_name": card.get("name", ""),
        "anim_context": anim_context,
        "features": features.tolist(),
        "params": params_vec.tolist(),
        "params_normalized": normalize_params(params_vec).tolist(),
        "scores": scores,
        "total_score": total,
    }


async def generate_batch(
    cards: list[dict],
    num_samples: int,
    start_id: int = 0,
    seed: int = 42,
    checkpoint_every: int = 50,
) -> list[dict]:
    """Generate a batch of training samples with progress tracking."""
    rng = random.Random(seed)
    samples: list[dict] = []
    errors = 0
    t0 = time.time()

    for i in range(num_samples):
        sample_id = start_id + i

        # Pick random card and context
        card = rng.choice(cards)
        context = weighted_context_choice(rng)

        result = await generate_sample(card, context, rng, sample_id)
        if result is not None:
            samples.append(result)
        else:
            errors += 1

        # Progress
        done = i + 1
        elapsed = time.time() - t0
        rate = done / elapsed if elapsed > 0 else 0
        eta = (num_samples - done) / rate if rate > 0 else 0

        if done % 10 == 0 or done == num_samples:
            print(
                f"  [{done}/{num_samples}] "
                f"{len(samples)} ok, {errors} err, "
                f"{rate:.1f} samples/s, "
                f"ETA {eta:.0f}s"
            )

        # Checkpoint
        if done % checkpoint_every == 0 and samples:
            save_checkpoint(samples, start_id + done, seed)
            append_samples(samples[-checkpoint_every:])

    return samples


def append_samples(samples: list[dict]):
    """Append samples to the output JSONL file."""
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "a") as f:
        for s in samples:
            f.write(json.dumps(s) + "\n")


def save_checkpoint(samples: list[dict], next_id: int, seed: int):
    """Save checkpoint for resume capability."""
    CHECKPOINT_FILE.parent.mkdir(parents=True, exist_ok=True)
    CHECKPOINT_FILE.write_text(json.dumps({
        "next_id": next_id,
        "seed": seed,
        "num_completed": len(samples),
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }))


def load_checkpoint() -> dict | None:
    """Load checkpoint if it exists."""
    if CHECKPOINT_FILE.exists():
        return json.loads(CHECKPOINT_FILE.read_text())
    return None


# ── CLI ──────────────────────────────────────────────────────────────

async def run(args):
    # Check VLM availability
    print("Checking Gemma 4 VLM server...")
    if not await probe_server():
        print("ERROR: Gemma 4 VLM not available at", f"{args.host or 'localhost:8080'}")
        print("Start it with: mlx_lm.server --model mlx-community/gemma-4-e4b-it-8bit")
        sys.exit(1)
    print("VLM server OK")

    # Load cards
    cards = load_cards()
    print(f"Loaded {len(cards)} cards")

    # Resume support
    start_id = 0
    if args.resume:
        checkpoint = load_checkpoint()
        if checkpoint:
            start_id = checkpoint["next_id"]
            print(f"Resuming from sample {start_id} ({checkpoint['num_completed']} completed)")
        else:
            print("No checkpoint found, starting fresh")

    if not args.resume:
        # Clear output file for fresh start
        if OUTPUT_FILE.exists():
            backup = OUTPUT_FILE.with_suffix(".jsonl.bak")
            OUTPUT_FILE.rename(backup)
            print(f"Backed up existing data to {backup}")

    print(f"\nGenerating {args.samples} samples...")
    print(f"Output: {OUTPUT_FILE}")
    print(f"Seed: {args.seed}")
    print()

    samples = await generate_batch(
        cards=cards,
        num_samples=args.samples,
        start_id=start_id,
        seed=args.seed + start_id,
        checkpoint_every=args.checkpoint_every,
    )

    # Final save (any remaining samples not yet checkpointed)
    remaining = len(samples) % args.checkpoint_every
    if remaining > 0:
        append_samples(samples[-remaining:])

    # Summary
    total_samples = start_id + len(samples)
    avg_score = np.mean([s["total_score"] for s in samples]) if samples else 0

    print(f"\n{'='*50}")
    print(f"Generation complete!")
    print(f"  Total samples: {total_samples}")
    print(f"  This run: {len(samples)}")
    print(f"  Average score: {avg_score:.1f}")
    print(f"  Output: {OUTPUT_FILE}")

    if samples:
        # Score distribution
        scores = [s["total_score"] for s in samples]
        print(f"  Score range: [{min(scores):.1f}, {max(scores):.1f}]")
        print(f"  Score std: {np.std(scores):.1f}")

        # Context distribution
        ctx_counts: dict[str, int] = {}
        for s in samples:
            ctx = s["anim_context"]
            ctx_counts[ctx] = ctx_counts.get(ctx, 0) + 1
        print(f"  Context distribution: {ctx_counts}")


def main():
    parser = argparse.ArgumentParser(description="Generate animation training data")
    parser.add_argument("--samples", type=int, default=100, help="Number of samples to generate")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    parser.add_argument("--resume", action="store_true", help="Resume from checkpoint")
    parser.add_argument("--checkpoint-every", type=int, default=50, help="Checkpoint interval")
    parser.add_argument("--host", type=str, default=None, help="VLM host override")
    args = parser.parse_args()

    if args.host:
        import label
        label.LLM_HOST = args.host

    asyncio.run(run(args))


if __name__ == "__main__":
    main()
