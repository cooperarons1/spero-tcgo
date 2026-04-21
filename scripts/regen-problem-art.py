#!/usr/bin/env python3
"""Regenerate SDXL art for specific cards with custom prompts.

Used to fix flagged art issues: inappropriate content, copyright lookalikes
(Minions movie etc.), art that doesn't match the card (Frost Shock had a
crab?), and tokens that should be object-only not character portraits.

Usage:
    python scripts/regen-problem-art.py               # all entries below
    python scripts/regen-problem-art.py --codes COIN  # specific card
"""
from __future__ import annotations

import argparse
import time
from pathlib import Path

import torch

REPO_ROOT = Path(__file__).resolve().parent.parent
PNG_DIR = REPO_ROOT / "client" / "public" / "cards"

# Stronger no-go list on top of the generic negative prompt.
STRONG_NEGATIVE = (
    "blurry, low quality, deformed, text, watermark, logo, signature, "
    "cartoon, anime, childish, UI elements, border, frame, card template, "
    "nudity, nude, topless, exposed breasts, revealing, suggestive, "
    "Minions from Despicable Me, yellow Minion characters, Bob the Minion, "
    "Kevin the Minion, pixar characters, disney characters, pokemon, "
    "dragon ball, naruto, one piece"
)

BASE = (
    "Hearthstone trading card game art, dynamic fantasy illustration, "
    "painterly digital art, dramatic lighting, vivid colors, centered "
    "composition, no text, no border, no frame"
)

# cardCode → custom prompt. Each describes *only* the subject; BASE is
# appended automatically.
OVERRIDES = {
    # ─── Spells: no character, just the effect ───
    "LUC045": (  # Lightning Bolt
        "A single crackling bolt of blue-white lightning arcing through "
        "a dark stormy sky, electric energy, no characters, no people, "
        "pure elemental effect, close-up lightning"
    ),
    "LUC035": (  # Frost Shock
        "A burst of icy-blue frost magic, jagged ice shards, frost mist, "
        "freezing crystalline energy, no characters, no people, "
        "pure ice spell effect"
    ),
    "LUC047": (  # Lightning Storm
        "Multiple lightning bolts striking down from storm clouds across "
        "a battlefield, electric chaos, no characters, pure elemental "
        "storm effect"
    ),
    "LUC048": (  # Chain Lightning
        "A branching chain of lightning arcing between targets, blue-white "
        "electric crackle, no characters, no people, pure elemental "
        "spell effect"
    ),
    "IZZ021": (  # Arcane Missiles
        "Three glowing purple arcane missiles streaking through dark "
        "space, magical energy trails, no characters, pure spell effect"
    ),
    "IZZ022": (  # Blizzard
        "A swirling blue-white blizzard storm, driving snow and ice "
        "shards, freezing vortex, no characters, pure weather effect"
    ),
    "IZZ038": (  # Frostbolt
        "A single blue icy projectile streaking forward, frost trailing "
        "behind, no characters, pure cold spell effect"
    ),
    "IZZ042": (  # Flamestrike
        "A wall of orange-red flames erupting across the ground, fiery "
        "blast, no characters, pure fire spell effect"
    ),
    "DRK033": (  # Innervate
        "Green nature energy swirling up from roots and vines, glowing "
        "mana particles, druid-green palette, no characters, pure nature "
        "spell effect"
    ),
    "DRK063": (  # Wild Growth
        "Vines and roots bursting up from the ground with glowing green "
        "mana crystals growing on them, no characters, pure nature effect"
    ),
    "DRK070": (  # Nourish
        "A glowing green goblet overflowing with mana energy, forest "
        "backdrop with sunlight streaming through leaves, no characters, "
        "close-up object"
    ),
    "DRK051": (  # Swipe
        "Three long curved claw marks slashed across the frame, blue-white "
        "feral energy trailing the slashes, no characters, pure claw "
        "attack effect"
    ),
    "DRK072": (  # Savage Roar
        "A sound-wave visual of a fierce roar, vibration rings and feral "
        "amber light expanding outward from the center, no characters, "
        "pure primal energy"
    ),

    # ─── Tokens: objects / creatures, not characters ───
    "AVA_TOKEN_01": (  # Gadget Drone
        "A small mechanical quadcopter drone with glowing blue eye sensor, "
        "metallic body with exposed wiring, hovering in a clean workshop "
        "backdrop, product-shot composition, no people, no characters"
    ),
    "AVA_TOKEN_02": (  # Guardian Drone
        "A larger armored quadcopter drone with a small energy shield "
        "projector, silver and gold plating, hovering in front of a "
        "cathedral backdrop, no people, no characters"
    ),
    "NEU_TOKEN_03": (  # Squire
        "A young armored page boy, full plate armor too big for him, "
        "holding a spear taller than he is, determined face under a "
        "helmet, medieval castle courtyard backdrop"
    ),
    "NEU_TOKEN_02": (  # Tuskling
        "A small baby boar with little tusks and fluffy fur, woodland "
        "clearing backdrop, cute but fierce beast, no humans"
    ),
    "NEU_TOKEN_01": (  # Scrap Golem
        "A crude humanoid made of scrap metal, bolts, and gears, glowing "
        "orange core in its chest, junkyard backdrop, no humans"
    ),
    "NEU_TOKEN_04": (  # Spirit of Thorn
        "A massive walking thorned tree-spirit with glowing green eyes, "
        "vines wrapping its trunk, enchanted forest backdrop, no humans"
    ),
    "NEU_TOKEN_RECRUIT": (  # Silver Hand Recruit
        "A young peasant soldier in simple silver-trimmed leather armor, "
        "holding a small sword and shield, full-body view, castle "
        "backdrop, determined expression, single character"
    ),
    "AST_TOKEN_01": (  # Guardian
        "A knight in heavy plate armor holding a tall kite shield "
        "defensively, full-body view, castle gate backdrop, single "
        "character"
    ),
    "AST_TOKEN_02": (  # Shield Squire
        "A young knight-in-training in partial plate armor with a large "
        "kite shield, full-body view, training yard backdrop, single "
        "character"
    ),
    "IZZ_TOKEN_01": (  # Sparkle Shard
        "A glowing crystalline shard of arcane energy floating above the "
        "ground, sparkles orbiting it, purple-blue arcane palette, no "
        "humans, no characters, pure object"
    ),
    "AST_TOKEN_DAGGER": (  # Wicked Knife
        "A single ornate rogue's dagger in 3/4 view, black blade with "
        "silver edge detailing, wrapped leather grip, displayed on dark "
        "stone, product-shot composition, no people"
    ),

    # ─── Orbs: floating magical spheres, not characters ───
    "LUC_ORB_FIRE": (
        "A floating orb of swirling orange-red fire, glowing lava-like "
        "surface, levitating above dark stone, no humans, pure magical "
        "sphere object"
    ),
    "LUC_ORB_WATER": (
        "A floating orb of swirling blue water with splashing droplets "
        "around it, glowing cyan glow, levitating above dark stone, no "
        "humans, pure magical sphere object"
    ),
    "LUC_ORB_AIR": (
        "A floating orb of swirling white-gray wind currents and lightning "
        "sparks, glowing pale-blue aura, levitating above dark stone, no "
        "humans, pure magical sphere object"
    ),
    "LUC_ORB_HEALING": (
        "A floating orb of soft golden-green healing light with glowing "
        "petals drifting around it, levitating above mossy stone, no "
        "humans, pure magical sphere object"
    ),

    # ─── Cards previously flagged for inappropriate content ───
    "LUC049": (  # Ancestral Knowledge
        "An ancient glowing spellbook open in mid-air, ghostly runes "
        "floating off the pages, amber firelight, shaman totems around "
        "the edges, no humans, no characters, pure object scene"
    ),
    "LUC046": (  # Far Sight
        "A shaman's crystal ball floating above an ornate pedestal, "
        "visions swirling inside, misty blue-green aura, no humans "
        "visible through the ball"
    ),
    "LUC021": (  # Rockbiter Weapon
        "A single stone-imbued axe with orange-red glowing runes, close-up "
        "product shot on dark rock, no humans"
    ),
    "LUC027": (  # Ancestral Recall
        "A glowing shamanic totem pole pulsing with green spirit light, "
        "misty ethereal figures fading into it, no humans in foreground"
    ),
    "LUC029": (  # Crushing Wave
        "A massive cresting wall of blue ocean water roaring forward, "
        "wall of surf with crashing whitecaps and spray, no humans, "
        "pure elemental wave, storm sky backdrop"
    ),
    "LUC047": (  # Lightning Storm
        "A raging electrical storm over a dark plain, heavy dark clouds, "
        "multiple lightning strikes hitting the ground, sheets of rain, "
        "no humans, no characters, atmospheric storm scene only"
    ),
    "AND_S03": (  # Frost Barrier
        "A towering wall of jagged blue ice shards forming a defensive "
        "barrier, frost mist swirling in front, no humans, no shields, "
        "pure ice-wall scene"
    ),

    # ─── Weapons / equipment — ONLY the item, no human, no hand, no arm ───
    "AST027": (  # Assassin's Blade
        "An ornate rogue's longsword displayed on dark stone, black "
        "blade with silver filigree, wrapped leather grip, product-shot "
        "composition, no people, no hands, no arms, isolated weapon"
    ),
    "AST030": (  # Poisoned Dagger
        "A single curved dagger with green dripping poison from the "
        "blade, resting on black velvet, close-up product shot, no "
        "people, no hands, no arms, no holding, isolated weapon"
    ),
    "AST035": (  # Shadow Dagger
        "A single obsidian dagger with wisping purple-black shadow smoke "
        "curling off the blade, floating above a stone altar, no people, "
        "no hands, no arms, isolated weapon product shot"
    ),
    "JIM034": (  # Spear of Penetration
        "An ornate fire-forged spear with a glowing red-orange tip, "
        "displayed on weapon rack, no people, no hands, no arms, "
        "isolated weapon product shot"
    ),
    "DES039": (  # Orra Siphon Blade
        "A curved shadow blade with purple orra-crystal embedded in the "
        "pommel, dark smoky aura, displayed on dark stone, no people, "
        "no hands, isolated weapon product shot"
    ),
    "DES040": (  # Dominion Control Rod
        "An ornate dark metal rod with glowing purple crystal at the "
        "tip, dominion sigils etched on the shaft, floating above a "
        "dark pedestal, no people, no hands, isolated object"
    ),
    "DES041": (  # Crucible Scythe
        "A massive black scythe with a glowing crucible orb embedded in "
        "the curve, dark smoke wisps, displayed on black stone, no "
        "people, no hands, isolated weapon product shot"
    ),
    "LUC042": (  # Stormcaller Staff
        "An ornate wooden staff with lightning crackling around the "
        "top, stormcaller runes, floating above grass, no people, no "
        "hands, isolated object"
    ),
    "LUC026": (  # Spirit Claws
        "A pair of ornate tribal claw-weapons with glowing spirit-blue "
        "runes, displayed on carved wood, no people, no hands, isolated "
        "weapon product shot"
    ),
    "DRK030": (  # Living Branch
        "A druidic wooden staff still sprouting green leaves and small "
        "vines, carved runes glowing soft green, floating in a forest "
        "clearing, no people, no hands, isolated object"
    ),
    "DRK038": (  # Thorned Cudgel
        "A heavy wooden cudgel wrapped in thorned vines with small "
        "red blood droplets, displayed on mossy stone, no people, no "
        "hands, isolated weapon product shot"
    ),
    "IZZ032": (  # Net Launcher
        "A stylized crossbow-like net launcher, arcane blue-purple runes "
        "on the mechanism, displayed on a workbench, no people, no "
        "hands, isolated object"
    ),
    "AND021": (  # Fiddle of Silence
        "An ornate fiddle with frost-etched runes along the body, icy "
        "bow resting across the strings, floating above snow, no "
        "people, no hands, isolated object"
    ),
    "AND027": (  # Lightning Rod of Damage
        "A tall metal lightning rod with crackling electric blue energy "
        "coiling around it, struck vertical into stone, no people, "
        "no hands, isolated object"
    ),
    "NEU065": (  # Cardboard Pickaxe
        "A humble pickaxe with a wooden haft and rough-hammered iron "
        "head, propped against a cave wall, no people, no hands, "
        "isolated weapon product shot"
    ),
    "NEU090": (  # Short Sword
        "A simple medieval short sword with steel blade and leather grip, "
        "displayed on dark wood, no people, no hands, isolated weapon "
        "product shot"
    ),
    "TAL022": (  # Harvesting Scythe
        "A curved farming scythe with a polished wooden haft, vines and "
        "wheat wrapping the shaft, leaning against a barn wall, no "
        "people, no hands, isolated object"
    ),
    "TAL030": (  # Pineapple Armor
        "A suit of druidic plate armor made of layered pineapple-shaped "
        "scales, golden-brown palette, displayed on an armor stand, no "
        "people, no hands, isolated object"
    ),
    "AST_TOKEN_DAGGER": (  # Wicked Knife — tighter than original
        "A single wicked rogue's dagger with hooked tip and black blade, "
        "floating above dark stone, no people, no hands, no arms, "
        "isolated weapon product shot"
    ),

    # ─── Bond minions that need creature-accurate poses ───
    "LUC_BOND_02": (  # Owl Sketch
        "A realistic great horned owl perched on a tree branch, feathers "
        "ruffled, amber eyes glowing, deep forest backdrop, naturalistic "
        "wildlife illustration, no humanoid features, no human form, "
        "pure owl creature, four feathered limbs"
    ),
    "DRK_BOND_01": (  # Sengo, Shadow Leopard
        "A large black leopard with glowing emerald eyes prowling on "
        "all four legs, shadow smoke wisping off its fur, low "
        "stalking pose, jungle shadows backdrop, quadrupedal, full "
        "leopard body, no humanoid anatomy, no exposed anatomy, "
        "naturalistic wildlife illustration"
    ),
    "JIM_BOND_02": (  # Bella, Snow Guardian — should be a snow wolf
        "A majestic white arctic snow wolf with glowing blue eyes "
        "standing watchfully in deep snow, heavy winter fur, four legs "
        "firmly on the ground, pine forest and snowy mountains "
        "backdrop, naturalistic wildlife illustration, no humanoid "
        "features, full wolf body"
    ),
    "JIM_BOND_01": (  # Otto, Loyal Otter
        "A fluffy river otter holding a small trinket in its paws, "
        "playful and alert pose, riverside backdrop with forest, "
        "naturalistic wildlife illustration, no humanoid features, "
        "four-limbed otter creature"
    ),
    "TAL_BOND_01": (  # Snowball, Arctic Scout
        "A small white arctic fox with a blue scarf, sitting alert in "
        "fresh snow, bright intelligent eyes, pine forest backdrop, "
        "naturalistic wildlife illustration, no humanoid features"
    ),
    "AND_BOND_01": (  # Frostfang
        "A massive ice-scaled serpent with glowing blue fangs coiled on "
        "frozen ground, frost mist rising off its body, quadrupedal "
        "head on coils, no humanoid features"
    ),

    # ─── Orra Echoes — residual imprints of the world's ambient energy.
    #      cardCodes stay LUC_ORB_* for engine compatibility; display
    #      names + flavors are Surge / Aegis / Weave / Flow. Prompts
    #      describe translucent ethereal silhouettes — not solid orbs. ───
    "LUC_ORB_FIRE": (  # Surge — 1/1 aggressive
        "A translucent orange-red ethereal silhouette of raw energy "
        "lunging forward, ember particles trailing behind, shaped like "
        "a ribbon of flame mid-strike, dark stone backdrop, no humans, "
        "pure glowing residual imprint, painterly fantasy illustration"
    ),
    "LUC_ORB_WATER": (  # Guard — 0/2 Taunt defender
        "A translucent blue-silver ethereal silhouette of a towering "
        "barrier of stacked shimmering plates, glowing defensive runes, "
        "wisps of protective energy curling around it, dark stone "
        "backdrop, no humans, pure protective imprint, painterly "
        "fantasy illustration"
    ),
    "LUC_ORB_AIR": (  # Weave — 0/2 Spell Damage +1
        "A translucent white-purple ethereal silhouette of interwoven "
        "threads of arcane light, braided glowing filaments in a vertical "
        "column, crackling spellfire at the tips, dark stone backdrop, "
        "no humans, pure spellpower imprint"
    ),
    "LUC_ORB_HEALING": (  # Flow — 0/2 end-of-turn heal
        "A translucent green-gold ethereal silhouette of flowing life "
        "energy curling upward like a slow fountain, glowing petals "
        "drifting around it, mossy stone backdrop, no humans, pure "
        "restorative imprint, painterly fantasy illustration"
    ),

    # ─── Name↔type coherence fixes handled in the cards.json pass,
    #      but the prompts here ensure the art matches the new names. ───
    "IZZ_BOND_02": (  # Sparkle Compass — was MECH-tribed but name doesn't
                      # fit mech; retheme art as an arcane navigational
                      # instrument, retribed to AMETI in cards.json.
        "An ornate enchanted brass compass floating above an open "
        "spellbook, glowing blue arcane runes radiating from the needle, "
        "starlit desk backdrop, no humans, pure arcane object"
    ),
    "TAL_BOND_02": (  # Tala's Ice Orb — simplify to just the orb
        "A single floating sphere of blue-white ice swirling with frost "
        "mist and snowflakes, suspended above snowy ground, glowing "
        "cold aura, pine backdrop, no humans, pure magical object"
    ),

    # ─── Secret spells — should show a trap/ward effect, NOT a character ───
    "AST_S02": (  # Second Chance (resurrect)
        "A translucent golden-white spirit form rising from a fallen "
        "broken sword on dark stone, wisps of resurrection light, warm "
        "holy glow, no humans, no character, pure secret/revival effect"
    ),
    "AST_S01": (  # Guardian's Oath
        "A glowing golden rune circle on dark stone ground, vows of "
        "protection etched in light, shield-shaped ward, no humans, "
        "pure secret ward effect"
    ),
    "AST_S03": (  # Retribution
        "A glowing red sword sigil hovering over a battlefield, "
        "vengeful red-gold light, no humans, pure secret trap effect"
    ),
    "JIM_S01": (  # Ember Trap
        "A circular fire-rune trap on stone ground, ember particles "
        "rising from the sigil, no humans, pure trap effect"
    ),
    "JIM_S02": (  # Blaze Snare
        "A glowing orange flame-loop snare on the ground, fiery trap "
        "rune at the center, no humans, pure trap effect"
    ),
    "JIM_S03": (  # Searing Arrow
        "A fiery red-orange arrow hanging in midair, embers trailing, "
        "trap-rune glow underneath, no humans, pure trap effect"
    ),
    "AND_S01": (  # Runic Counter
        "A glowing blue ice-rune ward floating in the air, arcane "
        "circle on frozen ground, no humans, pure counter-spell effect"
    ),
    "AND_S02": (  # Mirror Reflection
        "An ornate floating blue crystal mirror on a snowy pedestal, "
        "reflecting ghostly silhouettes, no humans visible, pure "
        "magical object"
    ),
    "DES_S01": (  # Shadow Ambush
        "A swirling purple-black shadow portal rune on dark stone, "
        "tendrils of dark magic, no humans, pure trap effect"
    ),
    "DES_S02": (  # Dark Bargain
        "A glowing purple pact rune on dark stone, shadowy smoke "
        "rising, no humans, pure secret-effect illustration"
    ),
    "DES_S03": (  # Void Trap
        "A swirling purple-black void portal circle on dark ground, "
        "ominous red glow at center, no humans, pure trap effect"
    ),

    # ─── Copyright-flagged: current art resembled Despicable Me Minion ───
    "NEU111": (  # Quick Zap
        "A crackling bolt of yellow-white electricity striking downward, "
        "arcane sparks radiating outward, dark stormy backdrop, pure "
        "spell effect, no humans, no characters, no yellow humanoid "
        "figures, no cartoon characters"
    ),
    "NEU109": (  # Volcanic Eruption
        "A massive volcano erupting with columns of orange-red lava and "
        "black smoke, glowing embers raining down, dramatic fantasy "
        "landscape, no humans, no characters"
    ),
    "NEU110": (  # Orra Bolt
        "A single purple-white magical bolt streaking across a dark sky "
        "with orra-crystal sparks trailing, pure spell effect, no "
        "humans, no characters"
    ),
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--codes", type=str, default=None,
                    help="Comma-separated subset to regenerate (default: all overrides)")
    ap.add_argument("--steps", type=int, default=35)
    ap.add_argument("--width", type=int, default=768)
    ap.add_argument("--height", type=int, default=1024)
    args = ap.parse_args()

    if args.codes:
        subset = set(args.codes.split(","))
        todo = [(c, p) for c, p in OVERRIDES.items() if c in subset]
    else:
        todo = list(OVERRIDES.items())

    print(f"[regen] {len(todo)} override(s)", flush=True)
    if not todo:
        return

    print("[regen] loading SDXL...", flush=True)
    from diffusers import StableDiffusionXLPipeline

    pipe = StableDiffusionXLPipeline.from_pretrained(
        "stabilityai/stable-diffusion-xl-base-1.0",
        torch_dtype=torch.float16,
        variant="fp16",
        use_safetensors=True,
    ).to("mps")
    pipe.set_progress_bar_config(disable=True)

    start = time.time()
    for i, (code, flavor) in enumerate(todo, 1):
        out = PNG_DIR / f"{code}.png"
        prompt = f"{flavor}. {BASE}"
        # New seed so we don't re-draw the same bad roll.
        seed = (abs(hash(code)) ^ 0xDEADBEEF) % (2**31)
        t0 = time.time()
        gen = torch.Generator("mps").manual_seed(seed)
        img = pipe(
            prompt,
            negative_prompt=STRONG_NEGATIVE,
            num_inference_steps=args.steps,
            guidance_scale=8.0,
            height=args.height,
            width=args.width,
            generator=gen,
        ).images[0]
        img.save(str(out))
        elapsed = time.time() - t0
        total = time.time() - start
        print(f"[regen] {i}/{len(todo)} {code} ({elapsed:.1f}s; total {total:.0f}s)", flush=True)

    print(f"[regen] done. wall time {time.time() - start:.0f}s", flush=True)


if __name__ == "__main__":
    main()
