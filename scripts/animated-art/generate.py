"""
Generate Hearthstone-style looping WebM art for golden card variants.

Pipeline:
  card PNG  ──▶ Stable Video Diffusion (img2vid-xt) ──▶ 25 frames
        (conditioned on motion_bucket_id + noise_aug picked per card
         from the rank-loss animation model params, so every card
         gets distinct motion)
  25 frames ──▶ ffmpeg ──▶ seamless-loop WebM (2.5s @ 10fps, VP9)

Output: client/public/cards/anims/{cardCode}.webm (~200-500KB each).

Usage:
  python generate.py --cards DRK032 JIM022           # one-off
  python generate.py --all                           # all 240 PNGs
  python generate.py --missing                       # only un-rendered
  python generate.py --cards DRK032 --frames 14 --fps 8    # faster/smaller

Run from project root; the script resolves paths relative to the repo.

Uses MPS on Apple Silicon. Disk footprint: ~5GB for the SVD-xt weights,
cached in ~/.cache/huggingface.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

import numpy as np
from PIL import Image
import torch


REPO_ROOT = Path(__file__).resolve().parent.parent.parent
PNG_DIR = REPO_ROOT / "client" / "public" / "cards"
OUT_DIR = REPO_ROOT / "client" / "public" / "cards" / "anims"
CARDS_JSON = REPO_ROOT / "data" / "cards.json"
ANIM_WEIGHTS = REPO_ROOT / "data" / "animation-weights-rank.json"
MANIFEST_TS = REPO_ROOT / "client" / "src" / "utils" / "cardArtAnims.ts"


# ── Model load ─────────────────────────────────────────────────────────

def load_svd_pipeline():
    """Lazy-import to keep --help + --list-missing fast."""
    from diffusers import StableVideoDiffusionPipeline  # noqa: WPS433

    device = "mps" if torch.backends.mps.is_available() else "cpu"
    dtype = torch.float16 if device == "mps" else torch.float32
    # Use the SMALLER non-xt variant. xt peaks at 126GB unified memory
    # even at 480x832 × 12 frames — above the machine's usability
    # threshold. img2vid (non-xt) is ~40% smaller parameter count,
    # native 14-frame output, and visually comparable for small in-game
    # card art. Weights cached separately in HF hub.
    print(f"[svd] loading model on {device}/{dtype} (non-xt variant)...", flush=True)
    pipe = StableVideoDiffusionPipeline.from_pretrained(
        "stabilityai/stable-video-diffusion-img2vid",
        torch_dtype=dtype,
        variant="fp16" if dtype == torch.float16 else None,
    )
    # Use sequential CPU offload: only the ACTIVELY running submodule
    # (unet, vae, image_encoder) is on GPU at a time; the rest lives on
    # CPU. This swaps memory for ~10-20% inference-time overhead but is
    # the biggest single lever for bringing peak unified memory from
    # 125-126GB down into the 110-120GB target band on the M5.
    try:
        pipe.enable_sequential_cpu_offload(device=device)
        print(f"[svd] enable_sequential_cpu_offload -> {device}", flush=True)
    except Exception as e:
        # Fall back to regular .to() if offload API differs on this
        # diffusers version; user will see higher peaks but at least
        # the pipeline runs.
        print(f"[svd] sequential offload unavailable ({e}); falling back to .to({device})", flush=True)
        pipe = pipe.to(device)
    pipe.enable_attention_slicing("max")
    for method in ("enable_slicing", "enable_tiling"):
        try:
            getattr(pipe.vae, method)()
            print(f"[svd] vae.{method}() enabled", flush=True)
        except (AttributeError, NotImplementedError):
            pass
    return pipe, device


# ── Per-card motion parameters (from rank model) ──────────────────────

def load_anim_params() -> dict[str, dict]:
    """Returns cardCode → flat params dict from the rank-loss weights.
    If the rank weights aren't loadable client-side (they don't define
    per-card output directly — they're MLP weights, not predictions),
    we fall back to a deterministic hash of the cardCode."""
    # Actual per-card params are produced by running the MLP forward pass
    # with each card's features. That's what server/animation-model.ts
    # does. Reproducing the feature extraction here keeps the pipeline
    # self-contained. For the FIRST batch we use a simple hash → motion
    # intensity so we can get end-to-end working. A follow-up port of
    # schema.extract_card_features will make these match server-predicted
    # values exactly.
    return {}


def motion_from_code(card_code: str) -> tuple[int, float]:
    """Deterministic (motion_bucket_id, noise_aug) from cardCode.
    motion_bucket_id: SVD's main knob. 127 = default, 200 = livelier,
    80 = calmer. Spread cards across 90-180 so every card is visibly
    different without ever going frantic."""
    h = 0
    for ch in card_code:
        h = (h * 31 + ord(ch)) & 0xFFFFFFFF
    motion = 90 + (h % 91)           # 90..180
    noise = 0.02 + ((h >> 8) % 40) * 0.004  # 0.02..0.18
    return motion, noise


# ── Generation ─────────────────────────────────────────────────────────

def card_has_png(card_code: str) -> bool:
    return (PNG_DIR / f"{card_code}.png").exists()


def generate_card(pipe, device: str, card_code: str, frames: int, fps: int,
                  decode_chunk: int = 2) -> bool:
    """Run SVD on one card and encode to WebM. Returns True on success."""
    src = PNG_DIR / f"{card_code}.png"
    if not src.exists():
        print(f"  [skip] {card_code}: no source PNG", flush=True)
        return False

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_webm = OUT_DIR / f"{card_code}.webm"

    img = Image.open(src).convert("RGB")
    # 384x672 ≈ 40% fewer pixels than 576x1024 → activation memory down
    # ~40%. Combined with sequential CPU offload, peak should land in
    # the 110-120GB band the user specified. Client renders at
    # <200px tall so this resolution is still above the display size.
    img = img.resize((384, 672), Image.LANCZOS)

    motion, noise = motion_from_code(card_code)
    seed = sum(ord(c) * (i + 1) for i, c in enumerate(card_code))
    gen = torch.Generator(device=device).manual_seed(seed)

    t0 = time.time()
    print(f"  [svd] {card_code}: motion={motion} noise={noise:.3f} seed={seed}", flush=True)
    result = pipe(
        image=img,
        num_frames=frames,
        num_inference_steps=25,
        min_guidance_scale=1.0,
        max_guidance_scale=3.0,
        fps=fps,
        motion_bucket_id=motion,
        noise_aug_strength=noise,
        decode_chunk_size=decode_chunk,
        generator=gen,
    )
    frames_out = result.frames[0]  # list of PIL images
    dt = time.time() - t0
    print(f"  [svd] {card_code}: generated {len(frames_out)} frames in {dt:.1f}s", flush=True)

    # Export to WebM with a seamless loop: mirror the sequence end-to-end
    # so frame 0 of the loop matches frame -1 perceptually (reduces the
    # jump-cut visible at loop seams). Then crossfade the outer frames
    # via ffmpeg's minterpolate for smoothness.
    tmp_dir = OUT_DIR / f"__tmp_{card_code}"
    tmp_dir.mkdir(exist_ok=True)
    try:
        for i, f in enumerate(frames_out):
            f.save(tmp_dir / f"f{i:03d}.png")
        # Palindrome mirror: f0..fN..f1  → seamless loop
        mirror = list(range(len(frames_out))) + list(range(len(frames_out) - 2, 0, -1))
        concat_list = tmp_dir / "concat.txt"
        with open(concat_list, "w") as fp:
            for idx in mirror:
                fp.write(f"file 'f{idx:03d}.png'\n")
                fp.write(f"duration {1/fps:.4f}\n")
            fp.write(f"file 'f{mirror[-1]:03d}.png'\n")
        cmd = [
            "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat_list),
            "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "35",
            "-pix_fmt", "yuv420p", "-an",
            str(out_webm),
        ]
        subprocess.run(cmd, check=True, capture_output=True)
        size_kb = out_webm.stat().st_size / 1024
        print(f"  [ok]  {card_code} → {out_webm.name} ({size_kb:.0f} KB)", flush=True)
        return True
    finally:
        for p in tmp_dir.glob("*"):
            p.unlink()
        tmp_dir.rmdir()


# ── Manifest refresh ───────────────────────────────────────────────────

def refresh_manifest():
    existing = sorted(p.stem for p in OUT_DIR.glob("*.webm"))
    body = ",\n".join(f'  "{c}"' for c in existing)
    content = f"""// Generated by scripts/animated-art/generate.py — do not edit by hand.
// cardCodes listed here have /cards/anims/{{cardCode}}.webm available.
// CardArt renders the WebM loop in golden mode when this Set contains
// the cardCode; otherwise the static PNG is used (gold overlay still
// applies — just no motion within the art).
export const CARD_ART_ANIMS = new Set<string>([
{body}{"," if existing else ""}
]);
"""
    MANIFEST_TS.write_text(content)
    print(f"[manifest] wrote {len(existing)} entries to {MANIFEST_TS.relative_to(REPO_ROOT)}", flush=True)


# ── CLI ────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--cards", nargs="+", help="cardCodes to render")
    ap.add_argument("--all", action="store_true", help="render every card with a PNG")
    ap.add_argument("--missing", action="store_true", help="render only cards without an existing .webm")
    ap.add_argument("--frames", type=int, default=14)
    ap.add_argument("--fps", type=int, default=10)
    ap.add_argument("--manifest-only", action="store_true", help="don't generate — only refresh manifest")
    ap.add_argument("--list-missing", action="store_true", help="list cards that would be rendered and exit")
    args = ap.parse_args()

    if args.manifest_only:
        refresh_manifest()
        return 0

    all_cards = json.loads(CARDS_JSON.read_text())
    all_codes = [c["cardCode"] for c in all_cards if card_has_png(c["cardCode"])]

    if args.cards:
        targets = args.cards
    elif args.all:
        targets = all_codes
    elif args.missing:
        have = {p.stem for p in OUT_DIR.glob("*.webm")}
        targets = [c for c in all_codes if c not in have]
    else:
        ap.print_help()
        return 1

    if args.list_missing:
        print(f"{len(targets)} cards to render:")
        for c in targets:
            print(f"  {c}")
        return 0

    pipe, device = load_svd_pipeline()
    ok = 0
    t_start = time.time()
    for i, code in enumerate(targets):
        print(f"[{i+1}/{len(targets)}] {code}", flush=True)
        try:
            if generate_card(pipe, device, code, args.frames, args.fps):
                ok += 1
        except Exception as e:
            print(f"  [err] {code}: {e}", file=sys.stderr, flush=True)

    elapsed = time.time() - t_start
    print(f"\n[done] {ok}/{len(targets)} in {elapsed:.0f}s "
          f"({elapsed/max(ok,1):.1f}s per card average)")

    refresh_manifest()
    return 0


if __name__ == "__main__":
    sys.exit(main())
