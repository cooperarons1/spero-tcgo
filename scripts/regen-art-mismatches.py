#!/usr/bin/env python3
"""Regenerate SDXL art for cards the VLM audit flagged as name/art mismatches.

Uses custom prompt overrides for descriptive-name cards (weapons named after
tools, spells named after their effect, etc.) and for minions whose art
contradicts the class element (ANDERS freeze cards showing fire, etc.).

Backs up old PNGs to <cardCode>.old.png before overwriting. Regenerates
matching .webp alongside each PNG.
"""
from __future__ import annotations

import time
from pathlib import Path

import torch
from PIL import Image

REPO_ROOT = Path(__file__).resolve().parent.parent
PNG_DIR = REPO_ROOT / "client" / "public" / "cards"

NEGATIVE_BASE = (
    "blurry, low quality, deformed, text, watermark, logo, signature, "
    "cartoon, anime, childish, photograph, realistic, UI elements, "
    "hearthstone logo, border, frame, card template, human hand holding"
)

# (cardCode, prompt, extra_negative)
# Kept each prompt under ~70 tokens to avoid CLIP truncation.
JOBS = [
    # Descriptive-name weapons — must show the advertised tool/weapon
    ("NEU065",
     "Cardboard Pickaxe: a single pickaxe weapon made of cardboard and duct tape, "
     "crude miner's pickaxe with a wide flat stone-breaking head, "
     "Hearthstone trading card weapon art, weapon rendered in 3/4 view, "
     "centered, painterly digital art, warm natural palette",
     "dagger, sword, spear, blade, knife, rapier"),
    # Spells — show the actual effect
    ("DRK016",
     "Adjusted Surroundings: a landscape suddenly warping and reshaping, "
     "ground cracking and trees bending as a minion is struck by magical nature damage, "
     "spell effect art, glowing green impact burst, druid of the wild, "
     "painterly digital art, dramatic lighting, no text",
     "human, warrior, melee weapon, empty landscape"),
    ("AST026",
     "Sap: a dazed minion surrounded by swirling purple sleep-dust being magically "
     "returned to its owner's hand, bounce spell effect art, ethereal indigo glow, "
     "moonlit night, stealthy rogue palette, painterly digital art",
     "human standing, building, plain portal"),
    ("AVA027",
     "Recycle: a minion disintegrating into gears and sparks while two glowing cards "
     "materialize from the dust, salvage and draw effect, silver and gold holy palette, "
     "paladin of light, painterly digital art, dramatic lighting",
     "robot character, large machine, human figure"),
    ("AST032",
     "Prevent Destruction: a shimmering shield barrier suddenly forming around a friendly "
     "minion to block an incoming blow, taunt-granting spell effect, indigo and silver glow, "
     "moonlit, rogue palette, painterly digital art",
     "warrior with sword, paladin, nothing shielding"),
    ("DRK034",
     "Reassign: a glowing +0/+2 taunt buff being granted to a friendly creature, "
     "nature magic aura surrounding the minion, deep forest druid palette, "
     "painterly digital art, dramatic lighting",
     "landscape, tree interior, figure inside tree"),
    ("DRK035",
     "Recall: a friendly minion being swept back into the player's hand as a swirling "
     "green magical portal opens, nature-themed bounce effect with a drawn card arcing out, "
     "druid palette deep forest, painterly digital art",
     "empty portal, no cards, human figure"),
    ("DRK050",
     "Precision Strike: a single razor-thin beam of nature magic striking a minion with pinpoint accuracy, "
     "focused emerald bolt, druid of the wild, painterly digital art, dramatic lighting",
     "huge explosion, tree, fire creature"),
    ("DRK051",
     "Swipe: a massive sweeping claw strike slicing through multiple enemies, "
     "sweeping arc of emerald nature magic, druid area-of-effect damage, "
     "deep forest palette, painterly digital art, dramatic lighting",
     "single target, fire creature, static minion"),
    ("DRK061",
     "Reinforcement: a friendly minion being armored and reinforced with a glowing "
     "+2/+2 taunt aura, nature bark and leaves wrapping protectively, druid palette, "
     "painterly digital art, dramatic lighting",
     "forest entrance, empty landscape"),
    ("DRK062",
     "Moonfire: a beam of silvery moonlight striking a target with blue-white lunar fire, "
     "crescent moon above, moonlight spell effect, druid damage spell, "
     "indigo and silver palette, painterly digital art, dramatic lighting",
     "demonic wolf, red fire only, no moon"),
    ("AST036",
     "Sprint: a hooded rogue dashing through a blur of motion lines with four glowing cards "
     "arcing behind them, draw spell effect, indigo and silver palette, painterly digital art",
     "static figure, no cards, generic energy"),
    ("AST042",
     "Cold Blood: a rogue's dagger covered in freezing crystalline frost and magical +attack glow, "
     "weapon buff spell effect, indigo and silver palette, painterly digital art, dramatic lighting",
     "purple sorcerer, full figure, fire magic"),
    ("JIM038",
     "Warning Shot: a flaming arrow whizzing past a target with a trail of sparks, "
     "single ranged projectile, fiery archer palette red-orange, "
     "painterly digital art, dramatic lighting",
     "figure charging, no arrow"),
    ("TAL035",
     "Trample: a massive friendly creature charging forward and trampling through enemies, "
     "+4 attack buff aura, holy warm-gold priestly palette, painterly digital art",
     "static creature, no motion"),
    ("LUC039",
     "Sneaky Sneaky: a crouching rogue-shaman figure in the shadows giving a friendly "
     "minion a sharpened +2 attack buff glow, indigo and silver palette, "
     "painterly digital art, dramatic lighting",
     "only a dagger, empty blade"),
    ("DRK060",
     "The Architect: a master druid builder raising a wall of living roots and bark with "
     "+5 armor glow, constructive nature magic, deep forest palette, "
     "painterly digital art, dramatic lighting",
     "warrior with sword, no construction"),
    # ANDERS freeze-class minions whose art shows fire — flip to frost
    ("AND018",
     "Caspian: a frost-armored icy warrior with a freezing blade, chilling cyan breath, "
     "frozen waterfall backdrop, ice warrior palette, steel-blue, "
     "Hearthstone character portrait, painterly digital art",
     "fire, dragon, red flames, burning"),
    ("AND031",
     "Xiao: a frost-summoning ice sorceress surrounded by cyan snowflakes and "
     "crystalline ice shards, mage in icy robes, steel-blue palette, "
     "Hearthstone character portrait, painterly digital art",
     "fire, heat, orange flames, desert"),
    ("AND029",
     "Ozone: a frost elemental spirit with crystalline icy tendrils and pale cyan aura, "
     "ice warrior palette, steel-blue, Hearthstone character portrait, "
     "painterly digital art",
     "plant creature, warm tones, red"),
    ("AND030",
     "Vortex: a swirling cyclone of ice and snow with a frost elemental at its center, "
     "ice warrior palette, steel-blue, Hearthstone creature portrait, painterly digital art",
     "mechanical bird, no ice"),
    # DES shadow cards whose art is off
    ("DES037",
     "Vrasp: a lithe stealthy shadow-warlock assassin slipping between ruins, "
     "lifesteal dark aura, dark purples eerie violet palette, "
     "Hearthstone character portrait, painterly digital art",
     "large plant, no humanoid"),
    ("DES026",
     "Kabistan: a shadowy warlock seated on a throne of bones, necromantic aura, "
     "dark purples eerie violet palette, Hearthstone character portrait, "
     "painterly digital art, dramatic lighting",
     "tavern, crowd, drinking, feast"),
    ("DES027",
     "Lateo: a cloaked shadow assassin with a glowing deathrattle aura and spectral dagger, "
     "dark purples eerie violet palette, Hearthstone character portrait, "
     "painterly digital art, dramatic lighting",
     "landscape only, no figure"),
    # LUCAS storm-class minions
    ("LUC031",
     "Kato: a lightning-channeling shaman with crackling electric blue and gold aura, "
     "storm elemental, teal and gold palette, Hearthstone character portrait, "
     "painterly digital art, dramatic lighting",
     "birds, no lightning"),
    ("LUC040",
     "Tandem: a pair of storm shamans summoning a massive thundercloud together, "
     "lightning teal and gold palette, Hearthstone character portrait, painterly digital art",
     "plant creature, calm scene"),
    ("LUC037",
     "Poke: a sneaky shaman jabbing with a lightning-infused staff, stealth electric attack, "
     "teal and gold storm palette, Hearthstone character portrait, painterly digital art",
     "otters, no weapon"),
    # Name-the-animal minions where the VLM saw the wrong species
    ("DRK_BOND_02",
     "Rosie, Bottlenose Scout: a friendly bottlenose dolphin scout with intelligent eyes "
     "leaping over waves, bond partner creature, nature green palette with water accents, "
     "Hearthstone beast creature portrait, painterly digital art",
     "human woman, dry land, no water"),
    ("IZZ_BOND_01",
     "Bling, Puffin Navigator: a plucky puffin bird holding a tiny brass compass, "
     "arcane navigator, blue-purple arcane palette, "
     "Hearthstone beast creature portrait, painterly digital art",
     "human wizard, no bird"),
    ("NEU088",
     "Rhea: an ameti healer channeling warm golden life magic, priestly robes, "
     "warm-gold holy palette, Hearthstone character portrait, painterly digital art",
     "mechanical, cold tones"),
]


def main():
    assert len(JOBS) == len(set(j[0] for j in JOBS)), "duplicate cardCode in JOBS"
    print(f"[regen] loading SDXL for {len(JOBS)} cards...", flush=True)
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
        neg = NEGATIVE_BASE + ", " + extra_neg
        seed = (abs(hash(code + "_regen_v2")) % (2**31))
        gen = torch.Generator("mps").manual_seed(seed)
        t0 = time.time()
        img = pipe(prompt, negative_prompt=neg, num_inference_steps=30,
                   guidance_scale=8.0, height=1024, width=768, generator=gen).images[0]
        img.save(str(out))
        # webp
        Image.open(out).convert("RGB").save(
            str(PNG_DIR / f"{code}.webp"), "WEBP", quality=82
        )
        elapsed = time.time() - t0
        print(f"[regen] {i}/{len(JOBS)} {code} regenerated in {elapsed:.1f}s "
              f"(total {time.time()-start:.0f}s)", flush=True)
    print(f"[regen] done, wall {time.time()-start:.0f}s", flush=True)


if __name__ == "__main__":
    main()
