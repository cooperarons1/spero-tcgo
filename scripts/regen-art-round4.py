#!/usr/bin/env python3
"""Round-4 regen — the 2 abstract-spell-concept cards the VLM still
flagged after round 2. Stronger SDXL prompts anchored to the exact
mechanical effect, zero-character negative.
"""
from __future__ import annotations

import time
from pathlib import Path

import torch
from PIL import Image

REPO_ROOT = Path(__file__).resolve().parent.parent
PNG_DIR = REPO_ROOT / "client" / "public" / "cards"

STRONG_NEGATIVE = (
    "character, person, figure, humanoid, creature, animal, face, body, "
    "despicable me, minion, yellow creature with goggles, overalls, pixar, "
    "robot, mech, machine, cyborg, "
    "blurry, low quality, deformed, text, watermark, logo, signature, "
    "cartoon, anime, childish, photograph, realistic, UI elements, "
    "hearthstone logo, border, frame, card template"
)

JOBS = [
    ("DRK016",
     "Adjusted Surroundings spell effect: a tree-trunk cracked in half by "
     "a pulse of emerald druid magic, uprooted roots hanging in mid-air, "
     "shockwave ripples across the forest floor, glowing green impact burst, "
     "pure nature spell effect, deep forest druid palette, painterly digital art"),
    ("DRK061",
     "Reinforcement spell effect: an empty suit of druid armor standing alone, "
     "bark and glowing roots growing up around it and bonding into taunt plates, "
     "+2/+2 green buff aura radiating outward, pure magical effect no characters, "
     "deep forest druid palette, painterly digital art"),
]


def main():
    print(f"[regen4] loading SDXL for {len(JOBS)} cards...", flush=True)
    from diffusers import StableDiffusionXLPipeline
    pipe = StableDiffusionXLPipeline.from_pretrained(
        "stabilityai/stable-diffusion-xl-base-1.0",
        torch_dtype=torch.float16, variant="fp16", use_safetensors=True,
    ).to("mps")
    pipe.set_progress_bar_config(disable=True)

    start = time.time()
    for i, (code, prompt) in enumerate(JOBS, 1):
        out = PNG_DIR / f"{code}.png"
        if out.exists():
            out.unlink()
        seed = (abs(hash(code + "_regen_round4")) % (2**31))
        gen = torch.Generator("mps").manual_seed(seed)
        t0 = time.time()
        img = pipe(prompt, negative_prompt=STRONG_NEGATIVE, num_inference_steps=40,
                   guidance_scale=9.0, height=1024, width=768, generator=gen).images[0]
        img.save(str(out))
        Image.open(out).convert("RGB").save(
            str(PNG_DIR / f"{code}.webp"), "WEBP", quality=82
        )
        elapsed = time.time() - t0
        print(f"[regen4] {i}/{len(JOBS)} {code} in {elapsed:.1f}s", flush=True)
    print(f"[regen4] done, wall {time.time()-start:.0f}s", flush=True)


if __name__ == "__main__":
    main()
