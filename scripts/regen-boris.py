#!/usr/bin/env python3
"""Regen Boris (NEU063) — 5/5 Taunt neutral AMETI minion. The current art
reads as a blacksmith forge rather than a taunt defender."""
from __future__ import annotations
import time
from pathlib import Path
import torch
from PIL import Image

REPO_ROOT = Path(__file__).resolve().parent.parent
PNG_DIR = REPO_ROOT / "client" / "public" / "cards"

NEG = (
    "despicable me, minion, yellow creature, goggles, overalls, pixar, "
    "blacksmith, forge, anvil, smithy, workshop, furniture, "
    "blurry, low quality, deformed, text, watermark, logo, signature, "
    "cartoon, anime, childish, photograph, realistic, UI elements, "
    "border, frame, card template"
)
PROMPT = (
    "Boris: a stoic burly male ameti warrior in rugged leather-and-fur armor "
    "holding a massive round shield forward in a defiant taunt stance, "
    "scarred face, determined glare, scuffed ground beneath him, "
    "Hearthstone trading card game character portrait, single figure, "
    "painterly digital art, dramatic warm cinematic lighting, balanced fantasy palette"
)


def main():
    print("[boris] loading SDXL...", flush=True)
    from diffusers import StableDiffusionXLPipeline
    pipe = StableDiffusionXLPipeline.from_pretrained(
        "stabilityai/stable-diffusion-xl-base-1.0",
        torch_dtype=torch.float16, variant="fp16", use_safetensors=True,
    ).to("mps")
    pipe.set_progress_bar_config(disable=True)

    out = PNG_DIR / "NEU063.png"
    backup = PNG_DIR / "NEU063.old2.png"
    if out.exists() and not backup.exists():
        out.rename(backup)
    elif out.exists():
        out.unlink()

    seed = abs(hash("NEU063_regen_boris_v2")) % (2**31)
    gen = torch.Generator("mps").manual_seed(seed)
    t0 = time.time()
    img = pipe(PROMPT, negative_prompt=NEG, num_inference_steps=40,
               guidance_scale=9.0, height=1024, width=768, generator=gen).images[0]
    img.save(str(out))
    Image.open(out).convert("RGB").save(str(PNG_DIR / "NEU063.webp"), "WEBP", quality=82)
    print(f"[boris] done in {time.time()-t0:.1f}s", flush=True)


if __name__ == "__main__":
    main()
