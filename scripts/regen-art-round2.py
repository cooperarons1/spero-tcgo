#!/usr/bin/env python3
"""Round-2 regen for cards that failed or drifted into copyright territory
after the first mismatch-fix pass. Prompts avoid the word 'minion' (which
SDXL kept resolving to Despicable Me Minions) and the still-mismatched
ones get more concrete visual prompts.
"""
from __future__ import annotations

import time
from pathlib import Path

import torch
from PIL import Image

REPO_ROOT = Path(__file__).resolve().parent.parent
PNG_DIR = REPO_ROOT / "client" / "public" / "cards"

STRONG_NEGATIVE = (
    "despicable me, minion, yellow creature, goggles, overalls, one-eyed creature, "
    "dungarees, pixar character, animation mascot, copyrighted character, "
    "blurry, low quality, deformed, text, watermark, logo, signature, "
    "cartoon, anime, childish, photograph, realistic, UI elements, "
    "hearthstone logo, border, frame, card template"
)

JOBS = [
    # Copyright-flagged
    ("DRK035",
     "Recall: a leafy druid spell sweeping a friendly creature into a swirling green "
     "nature-magic portal, with a drawn card arcing out of the vortex, "
     "emerald bounce spell effect, deep forest palette, painterly digital art",
     "character, creature with goggles, full body portrait"),
    ("DRK050",
     "Precision Strike: a single razor-thin emerald-green lightning bolt of nature magic "
     "striking a tree-trunk target with pinpoint accuracy, empty background, no character, "
     "focused impact burst, deep forest palette, painterly digital art",
     "character, figure holding staff, creature with goggles"),
    ("DRK061",
     "Reinforcement: glowing bark armor and thorned vines wrapping protectively around "
     "an empty suit of druid armor, +2/+2 taunt buff aura, nature magic shield, "
     "deep forest palette, painterly digital art",
     "character, humanoid, creature with goggles, figure"),
    # Still-mismatched spells
    ("DRK016",
     "Adjusted Surroundings: a forest clearing actively warping — roots uprooting and "
     "branches bending sharply toward one glowing tree-stump target, emerald magic burst, "
     "damage spell effect with no character, deep forest palette, painterly digital art",
     "serene landscape, character, figure"),
    ("AST026",
     "Sap: a rogue's gauntlet flicking magical purple sleep-dust at a retreating ghostly "
     "silhouette of a creature being pulled backward by misty tendrils, bounce to hand spell, "
     "indigo and silver palette, painterly digital art",
     "woman portrait, planets, cosmic background, character focus"),
    ("AVA027",
     "Recycle: an empty suit of armor dissolving into golden sparks while two glowing "
     "playing cards materialize from the dust, salvage-for-draw spell effect, "
     "holy cathedral light silver and gold palette, painterly digital art, no character",
     "gears only, machinery, character"),
    ("AST032",
     "Prevent Destruction: a translucent bubble shield forming around an empty patch of "
     "ground, deflecting an incoming sword swing, +2/+2 taunt buff spell art, "
     "indigo and silver rogue palette, painterly digital art, no character",
     "cosmic vortex, stars, galactic background"),
    ("DRK034",
     "Reassign: green nature-magic swirling around a ghostly suit of druid armor, "
     "granting +0/+2 taunt buff aura and bark-armor plating, empty background, "
     "deep forest palette, painterly digital art, no character",
     "ape creature, animal, character portrait"),
    ("DRK051",
     "Swipe: a massive sweeping arc of emerald claw-marks cutting across an empty scene, "
     "AOE damage spell effect, motion streaks, deep forest druid palette, "
     "painterly digital art, no creature",
     "character portrait, forest creature standing"),
    ("DRK060",
     "The Architect: a stone-and-root humanoid guardian with +5 armor plating made of "
     "living bark, holding a glowing emerald blueprint scroll, taunt body, "
     "deep forest palette, painterly digital art",
     "plain tree, no humanoid, character with goggles"),
    ("LUC031",
     "Kato: a male storm-shaman summoning lightning with both hands in a stormy arena, "
     "crackling electric-blue and gold bolts, teal and gold palette, "
     "Hearthstone character portrait, painterly digital art",
     "birds, calm scene, regal ruler"),
    ("LUC037",
     "Poke: a sneaky storm-shaman jabbing forward with a crackling lightning-tipped spear, "
     "stealth electric attack pose, +attack combo effect, teal and gold palette, "
     "Hearthstone character portrait, painterly digital art",
     "robed mage wielding energy, hooded figure, empty field"),
    ("LUC039",
     "Sneaky Sneaky: a hooded storm-shaman crouching low with a lightning-charged dagger, "
     "stealth +2 attack combo spell art, indigo and teal stormy palette, "
     "painterly digital art, dramatic lighting",
     "large imposing figure, regal character, no stealth"),
    ("NEU088",
     "Rhea: a kind-faced ameti healer wrapping warm golden life magic around an injured ally, "
     "priestly robes, holy restore-health aura, warm-gold holy palette, "
     "Hearthstone character portrait, painterly digital art",
     "regal queen, throne, cold tones, machinery"),
    ("TAL035",
     "Trample: a huge friendly creature crashing forward with unstoppable momentum, "
     "+4 attack buff motion streaks, dust clouds from hooves, warm-gold priestly palette, "
     "painterly digital art, dramatic lighting",
     "tiny figures being crushed, passive static pose"),
]


def main():
    assert len(JOBS) == len(set(j[0] for j in JOBS))
    print(f"[regen2] loading SDXL for {len(JOBS)} cards...", flush=True)
    from diffusers import StableDiffusionXLPipeline
    pipe = StableDiffusionXLPipeline.from_pretrained(
        "stabilityai/stable-diffusion-xl-base-1.0",
        torch_dtype=torch.float16, variant="fp16", use_safetensors=True,
    ).to("mps")
    pipe.set_progress_bar_config(disable=True)

    start = time.time()
    for i, (code, prompt, extra_neg) in enumerate(JOBS, 1):
        out = PNG_DIR / f"{code}.png"
        if out.exists():
            # Keep the .old.png backup from the first regen; overwrite the
            # most recent attempt in place.
            out.unlink()
        neg = STRONG_NEGATIVE + ", " + extra_neg
        seed = (abs(hash(code + "_regen_round2")) % (2**31))
        gen = torch.Generator("mps").manual_seed(seed)
        t0 = time.time()
        img = pipe(prompt, negative_prompt=neg, num_inference_steps=35,
                   guidance_scale=8.5, height=1024, width=768, generator=gen).images[0]
        img.save(str(out))
        Image.open(out).convert("RGB").save(
            str(PNG_DIR / f"{code}.webp"), "WEBP", quality=82
        )
        elapsed = time.time() - t0
        print(f"[regen2] {i}/{len(JOBS)} {code} regenerated in {elapsed:.1f}s "
              f"(total {time.time()-start:.0f}s)", flush=True)
    print(f"[regen2] done, wall {time.time()-start:.0f}s", flush=True)


if __name__ == "__main__":
    main()
