#!/usr/bin/env python3
"""Round-3 regen: cards where the art truly contradicts the minion type,
not just the name. User's rule: proper-noun names for animals are fine
if the art IS an animal of the right tribe. Only regen clear type
contradictions.

DRK class was rebranded from mech-tribal to druid/beast; several cards
have minionType=BEAST but art still shows mechs or humans.
"""
from __future__ import annotations

import time
from pathlib import Path

import torch
from PIL import Image

REPO_ROOT = Path(__file__).resolve().parent.parent
PNG_DIR = REPO_ROOT / "client" / "public" / "cards"

STRONG_NEGATIVE = (
    "despicable me, minion, yellow creature with goggles, overalls, pixar character, "
    "animation mascot, copyrighted character, "
    "robot, mech, machine, cyborg, gears, metal plating, "
    "blurry, low quality, deformed, text, watermark, logo, signature, "
    "cartoon, anime, childish, photograph, realistic, UI elements, "
    "hearthstone logo, border, frame, card template"
)

# Type contradictions: DRK beasts that had mechanical art
JOBS = [
    ("DRK017",
     "Andrii: a wild forest creature with glowing death-aura eyes, beast minion, "
     "deathrattle aura, moss-and-bark textures, deep forest druid palette, "
     "Hearthstone beast portrait, painterly digital art",
     "human, robot, cyborg, machine, metal armor"),
    ("DRK019",
     "Bjorn: a massive taunting brown bear warrior in the forest, roaring with "
     "protective stance, deep forest druid palette, Hearthstone beast portrait, "
     "painterly digital art, dramatic lighting",
     "robot, humanoid, metal, weapons, cyborg"),
    ("DRK020",
     "Candice: a sleek wildcat prowling through tall grass in the deep forest, "
     "beast minion, druid green palette, Hearthstone beast portrait, "
     "painterly digital art",
     "human woman, humanoid, robot, metal"),
    ("DRK026",
     "Junk: a scrappy pack-rat beast carrying a satchel of random forest trinkets, "
     "deathrattle aura, deep forest druid palette, Hearthstone beast portrait, "
     "painterly digital art",
     "mechanic, robot, machine, human"),
    ("DRK031",
     "Pero: a swift forest fox darting through underbrush, beast minion, "
     "deep forest druid palette, Hearthstone beast portrait, painterly digital art",
     "scorpion, robot, mechanical, metal"),
    ("NEU089",
     "RoRo: a pair of muscular taunting bear-warriors side-by-side, beast tribe, "
     "deathrattle aura, balanced fantasy palette, Hearthstone beast portrait, "
     "painterly digital art",
     "robot, humanoid, metal armor, cyborg"),
]


def main():
    print(f"[regen3] loading SDXL for {len(JOBS)} cards...", flush=True)
    from diffusers import StableDiffusionXLPipeline
    pipe = StableDiffusionXLPipeline.from_pretrained(
        "stabilityai/stable-diffusion-xl-base-1.0",
        torch_dtype=torch.float16, variant="fp16", use_safetensors=True,
    ).to("mps")
    pipe.set_progress_bar_config(disable=True)

    start = time.time()
    for i, (code, prompt, extra_neg) in enumerate(JOBS, 1):
        out = PNG_DIR / f"{code}.png"
        backup = PNG_DIR / f"{code}.old.png"
        if out.exists() and not backup.exists():
            out.rename(backup)
        elif out.exists():
            out.unlink()
        neg = STRONG_NEGATIVE + ", " + extra_neg
        seed = (abs(hash(code + "_regen_round3")) % (2**31))
        gen = torch.Generator("mps").manual_seed(seed)
        t0 = time.time()
        img = pipe(prompt, negative_prompt=neg, num_inference_steps=35,
                   guidance_scale=8.5, height=1024, width=768, generator=gen).images[0]
        img.save(str(out))
        Image.open(out).convert("RGB").save(
            str(PNG_DIR / f"{code}.webp"), "WEBP", quality=82
        )
        elapsed = time.time() - t0
        print(f"[regen3] {i}/{len(JOBS)} {code} in {elapsed:.1f}s "
              f"(total {time.time()-start:.0f}s)", flush=True)
    print(f"[regen3] done, wall {time.time()-start:.0f}s", flush=True)


if __name__ == "__main__":
    main()
