"""
Gemma 4 VLM teacher for animation quality scoring.

Takes rendered animation montages (3x2 grids of 6 frames) and asks Gemma 4
to score them on 5 quality dimensions. Outputs structured JSON scores.

Uses the existing local_client.py for the mlx_lm.server connection.
Sends montage images as base64 in the OpenAI vision API format.

Usage:
    python label.py --test                    # score a single test montage
    python label.py --input data/anim.jsonl   # batch score from JSONL
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import io
import json
import os
import sys
import time
from pathlib import Path
from typing import Optional

import httpx
from PIL import Image

# Add parent scripts dir for local_client import
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "llm"))
from local_client import LLM_HOST, TEACHER_MODEL, LocalLLMUnavailable, _check_model_allowed

# ── mlx-vlm in-process (mlx_lm.server does NOT support vision) ──
_VLM_MODEL_ID = os.environ.get("ANIM_VLM_MODEL", "mlx-community/gemma-3-4b-it-8bit")
_vlm_state: dict = {}  # lazy: {"model": ..., "processor": ..., "config": ...}


def _load_vlm():
    if _vlm_state:
        return _vlm_state
    from mlx_vlm import load as vlm_load
    print(f"[label] loading VLM {_VLM_MODEL_ID}...", flush=True)
    model, processor = vlm_load(_VLM_MODEL_ID)
    _vlm_state["model"] = model
    _vlm_state["processor"] = processor
    _vlm_state["config"] = model.config
    print(f"[label] VLM ready", flush=True)
    return _vlm_state


def _score_montage_sync(montage_b64: str, card_info: str) -> dict[str, float]:
    """Synchronous mlx-vlm call. Writes base64 to a temp file for mlx-vlm."""
    import tempfile
    from mlx_vlm import generate as vlm_generate
    from mlx_vlm.prompt_utils import apply_chat_template

    s = _load_vlm()
    prompt_text = SYSTEM_PROMPT + "\n\nCard: " + (card_info or "") + "\n\nScore this animation sequence."

    # Decode base64 → temp jpeg path (mlx-vlm generate expects file path)
    img_bytes = base64.b64decode(montage_b64)
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tf:
        tf.write(img_bytes)
        img_path = tf.name
    try:
        chat = apply_chat_template(s["processor"], s["config"], prompt_text, num_images=1)
        reply = vlm_generate(
            s["model"], s["processor"], chat, image=[img_path],
            verbose=False, max_tokens=120, temperature=0.0,
        )
        text = getattr(reply, "text", str(reply))
    finally:
        try:
            os.unlink(img_path)
        except Exception:
            pass
    return parse_scores(text)

# ── Constants ────────────────────────────────────────────────────────

SCORE_DIMENSIONS = [
    "visual_appeal",     # How visually attractive is the animation
    "smoothness",        # How fluid/natural do the transitions feel
    "impact",            # How much visual weight/punch does the animation have
    "readability",       # How easy is it to follow what's happening
    "appropriateness",   # How well does the animation fit the card type/context
]

SYSTEM_PROMPT = """\
You are an animation quality evaluator for a digital trading card game.
You will see a 3x2 grid of 6 frames showing an animation sequence for a card.
The frames progress left-to-right, top-to-bottom (frame 1 at top-left, frame 6 at bottom-right).

Score the animation on these 5 dimensions, each from 0 to 100:

1. visual_appeal: How visually attractive and polished does the animation look?
2. smoothness: How fluid and natural do the transitions between frames appear?
3. impact: How much visual weight and punch does the animation convey?
4. readability: How easy is it to follow what's happening in the animation?
5. appropriateness: How well does the animation style fit the card shown?

Respond with ONLY a JSON object, no explanation:
{"visual_appeal": N, "smoothness": N, "impact": N, "readability": N, "appropriateness": N}
"""

MAX_CONCURRENT = 4
sem = asyncio.Semaphore(MAX_CONCURRENT)


# ── Image encoding ───────────────────────────────────────────────────

def image_to_base64(img: Image.Image, quality: int = 80) -> str:
    """Encode a PIL Image to base64 JPEG string."""
    buf = io.BytesIO()
    # Convert RGBA to RGB for JPEG
    if img.mode == "RGBA":
        bg = Image.new("RGB", img.size, (18, 18, 30))
        bg.paste(img, mask=img.split()[3])
        img = bg
    img.save(buf, format="JPEG", quality=quality)
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def load_montage_base64(path: str | Path) -> str:
    """Load a montage PNG from disk and encode to base64."""
    img = Image.open(path)
    return image_to_base64(img)


# ── Gemma 4 VLM scoring ─────────────────────────────────────────────

async def score_montage(
    montage_b64: str,
    card_info: str = "",
    model: Optional[str] = None,
    timeout: float = 120.0,
) -> dict[str, float]:
    """
    Send a montage image to Gemma 4 VLM and get quality scores.

    Uses the OpenAI vision API format supported by mlx_lm.server.
    Returns dict with 5 score dimensions (0-100 each).
    """
    target_model = model or TEACHER_MODEL
    _check_model_allowed(target_model)

    user_content = []

    # Image
    user_content.append({
        "type": "image_url",
        "image_url": {
            "url": f"data:image/jpeg;base64,{montage_b64}",
        },
    })

    # Text prompt with card context
    text = "Score this animation sequence."
    if card_info:
        text = f"Card: {card_info}\n\n{text}"
    user_content.append({"type": "text", "text": text})

    payload = {
        "model": target_model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        "stream": False,
        "temperature": 0.0,
        "max_tokens": 120,
    }

    async with sem:
        try:
            return await asyncio.to_thread(_score_montage_sync, montage_b64, card_info or "")
        except Exception as e:
            raise LocalLLMUnavailable(f"VLM error: {e}") from e


def parse_scores(text: str) -> dict[str, float]:
    """Parse JSON scores from VLM response text."""
    # Try to extract JSON from the response
    text = text.strip()

    # Handle markdown code blocks
    if "```" in text:
        parts = text.split("```")
        for part in parts:
            part = part.strip()
            if part.startswith("json"):
                part = part[4:].strip()
            if part.startswith("{"):
                text = part
                break

    # Find JSON object
    start = text.find("{")
    end = text.rfind("}") + 1
    if start == -1 or end == 0:
        raise ValueError(f"No JSON found in VLM response: {text[:200]}")

    raw = json.loads(text[start:end])

    # Validate and clamp scores
    scores: dict[str, float] = {}
    for dim in SCORE_DIMENSIONS:
        val = raw.get(dim, 50)
        scores[dim] = max(0.0, min(100.0, float(val)))

    return scores


def compute_total_score(scores: dict[str, float]) -> float:
    """Weighted average of score dimensions."""
    weights = {
        "visual_appeal": 0.25,
        "smoothness": 0.20,
        "impact": 0.20,
        "readability": 0.20,
        "appropriateness": 0.15,
    }
    total = sum(scores.get(d, 50) * weights.get(d, 0.2) for d in SCORE_DIMENSIONS)
    return round(total, 2)


# ── CLI ──────────────────────────────────────────────────────────────

async def test_single():
    """Score a single test montage to verify the pipeline works."""
    from schema import load_cards, sample_random_params, params_to_dict
    from render_frames import render_animation_frames, frames_to_montage

    cards = load_cards()
    card = cards[5]
    params = params_to_dict(sample_random_params())
    print(f"Testing with card: {card['name']} ({card['heroClass']} {card['type']})")

    frames = render_animation_frames(card, params, "entrance")
    montage = frames_to_montage(frames)

    montage_b64 = image_to_base64(montage)
    print(f"Montage encoded: {len(montage_b64)} bytes base64")

    card_info = f"{card['name']} - {card['heroClass']} {card['type']} ({card['rarity']})"

    try:
        scores = await score_montage(montage_b64, card_info=card_info)
        total = compute_total_score(scores)
        print(f"\nScores:")
        for dim, val in scores.items():
            print(f"  {dim}: {val:.1f}")
        print(f"  TOTAL: {total:.1f}")
        return scores
    except LocalLLMUnavailable as e:
        print(f"\nERROR: Gemma 4 unavailable — {e}")
        print("Make sure mlx_lm.server is running on port 8080")
        return None
    except Exception as e:
        print(f"\nERROR: {e}")
        return None


def main():
    parser = argparse.ArgumentParser(description="Gemma 4 animation quality scorer")
    parser.add_argument("--test", action="store_true", help="Score a single test montage")
    parser.add_argument("--montage", type=str, help="Score a specific montage PNG file")
    args = parser.parse_args()

    if args.test:
        asyncio.run(test_single())
    elif args.montage:
        async def score_file():
            b64 = load_montage_base64(args.montage)
            scores = await score_montage(b64)
            total = compute_total_score(scores)
            print(json.dumps({**scores, "total": total}, indent=2))
        asyncio.run(score_file())
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
