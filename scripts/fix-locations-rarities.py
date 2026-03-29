#!/usr/bin/env python3
"""Fix location effects, hero distribution, and rebalance rarities."""
import json

with open('data/cards.json') as f:
    cards = json.load(f)

by_code = {c['cardCode']: c for c in cards}

# ═══ STEP 1: Fix locations — 1 per hero, rest neutral, add effects ═══

location_updates = {
    # CLASS LOCATIONS (1 per hero)
    'NEU_LOC05': {  # Crown Pointe Mines → JIMMY
        'heroClass': 'JIMMY', 'manaCost': 2, 'health': 3, 'rarity': 'RARE',
        'text': 'Deal 1 damage to all enemy minions.',
        'locationEffect': {"type": "DEAL_DAMAGE_ALL_ENEMIES", "target": "ALL_ENEMY_MINIONS", "value": 1},
    },
    'TAL_LOC03': {  # Pawprint Valley → TALA
        'heroClass': 'TALA', 'manaCost': 2, 'health': 3, 'rarity': 'RARE',
        'text': 'Restore 3 Health to a character.',
        'locationEffect': {"type": "RESTORE_HEALTH", "target": "TARGET_ANY", "value": 3},
    },
    'DRK_LOC02': {  # Helix Megaplex → DEREK
        'heroClass': 'DEREK', 'manaCost': 3, 'health': 2, 'rarity': 'RARE',
        'text': 'Draw a card.',
        'locationEffect': {"type": "DRAW_CARDS", "target": "NONE", "value": 1},
    },
    'AND_LOC02': {  # Mt. Silencia → ANDERS
        'heroClass': 'ANDERS', 'manaCost': 3, 'health': 2, 'rarity': 'EPIC',
        'text': 'Freeze an enemy minion.',
        'locationEffect': {"type": "FREEZE_TARGET", "target": "TARGET_MINION"},
    },
    'DES_LOC03': {  # Kaligula Hallow → DES
        'heroClass': 'DES', 'manaCost': 3, 'health': 2, 'rarity': 'EPIC',
        'text': 'Deal 2 damage to a random enemy.',
        'locationEffect': {"type": "DEAL_DAMAGE_RANDOM_ENEMY", "target": "RANDOM_ENEMY", "value": 2},
    },
    'NEU_LOC08': {  # Nivarra Guild Hall → ASTRID
        'heroClass': 'ASTRID', 'manaCost': 2, 'health': 3, 'rarity': 'RARE',
        'text': 'Give a friendly minion +0/+2.',
        'locationEffect': {"type": "BUFF_MINION", "target": "TARGET_FRIENDLY_MINION", "attackBuff": 0, "healthBuff": 2},
    },
    'NEU_LOC07': {  # Light Lanes Raceway → AVA
        'heroClass': 'AVA', 'manaCost': 3, 'health': 2, 'rarity': 'RARE',
        'text': 'Summon a 1/1 Gadget Drone.',
        'locationEffect': {"type": "SUMMON_MINION", "target": "NONE", "summonCardCode": "AVA_TOKEN_01", "summonCount": 1},
    },
    'LUC_LOC02': {  # Fixed Roll Casino → LUCAS
        'heroClass': 'LUCAS', 'manaCost': 2, 'health': 3, 'rarity': 'EPIC',
        'text': 'Draw a card.',
        'locationEffect': {"type": "DRAW_CARDS", "target": "NONE", "value": 1},
    },
    'IZZ_LOC02': {  # Whisper Island → IZZY
        'heroClass': 'IZZY', 'manaCost': 2, 'health': 3, 'rarity': 'RARE',
        'text': 'Gain 2 Armor.',
        'locationEffect': {"type": "GAIN_ARMOR", "target": "NONE", "value": 2},
    },
    # NEUTRAL LOCATIONS (moved from class)
    'TAL_LOC02': {  # Ivory Forest → NEUTRAL
        'heroClass': 'NEUTRAL', 'manaCost': 3, 'health': 2, 'rarity': 'COMMON',
        'text': 'Give a friendly minion +1/+1.',
        'locationEffect': {"type": "BUFF_MINION", "target": "TARGET_FRIENDLY_MINION", "attackBuff": 1, "healthBuff": 1},
    },
    'TAL_LOC04': {  # Pinewield Passage → NEUTRAL
        'heroClass': 'NEUTRAL', 'manaCost': 2, 'health': 2, 'rarity': 'COMMON',
        'text': 'Draw a card.',
        'locationEffect': {"type": "DRAW_CARDS", "target": "NONE", "value": 1},
    },
    'DRK_LOC03': {  # Mechingham Estates → NEUTRAL
        'heroClass': 'NEUTRAL', 'manaCost': 4, 'health': 2, 'rarity': 'EPIC',
        'text': 'Summon a 2/1 Scrap Golem.',
        'locationEffect': {"type": "SUMMON_MINION", "target": "NONE", "summonCardCode": "NEU_TOKEN_01", "summonCount": 1},
    },
    'AND_LOC03': {  # Serenity Hot Springs → NEUTRAL
        'heroClass': 'NEUTRAL', 'manaCost': 3, 'health': 3, 'rarity': 'RARE',
        'text': 'Restore 2 Health to all friendly characters.',
        'locationEffect': {"type": "RESTORE_HEALTH", "target": "ALL_FRIENDLY_MINIONS", "value": 2},
    },
    'DES_LOC02': {  # Isolation Arena → NEUTRAL
        'heroClass': 'NEUTRAL', 'manaCost': 3, 'health': 2, 'rarity': 'RARE',
        'text': 'Deal 2 damage to a minion.',
        'locationEffect': {"type": "DEAL_DAMAGE", "target": "TARGET_MINION", "value": 2},
    },
    'DES_LOC04': {  # Obexian Slums → NEUTRAL
        'heroClass': 'NEUTRAL', 'manaCost': 2, 'health': 2, 'rarity': 'COMMON',
        'text': 'Deal 1 damage to a random enemy.',
        'locationEffect': {"type": "DEAL_DAMAGE_RANDOM_ENEMY", "target": "RANDOM_ENEMY", "value": 1},
    },
    'NEU_LOC03': {  # Acacian Maze → NEUTRAL (already)
        'manaCost': 3, 'health': 2, 'rarity': 'RARE',
        'text': 'Return an enemy minion to their hand.',
        'locationEffect': {"type": "RETURN_TO_HAND", "target": "TARGET_ENEMY_MINION"},
    },
    'NEU_LOC04': {  # Coral Haven → NEUTRAL (already)
        'manaCost': 2, 'health': 3, 'rarity': 'COMMON',
        'text': 'Restore 2 Health to your hero.',
        'locationEffect': {"type": "RESTORE_HEALTH", "target": "TARGET_HERO", "value": 2},
    },
    'NEU_LOC06': {  # Hope Falls → NEUTRAL (already)
        'manaCost': 4, 'health': 3, 'rarity': 'EPIC',
        'text': 'Restore 3 Health to your hero. Draw a card.',
        'locationEffects': [
            {"type": "RESTORE_HEALTH", "target": "TARGET_HERO", "value": 3},
            {"type": "DRAW_CARDS", "target": "NONE", "value": 1},
        ],
    },
}

for code, updates in location_updates.items():
    if code in by_code:
        for k, v in updates.items():
            by_code[code][k] = v

print("Location effects applied to 18 locations")

# ═══ STEP 2: Rebalance rarities ═══

# Named legendaries per hero (1-2 each) + neutrals
LEGENDARIES = {
    # Jimmy (2)
    'JIM030': None,  # Infernic 8m 7/7 DRAGON — already strong
    'JIM032': {'text': 'Battlecry: Deal 3 damage to all enemies.', 'keywords': ['BATTLECRY']},  # Nova Ramiro 7m 6/6
    # Tala (2)
    'TAL034': None,  # The Grand Sequoia 8m — already strong
    'TAL026': {'text': 'Battlecry: Restore 5 Health to all friendly characters. Give them +1/+1.', 'keywords': ['BATTLECRY']},  # Mr. Verdant 6m 4/6
    # Derek (2)
    'DRK032': {'text': 'Taunt. Deathrattle: Summon two 3/3 mechs.', 'keywords': ['TAUNT', 'DEATHRATTLE']},  # Prema 6m 5/6
    'DRK041': {'text': 'Taunt. Deathrattle: Summon a 5/5 mech with Taunt.', 'keywords': ['TAUNT', 'DEATHRATTLE']},  # Talbot L 7m 6/7
    # Anders (2)
    'AND029': None,  # Ozone 5m — freeze all enemies
    'AND022': {'text': 'Freeze any character damaged by this minion. Battlecry: Freeze two random enemies.', 'keywords': ['BATTLECRY']},  # Glacius 6m 5/6
    # Des (2)
    'DES033': None,  # The Anarchist 5m — destroy random enemy
    'DES031': {'text': 'Deathrattle: Deal 3 damage to all enemies. Summon a 4/4 Shadow.', 'keywords': ['DEATHRATTLE']},  # Shazarda 7m 6/6 DRAGON
    # Astrid (2)
    'AST031': None,  # Lady Arinna 6m — already strong
    'AST021': {'text': 'Battlecry: Give all friendly minions Divine Shield.', 'keywords': ['BATTLECRY']},  # Calculated Force 5m 4/5
    # Ava (2)
    'AVA021': {'text': 'Battlecry: Summon three 2/2 Guardian Drones with Taunt.', 'keywords': ['BATTLECRY']},  # Breakthrough Innovation 6m
    'AVA026': {'text': 'Battlecry: Summon a copy of a random friendly MECH.', 'keywords': ['BATTLECRY']},  # Giga 5m 4/5
    # Lucas (2)
    'LUC032': {'text': 'Stealth. Combo: Deal 3 damage to any target and draw a card.', 'keywords': ['STEALTH', 'COMBO']},  # Hugo 5m 5/4
    'LUC034': {'text': 'Stealth. Combo: Gain +3/+3 and Windfury.', 'keywords': ['STEALTH', 'COMBO']},  # Mercurio 5m — upgrade from epic
    # Izzy (2)
    'IZZ039': {'text': 'Battlecry: Gain 5 Armor. Draw 2 cards.', 'keywords': ['BATTLECRY']},  # Zahava 6m 5/6
    'IZZ036': {'text': 'Windfury. Battlecry: Gain +2 Attack for each Armor you have.', 'keywords': ['WINDFURY', 'BATTLECRY']},  # Senga 4m 4/3
    # Neutral legendaries (5)
    'NEU064': None,  # Boris, Anvil Guard 6m — upgrade below
    'NEU066': {'text': 'Battlecry: Deal 2 damage to all other minions.', 'keywords': ['BATTLECRY']},  # Chomp 4m 5/4
    'NEU077': {'text': 'Battlecry: Draw a card for each minion on the board.', 'keywords': ['BATTLECRY']},  # Maestro Waulie 5m 3/5
    'NEU097': {'text': 'Taunt. Deathrattle: Summon two 2/2 Tusklings.', 'keywords': ['TAUNT', 'DEATHRATTLE']},  # Tybiel 6m 5/6
    'NEU073': {'text': 'Taunt. Battlecry: Restore 5 Health to your hero.', 'keywords': ['TAUNT', 'BATTLECRY']},  # Kron 6m 6/6
}

# Des Aster is a hero — downgrade to EPIC
if 'DES_COLLAR_03' in by_code:
    by_code['DES_COLLAR_03']['rarity'] = 'EPIC'

# Boris, Anvil Guard upgrade
if 'NEU064' in by_code:
    by_code['NEU064']['text'] = 'Taunt. Battlecry: Gain 3 Armor. Your other minions have +1 Attack.'
    by_code['NEU064']['keywords'] = ['TAUNT', 'BATTLECRY']
    by_code['NEU064']['battlecryEffect'] = {"type": "GAIN_ARMOR", "target": "NONE", "value": 3}

# Apply legendary promotions
for code, text_update in LEGENDARIES.items():
    if code not in by_code:
        continue
    by_code[code]['rarity'] = 'LEGENDARY'
    if text_update:
        for k, v in text_update.items():
            by_code[code][k] = v

# EPICS — powerful effects, AoE, unique mechanics
EPICS = [
    # Jimmy
    'JIM022',  # Brutus — 6m 6/5 Charge
    'JIM027',  # Fenris — 5m 5/4 DR deal 2 all
    'JIM026',  # Engulfed in Flames — 7m AoE 5 dmg
    # Tala
    'TAL021',  # Freya — 5m 3/6 heal
    'TAL029',  # Nature's Wrath — 6m AoE
    'TAL027',  # Merva — 4m heal adjacent
    # Derek
    'DRK024',  # GPU — draw per mech
    # Anders
    'AND024',  # Hailstorm — 4m AoE freeze
    'AND022',  # Glacius — 6m 5/6 freeze on hit
    # Des
    'DES022',  # Death's Descent — 6m destroy all <=3 atk
    'DES024',  # Elixir of Domination — steal minion
    # Astrid
    'AST029',  # Jasten — 4m Taunt DS
    'AST038',  # Trinity — 5m 3/6 Taunt DS
    'AST025',  # Call to Arms — summon 3 guardians
    'AST039',  # Triumphant — 4m +3/+3 DS
    # Ava
    'AVA029',  # Nullification Field — silence all
    'AVA028',  # Manufacture Reinforcements — summon 3
    # Lucas — legendaries cover the epics
    # Izzy
    'IZZ037',  # Sygna — 5m 4/5 gain 4 armor
    'IZZ024',  # Coastal Typhoon — 5m AoE 3
    # Neutral
    'NEU099',  # Voulder — 7m 7/7 ameti
    'NEU087',  # Rahul — 5m 5/5 gain 3 armor
]

for code in EPICS:
    if code in by_code and by_code[code]['rarity'] != 'LEGENDARY':
        by_code[code]['rarity'] = 'EPIC'

# RARES — solid single effects
RARES = [
    # Jimmy
    'JIM021', 'JIM025', 'JIM029', 'JIM034', 'JIM037',
    # Tala
    'TAL016', 'TAL020', 'TAL024', 'TAL030', 'TAL032',
    # Derek
    'DRK021', 'DRK026', 'DRK029', 'DRK037', 'DRK036',
    # Anders
    'AND017', 'AND018', 'AND023', 'AND025', 'AND030', 'AND021',
    # Des
    'DES027', 'DES030', 'DES032', 'DES034', 'DES037',
    # Astrid
    'AST028', 'AST033', 'AST037', 'AST040',
    # Ava
    'AVA025', 'AVA027', 'AVA031', 'AVA035',
    # Lucas
    'LUC024', 'LUC027', 'LUC031', 'LUC028', 'LUC038',
    # Izzy
    'IZZ027', 'IZZ029', 'IZZ034',
    # Neutral
    'NEU063', 'NEU065', 'NEU074', 'NEU085', 'NEU090', 'NEU092', 'NEU093',
]

for code in RARES:
    if code in by_code and by_code[code]['rarity'] not in ('LEGENDARY', 'EPIC'):
        by_code[code]['rarity'] = 'RARE'

# Everything else not explicitly set → COMMON
# First collect all codes already assigned above
assigned = set(LEGENDARIES.keys()) | set(EPICS) | set(RARES)
# Also keep existing tokens, secrets, bonds, collars at their current rarity
keep_rarity = {c['cardCode'] for c in cards if '_TOKEN_' in c['cardCode'] or '_S0' in c['cardCode'] or '_BOND_' in c['cardCode'] or '_COLLAR_' in c['cardCode'] or c['cardCode'] == 'COIN'}

for c in cards:
    code = c['cardCode']
    if code in assigned or code in keep_rarity or c['type'] == 'LOCATION':
        continue
    # If not explicitly set, make common
    if c['rarity'] in ('RARE', 'EPIC') and code not in assigned:
        c['rarity'] = 'COMMON'

# Save
with open('data/cards.json', 'w') as f:
    json.dump(cards, f, indent=2)

# Report
rarity_counts = {}
for c in cards:
    r = c['rarity']
    rarity_counts[r] = rarity_counts.get(r, 0) + 1

print(f"\nFinal rarity distribution:")
for r in ['COMMON', 'RARE', 'EPIC', 'LEGENDARY']:
    pct = rarity_counts.get(r, 0) / len(cards) * 100
    print(f"  {r:12s}: {rarity_counts.get(r, 0):3d} ({pct:.0f}%)")

# Per class
print(f"\nPer class:")
for hc in ['JIMMY','TALA','DEREK','ANDERS','DES','ASTRID','AVA','LUCAS','IZZY','NEUTRAL']:
    class_cards = [c for c in cards if c['heroClass'] == hc]
    r = {}
    for c in class_cards:
        r[c['rarity']] = r.get(c['rarity'], 0) + 1
    print(f"  {hc:8s} ({len(class_cards):3d}): C={r.get('COMMON',0):2d} R={r.get('RARE',0):2d} E={r.get('EPIC',0):2d} L={r.get('LEGENDARY',0):2d}")
