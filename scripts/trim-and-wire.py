#!/usr/bin/env python3
"""
Trim cards.json to ~280 cards, wire up effects, and add tribes.
"""
import json
import re
import os

with open('data/cards.json') as f:
    all_cards = json.load(f)

# ── Essential SVG-only card codes to keep ──
ESSENTIAL_SVG = {
    'COIN',
    # Tokens
    'AVA_TOKEN_01', 'AVA_TOKEN_02', 'AST_TOKEN_01', 'AST_TOKEN_02',
    'IZZ_TOKEN_01', 'NEU_TOKEN_01', 'NEU_TOKEN_02', 'NEU_TOKEN_03', 'NEU_TOKEN_04',
    # Secrets
    'AND_S01', 'AND_S02', 'AND_S03',
    'JIM_S01', 'JIM_S02', 'JIM_S03',
    'AST_S01', 'AST_S02', 'AST_S03',
    'DES_S01', 'DES_S02', 'DES_S03',
    # Bonds
    'JIM_BOND_01', 'JIM_BOND_02',
    'TAL_BOND_01', 'TAL_BOND_02',
    'DRK_BOND_01', 'DRK_BOND_02',
    'AND_BOND_01', 'AND_BOND_02',
    'DES_BOND_01', 'DES_BOND_02',  # may not exist but safe
    'AST_BOND_01', 'AST_BOND_02',
    'AVA_BOND_01', 'AVA_BOND_02',
    'LUC_BOND_01', 'LUC_BOND_02',
    'IZZ_BOND_01', 'IZZ_BOND_02',
    # Hardcoded collars
    'DES_COLLAR_02', 'DES_COLLAR_03',
}

# ── Load art map to know which cards have PNG art ──
with open('data/cardArtMap.json') as f:
    art_map = json.load(f)
png_codes = {code for code in art_map.values() if not code.startswith('HERO_')}

# ── Filter: keep PNG art cards + essential SVG ──
kept = []
removed = 0
for card in all_cards:
    code = card['cardCode']
    if code in png_codes or code in ESSENTIAL_SVG:
        kept.append(card)
    else:
        removed += 1

print(f"Removed {removed} old cards, kept {len(kept)}")

# ── Tribe assignments ──
MECH_NAMES = {
    'Andrii', 'Bjorn', 'Candice', 'Caytum', 'Helixian Recycler', 'Helix Robot',
    'Pero', 'Prema', 'Skip', 'Talbot L', 'Talbot M', 'Talbot S', 'Zims',
    'GPU', 'Megabyte', 'Convex', 'Trimmer V1', 'Trax', 'Junk', 'Klein',
    'Spence', 'Recorder', 'Sall-E', 'Chip', 'Whizz', 'Giga',
    'Gadget Drone', 'Guardian Drone', 'Scrap Golem',
}
BEAST_NAMES = {
    'Chomp', 'Infernic', 'Glacius', 'Fenris', 'Trickwing', 'Skales',
    'Peep', 'Plup', 'Yip', 'RoRo', 'Stix', 'Kite', 'Poke',
    'Otto, Loyal Otter', 'Bella, Snow Guardian', 'Sengo, Shadow Leopard',
    'Rosie, Bottlenose Scout', 'Snowball, Arctic Scout', 'Fiona, Sky Glider',
    'Jax, Desert Coyote', 'Jax, Coyote Scout', 'Bling, Puffin Navigator',
    'Mighty, Loyal Mink', 'Fiona, Acrobat', 'Tuskling', 'Spirit of Thorn',
    'Senga, Wind Rider',
}
AMETI_NAMES = {
    'Boris', 'Boris, Anvil Guard', 'Lady Arinna', 'Tessa, Shield Captain',
    'Hugo, Shadow Blade', 'Raphael', 'Trinity', 'Tamara', 'Elle',
    'Alexis', 'Yvette', 'Roderick', 'Jasten', 'Asmita', 'Freya',
    'Brea', 'Emmy', 'Mr. Verdant', 'Calix', 'Caspian', 'Ivana',
    'Aemilio', 'Felix', 'Liam', 'Mirabelle', 'Omar', 'Percy',
    'Rhea', 'Tori', 'Rahul', 'Zahava', 'Sygna', 'Brittana, Sparkle Scout',
    'Jayelin, Ice Runner', 'Ms. Mirabella', 'Ms. Easley', 'Kandu',
    'Calculated Force', 'Breakthrough Innovation', 'Sir Helio, Mech Paladin',
    'Kusai, Desert Runner', 'Guardian', 'Shield Squire', 'Squire',
}
DOMINION_NAMES = {
    'Vrasp', 'Vlad', 'Selena', 'Romulus', 'Shazarda', 'The Anarchist',
    'Ezra', 'Maso', 'Kabistan', 'Lateo', 'Ulan', 'Vyren',
    'Collar Drone',
}
ELEMENTAL_NAMES = {
    'Embra', 'Vortex', 'Ozone', 'Glasglow', 'Xiao', 'Monico',
    'Jetstream', 'Stern', 'Ruby', 'Nova Ramiro', 'Eddie',
    'Bronson', 'Brutus', 'Markus', 'Chuck', 'Tayvon',
    'The Searing Anvil', 'Embra',
}

for card in kept:
    if card['type'] != 'MINION':
        continue
    name = card['name']
    # Already has a type from robot classification
    if card.get('minionType') == 'MECH':
        continue
    if name in MECH_NAMES:
        card['minionType'] = 'MECH'
    elif name in BEAST_NAMES:
        card['minionType'] = 'BEAST'
    elif name in DOMINION_NAMES:
        card['minionType'] = 'DOMINION'
    elif name in ELEMENTAL_NAMES:
        card['minionType'] = 'ELEMENTAL'
    elif name in AMETI_NAMES:
        card['minionType'] = 'AMETI'

# Count tribes
tribe_counts = {}
for c in kept:
    t = c.get('minionType')
    if t:
        tribe_counts[t] = tribe_counts.get(t, 0) + 1
print(f"Tribes: {tribe_counts}")

# ── Wire up effects ──
def parse_damage_value(text, pattern):
    m = re.search(pattern, text)
    return int(m.group(1)) if m else None

def parse_buff(text):
    m = re.search(r'\+(\d+)/\+(\d+)', text)
    if m:
        return int(m.group(1)), int(m.group(2))
    m = re.search(r'\+(\d+) Attack', text)
    if m:
        return int(m.group(1)), 0
    m = re.search(r'\+(\d+) Health', text)
    if m:
        return 0, int(m.group(1))
    return None, None

def text_to_effects(text):
    """Parse card text and return a list of effect dicts."""
    if not text:
        return []
    effects = []

    # Deal damage patterns
    if re.search(r'Deal (\d+) damage to all enemy minions', text):
        v = int(re.search(r'Deal (\d+) damage to all enemy minions', text).group(1))
        effects.append({"type": "DEAL_DAMAGE_ALL_ENEMIES", "target": "ALL_ENEMY_MINIONS", "value": v})
    elif re.search(r'Deal (\d+) damage to all minions', text):
        v = int(re.search(r'Deal (\d+) damage to all minions', text).group(1))
        effects.append({"type": "DEAL_DAMAGE_ALL_ENEMIES", "target": "ALL_MINIONS", "value": v})
    elif re.search(r'Deal (\d+) damage to all characters', text):
        v = int(re.search(r'Deal (\d+) damage to all characters', text).group(1))
        effects.append({"type": "DEAL_DAMAGE_ALL_ENEMIES", "target": "ALL_MINIONS", "value": v})
    elif re.search(r'Deal (\d+) damage to all enemies', text):
        v = int(re.search(r'Deal (\d+) damage to all enemies', text).group(1))
        effects.append({"type": "DEAL_DAMAGE_ALL_ENEMIES", "target": "ALL_ENEMY_MINIONS", "value": v})
    elif re.search(r'Deal (\d+) damage to a random enemy minion', text):
        v = int(re.search(r'Deal (\d+) damage to a random enemy minion', text).group(1))
        effects.append({"type": "DEAL_DAMAGE_RANDOM_ENEMY", "target": "RANDOM_ENEMY", "value": v})
    elif re.search(r'Deal (\d+) damage to a random enemy', text) and 'minion' not in text:
        v = int(re.search(r'Deal (\d+) damage to a random enemy', text).group(1))
        effects.append({"type": "DEAL_DAMAGE_RANDOM_ENEMY", "target": "RANDOM_ENEMY", "value": v})
    elif re.search(r'Deal (\d+) damage to the enemy hero', text):
        v = int(re.search(r'Deal (\d+) damage to the enemy hero', text).group(1))
        effects.append({"type": "DEAL_DAMAGE", "target": "TARGET_ENEMY_HERO", "value": v})
    elif re.search(r'Deal (\d+) damage to a minion', text):
        v = int(re.search(r'Deal (\d+) damage to a minion', text).group(1))
        effects.append({"type": "DEAL_DAMAGE", "target": "TARGET_MINION", "value": v})
    elif re.search(r'Deal (\d+) damage to any target', text):
        v = int(re.search(r'Deal (\d+) damage to any target', text).group(1))
        effects.append({"type": "DEAL_DAMAGE", "target": "TARGET_ANY", "value": v})
    elif re.search(r'Deal (\d+) damage to a character', text):
        v = int(re.search(r'Deal (\d+) damage to a character', text).group(1))
        effects.append({"type": "DEAL_DAMAGE", "target": "TARGET_ANY", "value": v})
    elif re.search(r'Deal (\d+) damage\.', text) or re.search(r'Deal (\d+) damage$', text):
        m = re.search(r'Deal (\d+) damage', text)
        v = int(m.group(1))
        effects.append({"type": "DEAL_DAMAGE", "target": "TARGET_ANY", "value": v})
    elif re.search(r'Deal damage equal to', text):
        effects.append({"type": "DEAL_DAMAGE_BASED_ON_ARMOR", "target": "ALL_ENEMY_MINIONS"})

    # Restore health
    if re.search(r'Restore (\d+) Health to all friendly', text):
        v = int(re.search(r'Restore (\d+) Health to all friendly', text).group(1))
        effects.append({"type": "RESTORE_HEALTH", "target": "ALL_FRIENDLY_MINIONS", "value": v})
    elif re.search(r'Restore (\d+) Health to your hero', text):
        v = int(re.search(r'Restore (\d+) Health to your hero', text).group(1))
        effects.append({"type": "RESTORE_HEALTH", "target": "TARGET_HERO", "value": v})
    elif re.search(r'Restore (\d+) Health to a friendly character', text):
        v = int(re.search(r'Restore (\d+) Health to a friendly character', text).group(1))
        effects.append({"type": "RESTORE_HEALTH", "target": "TARGET_ANY", "value": v})
    elif re.search(r'Restore (\d+) Health', text) and 'all friendly' not in text:
        v = int(re.search(r'Restore (\d+) Health', text).group(1))
        effects.append({"type": "RESTORE_HEALTH", "target": "TARGET_ANY", "value": v})
    elif re.search(r'Restore a minion to full Health', text):
        effects.append({"type": "RESTORE_HEALTH", "target": "TARGET_MINION", "value": 99})

    # Draw cards
    if re.search(r'Draw (\d+) cards?', text):
        v = int(re.search(r'Draw (\d+) cards?', text).group(1))
        effects.append({"type": "DRAW_CARDS", "target": "NONE", "value": v})
    elif re.search(r'Draw a card', text):
        effects.append({"type": "DRAW_CARDS", "target": "NONE", "value": 1})

    # Freeze
    if re.search(r'Freeze all enemy minions', text):
        effects.append({"type": "FREEZE_TARGET", "target": "ALL_ENEMY_MINIONS"})
    elif re.search(r'Freeze two random enemy', text):
        effects.append({"type": "FREEZE_TARGET", "target": "RANDOM_ENEMY"})
        effects.append({"type": "FREEZE_TARGET", "target": "RANDOM_ENEMY"})
    elif re.search(r'Freeze a random enemy', text):
        effects.append({"type": "FREEZE_TARGET", "target": "RANDOM_ENEMY"})
    elif re.search(r'Freeze an enemy', text):
        effects.append({"type": "FREEZE_TARGET", "target": "TARGET_MINION"})

    # Gain armor
    if re.search(r'Gain (\d+) Armor', text):
        v = int(re.search(r'Gain (\d+) Armor', text).group(1))
        effects.append({"type": "GAIN_ARMOR", "target": "NONE", "value": v})

    # Buff minion
    if re.search(r'Give all friendly minions \+(\d+)/\+(\d+)', text):
        m = re.search(r'Give all friendly minions \+(\d+)/\+(\d+)', text)
        effects.append({"type": "BUFF_ALL_FRIENDLY", "target": "ALL_FRIENDLY_MINIONS", "attackBuff": int(m.group(1)), "healthBuff": int(m.group(2))})
    elif re.search(r'Give a friendly minion \+(\d+)/\+(\d+)', text):
        m = re.search(r'Give a friendly minion \+(\d+)/\+(\d+)', text)
        effects.append({"type": "BUFF_MINION", "target": "TARGET_FRIENDLY_MINION", "attackBuff": int(m.group(1)), "healthBuff": int(m.group(2))})
    elif re.search(r'Give a minion \+(\d+)/\+(\d+)', text):
        m = re.search(r'Give a minion \+(\d+)/\+(\d+)', text)
        effects.append({"type": "BUFF_MINION", "target": "TARGET_FRIENDLY_MINION", "attackBuff": int(m.group(1)), "healthBuff": int(m.group(2))})
    elif re.search(r'Give a friendly minion \+(\d+) Attack', text):
        v = int(re.search(r'Give a friendly minion \+(\d+) Attack', text).group(1))
        effects.append({"type": "BUFF_MINION", "target": "TARGET_FRIENDLY_MINION", "attackBuff": v, "healthBuff": 0})
    elif re.search(r'Give your minions \+(\d+) Attack', text):
        v = int(re.search(r'Give your minions \+(\d+) Attack', text).group(1))
        effects.append({"type": "BUFF_ALL_FRIENDLY", "target": "ALL_FRIENDLY_MINIONS", "attackBuff": v, "healthBuff": 0})
    elif re.search(r'Give a friendly minion \+(\d+)/\+(\d+) and Divine Shield', text):
        m = re.search(r'Give a friendly minion \+(\d+)/\+(\d+)', text)
        effects.append({"type": "BUFF_MINION", "target": "TARGET_FRIENDLY_MINION", "attackBuff": int(m.group(1)), "healthBuff": int(m.group(2))})
        effects.append({"type": "GRANT_KEYWORD", "target": "TARGET_FRIENDLY_MINION", "grantKeyword": "DIVINE_SHIELD"})

    # Grant keyword
    if re.search(r'Give a friendly minion Divine Shield and Taunt', text):
        effects.append({"type": "GRANT_KEYWORD", "target": "TARGET_FRIENDLY_MINION", "grantKeyword": "DIVINE_SHIELD"})
        effects.append({"type": "GRANT_KEYWORD", "target": "TARGET_FRIENDLY_MINION", "grantKeyword": "TAUNT"})
    elif re.search(r'Give a friendly minion Divine Shield', text) and 'Taunt' not in text:
        effects.append({"type": "GRANT_KEYWORD", "target": "TARGET_FRIENDLY_MINION", "grantKeyword": "DIVINE_SHIELD"})
    elif re.search(r'Give all friendly minions Divine Shield', text):
        effects.append({"type": "GRANT_KEYWORD", "target": "ALL_FRIENDLY_MINIONS", "grantKeyword": "DIVINE_SHIELD"})
    elif re.search(r'Give a friendly minion Stealth', text):
        effects.append({"type": "GRANT_KEYWORD", "target": "TARGET_FRIENDLY_MINION", "grantKeyword": "STEALTH"})
    elif re.search(r'Give a friendly minion Taunt', text) and 'Divine Shield' not in text:
        effects.append({"type": "GRANT_KEYWORD", "target": "TARGET_FRIENDLY_MINION", "grantKeyword": "TAUNT"})

    # Summon minions
    if re.search(r'Summon (?:a |two |three |four )?(\d+)/(\d+)', text):
        m = re.search(r'Summon (?:a |two |three |four )?(\d+)/(\d+)', text)
        count_word = re.search(r'Summon (two|three|four|a) ', text)
        count = {'two': 2, 'three': 3, 'four': 4, 'a': 1}.get(count_word.group(1) if count_word else 'a', 1)
        effects.append({"type": "SUMMON_MINION", "target": "NONE", "summonCardCode": "NEU_TOKEN_01", "summonCount": count})
    elif re.search(r'Summon two 1/1 Gadget Drones', text):
        effects.append({"type": "SUMMON_MINION", "target": "NONE", "summonCardCode": "AVA_TOKEN_01", "summonCount": 2})
    elif re.search(r'Summon three 1/1 Gadget Drones', text):
        effects.append({"type": "SUMMON_MINION", "target": "NONE", "summonCardCode": "AVA_TOKEN_01", "summonCount": 3})
    elif re.search(r'Summon two 2/2 Guardian Drones', text):
        effects.append({"type": "SUMMON_MINION", "target": "NONE", "summonCardCode": "AVA_TOKEN_02", "summonCount": 2})
    elif re.search(r'Summon three 2/1 Guardians', text):
        effects.append({"type": "SUMMON_MINION", "target": "NONE", "summonCardCode": "AST_TOKEN_01", "summonCount": 3})
    elif re.search(r'Summon a 1/1 Gadget Drone', text):
        effects.append({"type": "SUMMON_MINION", "target": "NONE", "summonCardCode": "AVA_TOKEN_01", "summonCount": 1})
    elif re.search(r'Summon a (\d+)/(\d+)', text):
        effects.append({"type": "SUMMON_MINION", "target": "NONE", "summonCardCode": "NEU_TOKEN_01", "summonCount": 1})

    # Destroy
    if re.search(r'Destroy a (?:random )?enemy minion', text):
        effects.append({"type": "DESTROY_MINION", "target": "RANDOM_ENEMY"})
    elif re.search(r'Destroy a minion', text):
        effects.append({"type": "DESTROY_MINION", "target": "TARGET_MINION"})
    elif re.search(r'Destroy a damaged enemy minion', text):
        effects.append({"type": "DESTROY_MINION", "target": "TARGET_ENEMY_MINION"})
    elif re.search(r'Destroy a friendly minion', text):
        effects.append({"type": "DESTROY_MINION", "target": "TARGET_FRIENDLY_MINION"})
    elif re.search(r'Destroy all minions with (\d+) or less Attack', text):
        v = int(re.search(r'Destroy all minions with (\d+) or less Attack', text).group(1))
        effects.append({"type": "DEAL_DAMAGE_ALL_ENEMIES", "target": "ALL_MINIONS", "value": 99})

    # Return to hand
    if re.search(r'Return a friendly minion to your hand', text):
        effects.append({"type": "RETURN_TO_HAND", "target": "TARGET_FRIENDLY_MINION"})
    elif re.search(r'Return an enemy minion to their hand', text):
        effects.append({"type": "RETURN_TO_HAND", "target": "TARGET_ENEMY_MINION"})
    elif re.search(r'Return a minion to', text):
        effects.append({"type": "RETURN_TO_HAND", "target": "TARGET_MINION"})

    # Silence
    if re.search(r'Silence all enemy minions', text):
        effects.append({"type": "SILENCE_TARGET", "target": "ALL_ENEMY_MINIONS"})
    elif re.search(r'Silence', text):
        effects.append({"type": "SILENCE_TARGET", "target": "TARGET_MINION"})

    # Take control
    if re.search(r'Take control', text):
        effects.append({"type": "STEAL_MINION", "target": "TARGET_ENEMY_MINION"})

    # Copy
    if re.search(r'Copy a random enemy minion', text):
        effects.append({"type": "DRAW_CARDS", "target": "NONE", "value": 1})  # simplified

    return effects


def wire_card_effects(card):
    """Add proper effect objects to a card based on its text."""
    text = card.get('text', '')
    if not text:
        return

    # Already has effects wired — skip
    if card.get('battlecryEffect') or card.get('battlecryEffects') or \
       card.get('spellEffect') or card.get('spellEffects') or \
       card.get('deathrattleEffect') or card.get('locationEffect') or \
       card.get('comboEffect') or card.get('secretEffect'):
        return

    keywords = card.get('keywords', [])
    card_type = card.get('type', '')

    if card_type == 'SPELL' and not card.get('secretTrigger'):
        # Parse the full text for spell effects
        effects = text_to_effects(text)
        if effects:
            if len(effects) == 1:
                card['spellEffect'] = effects[0]
            else:
                card['spellEffects'] = effects

    elif card_type == 'LOCATION':
        effects = text_to_effects(text)
        if effects:
            if len(effects) == 1:
                card['locationEffect'] = effects[0]
            else:
                card['locationEffects'] = effects

    elif card_type == 'MINION':
        # Split battlecry vs deathrattle vs combo
        if 'BATTLECRY' in keywords:
            # Extract battlecry part: "Battlecry: <text>"
            bc_match = re.search(r'Battlecry:\s*(.+?)(?:\.|$)', text)
            if bc_match:
                bc_text = bc_match.group(1)
                effects = text_to_effects(bc_text + '.')
                if effects:
                    if len(effects) == 1:
                        card['battlecryEffect'] = effects[0]
                    else:
                        card['battlecryEffects'] = effects

        if 'DEATHRATTLE' in keywords:
            dr_match = re.search(r'Deathrattle:\s*(.+?)(?:\.|$)', text)
            if dr_match:
                dr_text = dr_match.group(1)
                effects = text_to_effects(dr_text + '.')
                if effects:
                    card['deathrattleEffect'] = effects[0]

        if 'COMBO' in keywords:
            combo_match = re.search(r'Combo:\s*(.+?)(?:\.|$)', text)
            if combo_match:
                combo_text = combo_match.group(1)
                effects = text_to_effects(combo_text + '.')
                if effects:
                    card['comboEffect'] = effects[0]


# Wire effects for all cards
wired = 0
for card in kept:
    old_keys = set(card.keys())
    wire_card_effects(card)
    new_keys = set(card.keys())
    if new_keys - old_keys:
        wired += 1

print(f"Wired effects for {wired} cards")

# ── Update some tribal synergy card texts ──
# Find cards that could have tribal synergies and update them
for card in kept:
    name = card['name']
    # Klein: "Battlecry: Give a friendly mech +1/+1" → make it MECH-specific
    if name == 'Klein':
        card['text'] = 'Battlecry: Give a friendly MECH +1/+1.'
    elif name == 'Zims':
        card['text'] = 'Battlecry: Give a friendly MECH +1 Attack.'
    elif name == 'GPU':
        card['text'] = 'Battlecry: Draw a card for each MECH you control.'
    elif name == 'Junk':
        card['text'] = 'Deathrattle: Add a random MECH to your hand.'
    elif name == 'Helixian Recycler':
        card['text'] = 'Deathrattle: Add a random MECH to your hand.'
    elif name == 'Convex':
        card['text'] = 'Battlecry: Draw a card if you control a MECH.'

# Save
with open('data/cards.json', 'w') as f:
    json.dump(kept, f, indent=2)

print(f"\nFinal card count: {len(kept)}")

# Count by class
by_class = {}
for c in kept:
    hc = c['heroClass']
    by_class[hc] = by_class.get(hc, 0) + 1
print("By class:", json.dumps(by_class, indent=2))

# Count by type
by_type = {}
for c in kept:
    t = c['type']
    by_type[t] = by_type.get(t, 0) + 1
print("By type:", json.dumps(by_type, indent=2))

# Cards with effects
has_effect = sum(1 for c in kept if any(k in c for k in ['battlecryEffect', 'battlecryEffects', 'spellEffect', 'spellEffects', 'deathrattleEffect', 'locationEffect', 'comboEffect', 'secretEffect', 'secretTrigger']))
print(f"Cards with effects: {has_effect}/{len(kept)}")

# Update cardArtPngs.ts
kept_codes = {c['cardCode'] for c in kept}
png_in_set = sorted(png_codes & kept_codes)
with open('client/src/utils/cardArtPngs.ts', 'w') as f:
    f.write('export const CARD_ART_PNGS = new Set([\n')
    for i, code in enumerate(png_in_set):
        comma = ',' if i < len(png_in_set) - 1 else ''
        f.write(f'  "{code}"{comma}\n')
    f.write(']);\n')
print(f"Updated cardArtPngs.ts with {len(png_in_set)} codes")
