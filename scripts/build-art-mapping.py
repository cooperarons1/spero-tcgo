#!/usr/bin/env python3
"""
Build the card art mapping: PNG filename -> cardCode
Also generates new card entries for PNGs that don't map to existing cards.
"""
import json
import os
import re

# Source folders
PNG_DIR = os.path.expanduser("~/Desktop/PNGs")
NOVEL_DIR = os.path.expanduser("~/Desktop/Novel and GN PNGS")

# ── Manual Classifications ──────────────────────────────────────────
# Format: "filename_stem" -> (type, heroClass, displayName, rarity)
# type: MINION, SPELL, WEAPON, LOCATION
# Filename stem = filename minus "_Final.png", " _Final.png", etc.

LOCATIONS = {
    "AcacianMaze": ("Acacian Maze", "NEUTRAL"),
    "CoralHaven": ("Coral Haven", "NEUTRAL"),
    "CrownPointeMines": ("Crown Pointe Mines", "NEUTRAL"),
    "HelixMegaplex": ("Helix Megaplex", "DEREK"),
    "HOPE FALLS DistantThunder": ("Hope Falls", "NEUTRAL"),
    "IsolationArena": ("Isolation Arena", "DES"),
    "IvoryForest": ("Ivory Forest", "TALA"),
    "KaligulaHallow": ("Kaligula Hallow", "DES"),
    "LightLanesRaceway": ("Light Lanes Raceway", "NEUTRAL"),
    "MechinghamEstates": ("Mechingham Estates", "DEREK"),
    "MtSilencia": ("Mt. Silencia", "ANDERS"),
    "NivarraGuildHall": ("Nivarra Guild Hall", "NEUTRAL"),
    "ObexianSlums": ("Obexian Slums", "DES"),
    "PawprintValley": ("Pawprint Valley", "TALA"),
    "PinewieldPassage": ("Pinewield Passage", "TALA"),
    "SerenityHotSprings": ("Serenity Hot Springs", "ANDERS"),
    "WhisperIsland": ("Whisper Island", "IZZY"),
    "FixedRollCasino": ("Fixed Roll Casino", "LUCAS"),
}

WEAPONS = {
    "BloodthirstyPolearm": ("Bloodthirsty Polearm", "JIMMY", 4, 4, 2),
    "CardboardPickaxe": ("Cardboard Pickaxe", "NEUTRAL", 1, 1, 3),
    "DefensiveStaffofStrength": ("Defensive Staff of Strength", "ASTRID", 3, 2, 3),
    "FeatherCloak": ("Feather Cloak", "LUCAS", 2, 1, 3),
    "FlamingSwordofPain": ("Flaming Sword of Pain", "JIMMY", 5, 5, 2),
    "FlexibleSpearofDamage": ("Flexible Spear of Damage", "NEUTRAL", 3, 3, 2),
    "HarvestingScythe": ("Harvesting Scythe", "TALA", 4, 3, 3),
    "KarmonianBadgeofForce": ("Karmonian Badge of Force", "ASTRID", 2, 1, 4),
    "LightningRodofDamage": ("Lightning Rod of Damage", "ANDERS", 4, 3, 3),
    "MetalDetector": ("Metal Detector", "DEREK", 2, 1, 3),
    "NetLauncher": ("Net Launcher", "IZZY", 3, 2, 2),
    "OrraSlingshot": ("Orra Slingshot", "NEUTRAL", 2, 2, 2),
    "PineappleArmor": ("Pineapple Armor", "TALA", 3, 2, 3),
    "QLauncher": ("Q Launcher", "AVA", 4, 3, 2),
    "ScrapScythe": ("Scrap Scythe", "DEREK", 3, 3, 2),
    "ShieldofFragility": ("Shield of Fragility", "ASTRID", 2, 1, 4),
    "ShortSword": ("Short Sword", "NEUTRAL", 1, 2, 2),
    "SpearofPenetration": ("Spear of Penetration", "JIMMY", 3, 4, 2),
    "WarpStaff": ("Warp Staff", "LUCAS", 3, 2, 3),
    "FiddleofSilence": ("Fiddle of Silence", "ANDERS", 3, 1, 4),
}

SPELLS = {
    "AdjustedSurroundings": ("Adjusted Surroundings", "DEREK", 3, "Deal 2 damage to a random enemy minion. Draw a card.", "RARE"),
    "AgileStrength": ("Agile Strength", "LUCAS", 2, "Give a friendly minion +2 Attack this turn.", "COMMON"),
    "Airdrop": ("Airdrop", "AVA", 3, "Summon two 1/1 Gadget Drones.", "COMMON"),
    "AnotherRoundonMe": ("Another Round on Me", "NEUTRAL", 4, "Draw 2 cards.", "COMMON"),
    "AnviltoIron": ("Anvil to Iron", "JIMMY", 2, "Give a minion +2/+1.", "COMMON"),
    "AppliedJudgement": ("Applied Judgement", "ASTRID", 3, "Deal damage equal to a friendly minion's Attack to an enemy.", "RARE"),
    "AudittheInventory": ("Audit the Inventory", "DEREK", 2, "Draw a card. If you have a weapon, draw 2 instead.", "COMMON"),
    "BalancedProgress": ("Balanced Progress", "IZZY", 3, "Give a friendly minion +2/+2.", "COMMON"),
    "BombasticBomb": ("Bombastic Bomb", "JIMMY", 4, "Deal 4 damage to an enemy minion.", "RARE"),
    "BoosttheParade": ("Boost the Parade", "IZZY", 4, "Give all friendly minions +1/+1.", "RARE"),
    "BottledFlame": ("Bottled Flame", "JIMMY", 1, "Deal 2 damage to a minion.", "COMMON"),
    "BottledWater": ("Bottled Water", "ANDERS", 1, "Restore 3 Health to a character.", "COMMON"),
    "CalltoArms": ("Call to Arms", "ASTRID", 5, "Summon three 2/1 Guardians with Taunt.", "EPIC"),
    "ChestofFortitude": ("Chest of Fortitude", "ASTRID", 2, "Give a friendly minion Divine Shield.", "COMMON"),
    "ChestofReplenishingIce": ("Chest of Replenishing Ice", "ANDERS", 3, "Freeze an enemy. Draw a card.", "RARE"),
    "CoastalTyphoon": ("Coastal Typhoon", "IZZY", 5, "Deal 3 damage to all enemy minions.", "EPIC"),
    "ConcealedinIce": ("Concealed in Ice", "ANDERS", 2, "Freeze an enemy minion.", "COMMON"),
    "CrimsonCells": ("Crimson Cells", "DES", 2, "Deal 3 damage to your hero. Draw 2 cards.", "COMMON"),
    "CultivatingAcacia": ("Cultivating Acacia", "TALA", 2, "Restore 4 Health to a character.", "COMMON"),
    "DeathsDescent": ("Death's Descent", "DES", 6, "Destroy all minions with 3 or less Attack.", "EPIC"),
    "DestroyYourSurroundings": ("Destroy Your Surroundings", "DES", 5, "Destroy a random enemy minion.", "RARE"),
    "ElixirofDomination": ("Elixir of Domination", "DES", 4, "Take control of an enemy minion with 3 or less Attack.", "EPIC"),
    "EmergingSunshine": ("Emerging Sunshine", "TALA", 2, "Restore 4 Health to all friendly characters.", "RARE"),
    "EngulfedinFlames": ("Engulfed in Flames", "JIMMY", 7, "Deal 5 damage to all characters.", "EPIC"),
    "EquipmentUpgrade": ("Equipment Upgrade", "DEREK", 2, "Give your weapon +1/+1.", "COMMON"),
    "ExtremeGusts": ("Extreme Gusts", "IZZY", 3, "Return an enemy minion to their hand.", "COMMON"),
    "FacetoFace": ("Face to Face", "LUCAS", 2, "Deal 3 damage to the enemy hero.", "COMMON"),
    "FocusofReturn": ("Focus of Return", "LUCAS", 1, "Return a friendly minion to your hand.", "COMMON"),
    "GiantSlayer": ("Giant Slayer", "JIMMY", 3, "Deal 4 damage to a minion with 5 or more Attack.", "RARE"),
    "Hailstorm": ("Hailstorm", "ANDERS", 4, "Deal 2 damage to all enemy minions. Freeze them.", "EPIC"),
    "HuntingTrophy": ("Hunting Trophy", "LUCAS", 3, "Destroy a damaged enemy minion.", "RARE"),
    "IceStorm": ("Ice Storm", "ANDERS", 5, "Freeze all enemy minions.", "RARE"),
    "ManufactureReinforcements": ("Manufacture Reinforcements", "AVA", 4, "Summon three 1/1 Gadget Drones.", "RARE"),
    "NaturesEnd": ("Nature's End", "TALA", 4, "Destroy a minion with 5 or more Attack.", "RARE"),
    "NaturesWrath": ("Nature's Wrath", "TALA", 6, "Deal 4 damage to all enemy minions.", "EPIC"),
    "NothingtoSeeHere": ("Nothing to See Here", "LUCAS", 3, "Give a friendly minion Stealth.", "COMMON"),
    "NullificationField": ("Nullification Field", "AVA", 5, "Silence all enemy minions.", "EPIC"),
    "PenetratingGale": ("Penetrating Gale", "IZZY", 2, "Deal 2 damage to a character.", "COMMON"),
    "PotionofStrength": ("Potion of Strength", "NEUTRAL", 2, "Give a minion +2/+2.", "COMMON"),
    "PreventDestruction": ("Prevent Destruction", "ASTRID", 3, "Give a friendly minion Divine Shield and Taunt.", "RARE"),
    "QuickFix": ("Quick Fix", "DEREK", 1, "Restore a minion to full Health.", "COMMON"),
    "Reassign": ("Reassign", "DEREK", 3, "Return a minion to its owner's hand.", "COMMON"),
    "Recall": ("Recall", "DEREK", 1, "Return a friendly minion to your hand. Draw a card.", "RARE"),
    "Recycle": ("Recycle", "AVA", 2, "Destroy a friendly minion. Draw 2 cards.", "RARE"),
    "RecycleResources": ("Recycle Resources", "AVA", 3, "Destroy a friendly mech. Summon a random mech that costs (2) more.", "RARE"),
    "ReEnergizer": ("Re-Energizer", "IZZY", 2, "Gain 2 Armor. Draw a card.", "COMMON"),
    "RelentlessStampede": ("Relentless Stampede", "TALA", 5, "Give your minions +2 Attack this turn.", "RARE"),
    "Resourcefulness": ("Resourcefulness", "DEREK", 2, "Draw 2 cards.", "RARE"),
    "RollofRepurpose": ("Roll of Repurpose", "AVA", 1, "Deal 1 damage to a minion. Draw a card.", "COMMON"),
    "SmallDiscovery": ("Small Discovery", "NEUTRAL", 1, "Draw a card.", "COMMON"),
    "SneakySneaky": ("Sneaky Sneaky", "LUCAS", 2, "Give a friendly minion Stealth and +1/+1.", "RARE"),
    "StolenIdentity": ("Stolen Identity", "DES", 3, "Copy a random enemy minion and add it to your hand.", "RARE"),
    "StrategicPlans": ("Strategic Plans", "ASTRID", 2, "Draw 2 cards. Gain 2 Armor.", "RARE"),
    "TimelyRestock": ("Timely Restock", "NEUTRAL", 3, "Draw 2 cards.", "COMMON"),
    "TinySpark": ("Tiny Spark", "AVA", 1, "Deal 1 damage.", "COMMON"),
    "Trample": ("Trample", "TALA", 3, "A friendly minion deals its Attack damage to an adjacent enemy.", "RARE"),
    "Triumphant": ("Triumphant", "ASTRID", 4, "Give a friendly minion +3/+3 and Divine Shield.", "EPIC"),
    "TwilightsJudgment": ("Twilight's Judgment", "DES", 4, "Deal 3 damage to all minions.", "RARE"),
    "UncoverTreasure": ("Uncover Treasure", "IZZY", 2, "Gain 3 Armor. Draw a card.", "COMMON"),
    "WarningShot": ("Warning Shot", "JIMMY", 0, "Deal 1 damage to the enemy hero.", "COMMON"),
}

# ── Hero-labeled images → class-specific minions ──
HERO_LABELED = {
    "ASTRID (CalculatedForce_Final)": ("Calculated Force", "ASTRID", 5, 4, 5, "Battlecry: Give all friendly minions Divine Shield.", "EPIC"),
    "ASTRID (Tessa_Final)": ("Tessa, Shield Captain", "ASTRID", 4, 3, 5, "Taunt. Battlecry: Gain 3 Armor.", "RARE"),
    "AVA (BreakthroughInnovation_Final)": ("Breakthrough Innovation", "AVA", 6, 4, 5, "Battlecry: Summon two 2/2 Guardian Drones.", "EPIC"),
    "AVA (Lila_Final)": ("Lila, Tech Prodigy", "AVA", 3, 2, 4, "Battlecry: Give a friendly mech +2/+2.", "RARE"),
    "FIONA (Acro_Final)": ("Fiona, Acrobat", "AVA", 4, 3, 3, "Stealth. Deathrattle: Draw a card.", "RARE"),
    "IZZY (Brittana_Final)": ("Brittana, Sparkle Scout", "IZZY", 3, 3, 4, "Battlecry: Gain 2 Armor.", "RARE"),
    "IZZY (Jayelin_Final)": ("Jayelin, Ice Runner", "IZZY", 5, 4, 5, "Battlecry: Gain 4 Armor.", "EPIC"),
    "LINUS (SirHelioMP_Final)": ("Sir Helio, Mech Paladin", "DEREK", 6, 5, 6, "Taunt. Divine Shield.", "EPIC"),
    "LUCAS (Hugo_Final)": ("Hugo, Shadow Blade", "LUCAS", 5, 5, 4, "Combo: Deal 3 damage to any target.", "EPIC"),
    "LUCAS (Kusai_Final)": ("Kusai, Desert Runner", "LUCAS", 3, 4, 3, "Combo: Gain Stealth.", "RARE"),
    "MR. VERDANT (Nikolai_Final)": ("Mr. Verdant", "TALA", 6, 4, 6, "Battlecry: Restore 5 Health to all friendly characters.", "EPIC"),
    "MS. MIRABELLA (Elizabeth_Final)": ("Ms. Mirabella", "NEUTRAL", 5, 3, 5, "Battlecry: Draw 2 cards.", "EPIC"),
    "MS. EASLEY (Geo_Final": ("Ms. Easley", "NEUTRAL", 4, 3, 4, "Battlecry: Deal 2 damage to a random enemy.", "RARE"),
    "SENGA BlownAway_Final": ("Senga, Wind Rider", "IZZY", 4, 4, 3, "Windfury.", "RARE"),
}

# ── Character names (minions) ─────────────────────────────────────
# (name, heroClass, manaCost, attack, health, text, rarity)
CHARACTERS = {
    "Aemilio": ("Aemilio", "NEUTRAL", 3, 3, 4, "", "COMMON"),
    "Alexis": ("Alexis", "ASTRID", 3, 2, 5, "Taunt.", "COMMON"),
    "Asmita": ("Asmita", "TALA", 4, 3, 5, "Battlecry: Restore 3 Health to your hero.", "RARE"),
    "Ayto": ("Ayto", "LUCAS", 2, 3, 2, "Combo: Gain +1/+1.", "COMMON"),
    "Boris": ("Boris", "NEUTRAL", 5, 5, 5, "Taunt.", "COMMON"),
    "BorisAnvil": ("Boris, Anvil Guard", "NEUTRAL", 6, 4, 7, "Taunt. Battlecry: Gain 3 Armor.", "RARE"),
    "Brea": ("Brea", "TALA", 2, 2, 3, "Battlecry: Restore 2 Health to a friendly character.", "COMMON"),
    "Bronson": ("Bronson", "JIMMY", 4, 4, 3, "Charge.", "RARE"),
    "Brutus": ("Brutus", "JIMMY", 6, 6, 5, "Charge.", "EPIC"),
    "Calix": ("Calix", "ANDERS", 3, 2, 4, "Battlecry: Freeze a random enemy minion.", "COMMON"),
    "Carmi": ("Carmi", "IZZY", 2, 2, 3, "Battlecry: Gain 1 Armor.", "COMMON"),
    "Caspian": ("Caspian", "ANDERS", 5, 4, 5, "Freeze any character damaged by this minion.", "RARE"),
    "Chip": ("Chip", "AVA", 1, 1, 2, "Battlecry: Add a 1/1 Gadget Drone to your hand.", "COMMON"),
    "Chomp": ("Chomp", "NEUTRAL", 4, 5, 4, "Battlecry: Deal 1 damage to all other minions.", "RARE"),
    "Chuck": ("Chuck", "JIMMY", 2, 3, 2, "", "COMMON"),
    "Cicero": ("Cicero", "LUCAS", 4, 3, 4, "Stealth. Combo: Draw a card.", "RARE"),
    "Convex": ("Convex", "DEREK", 3, 3, 3, "Battlecry: Draw a card if you control a mech.", "COMMON"),
    "Cynthie": ("Cynthie", "IZZY", 3, 2, 4, "Battlecry: Gain 2 Armor.", "COMMON"),
    "Eddie": ("Eddie", "JIMMY", 3, 3, 3, "Battlecry: Deal 1 damage to a random enemy.", "COMMON"),
    "Elle": ("Elle", "ASTRID", 2, 2, 3, "Divine Shield.", "RARE"),
    "Embra": ("Embra", "JIMMY", 5, 4, 4, "Battlecry: Deal 3 damage to a random enemy minion.", "RARE"),
    "Emmy": ("Emmy", "TALA", 3, 2, 4, "Battlecry: Restore 3 Health to all friendly minions.", "RARE"),
    "Emyren": ("Emyren", "NEUTRAL", 4, 3, 5, "Taunt.", "COMMON"),
    "Ezra": ("Ezra", "DES", 3, 4, 3, "Battlecry: Deal 2 damage to your hero.", "COMMON"),
    "Farrah": ("Farrah", "LUCAS", 3, 3, 3, "Stealth.", "COMMON"),
    "Felix": ("Felix", "NEUTRAL", 2, 2, 3, "", "COMMON"),
    "Fenris": ("Fenris", "JIMMY", 5, 5, 4, "Deathrattle: Deal 2 damage to all enemies.", "EPIC"),
    "Freya": ("Freya", "TALA", 5, 3, 6, "Battlecry: Restore 4 Health to your hero.", "RARE"),
    "Garf": ("Garf", "NEUTRAL", 3, 4, 3, "", "COMMON"),
    "Giga": ("Giga", "AVA", 5, 4, 5, "Battlecry: Summon a 1/1 Gadget Drone.", "COMMON"),
    "Giova": ("Giova", "NEUTRAL", 2, 2, 2, "Battlecry: Draw a card.", "RARE"),
    "Glacius": ("Glacius", "ANDERS", 6, 5, 6, "Freeze any character damaged by this minion.", "EPIC"),
    "Glasglow": ("Glasglow", "ANDERS", 4, 3, 4, "Battlecry: Freeze a random enemy.", "RARE"),
    "GPU": ("GPU", "DEREK", 4, 3, 4, "Battlecry: Draw a card for each mech you control.", "EPIC"),
    "Harley": ("Harley", "LUCAS", 2, 2, 2, "Combo: Gain +2 Attack.", "COMMON"),
    "Infernic": ("Infernic", "JIMMY", 8, 7, 7, "Battlecry: Deal 4 damage to all enemy minions.", "LEGENDARY"),
    "Ivana": ("Ivana", "ANDERS", 3, 2, 4, "Battlecry: Freeze an enemy minion.", "COMMON"),
    "Jasten": ("Jasten", "ASTRID", 4, 3, 5, "Taunt. Divine Shield.", "EPIC"),
    "Jetstream": ("Jetstream", "IZZY", 4, 4, 3, "Windfury.", "RARE"),
    "Jie": ("Jie", "LUCAS", 3, 3, 3, "Combo: Return an enemy minion to their hand.", "RARE"),
    "Jorge": ("Jorge", "NEUTRAL", 4, 4, 4, "", "COMMON"),
    "Juni": ("Juni", "TALA", 2, 1, 3, "Battlecry: Restore 3 Health to a friendly character.", "COMMON"),
    "Junk": ("Junk", "DEREK", 2, 2, 3, "Deathrattle: Add a random mech to your hand.", "RARE"),
    "Kabistan": ("Kabistan", "DES", 5, 5, 4, "Deathrattle: Deal 2 damage to all characters.", "RARE"),
    "Kandu": ("Kandu", "TALA", 4, 3, 5, "Battlecry: Give a friendly minion +1/+2.", "COMMON"),
    "Kato": ("Kato", "LUCAS", 4, 5, 3, "Combo: Deal 2 damage to the enemy hero.", "RARE"),
    "Kite": ("Kite", "IZZY", 2, 2, 2, "Windfury.", "COMMON"),
    "Klein": ("Klein", "DEREK", 3, 2, 4, "Battlecry: Give a friendly mech +1/+1.", "COMMON"),
    "Kron": ("Kron", "NEUTRAL", 6, 6, 6, "", "COMMON"),
    "LadyArinna": ("Lady Arinna", "ASTRID", 6, 4, 7, "Taunt. Battlecry: Give adjacent minions Divine Shield.", "LEGENDARY"),
    "Lateo": ("Lateo", "DES", 4, 4, 4, "Deathrattle: Deal 3 damage to the enemy hero.", "RARE"),
    "Liam": ("Liam", "NEUTRAL", 3, 3, 3, "Battlecry: Draw a card.", "COMMON"),
    "LittleDipper": ("Little Dipper", "IZZY", 1, 1, 2, "Battlecry: Gain 1 Armor.", "COMMON"),
    "Lucy": ("Lucy", "TALA", 3, 2, 4, "Battlecry: Restore 2 Health to all friendly characters.", "COMMON"),
    "MaestroWaulie": ("Maestro Waulie", "NEUTRAL", 5, 3, 5, "Battlecry: Draw 2 cards.", "LEGENDARY"),
    "Markus": ("Markus", "JIMMY", 3, 4, 2, "Charge.", "COMMON"),
    "Maso": ("Maso", "DES", 2, 3, 2, "Battlecry: Deal 1 damage to your hero.", "COMMON"),
    "Max": ("Max", "NEUTRAL", 2, 2, 2, "", "COMMON"),
    "Megabyte": ("Megabyte", "DEREK", 5, 4, 5, "Battlecry: Draw a card.", "COMMON"),
    "Mercurio": ("Mercurio", "LUCAS", 5, 4, 4, "Stealth. Combo: Gain +2/+2.", "EPIC"),
    "Merva": ("Merva", "TALA", 4, 2, 6, "Taunt. Battlecry: Restore 2 Health to adjacent minions.", "RARE"),
    "Mina": ("Mina", "NEUTRAL", 2, 1, 3, "Taunt.", "COMMON"),
    "Mirabelle": ("Mirabelle", "NEUTRAL", 4, 3, 4, "Battlecry: Draw a card.", "COMMON"),
    "Monico": ("Monico", "ANDERS", 2, 2, 3, "", "COMMON"),
    "Morris": ("Morris", "NEUTRAL", 3, 3, 3, "", "COMMON"),
    "NovaRamiro": ("Nova Ramiro", "JIMMY", 7, 6, 6, "Battlecry: Deal 3 damage to all enemies.", "EPIC"),
    "Omar": ("Omar", "NEUTRAL", 4, 4, 4, "Taunt.", "COMMON"),
    "Ozone": ("Ozone", "ANDERS", 5, 4, 4, "Battlecry: Freeze all enemy minions.", "LEGENDARY"),
    "Peep": ("Peep", "AVA", 1, 1, 1, "Deathrattle: Draw a card.", "COMMON"),
    "Percy": ("Percy", "NEUTRAL", 3, 2, 4, "Taunt.", "COMMON"),
    "Pierre": ("Pierre", "NEUTRAL", 5, 4, 5, "", "COMMON"),
    "Pinch": ("Pinch", "LUCAS", 1, 1, 2, "Combo: Deal 1 damage to the enemy hero.", "COMMON"),
    "Plup": ("Plup", "TALA", 1, 1, 2, "", "COMMON"),
    "Poke": ("Poke", "LUCAS", 1, 2, 1, "Combo: Gain Stealth.", "COMMON"),
    "Rahul": ("Rahul", "NEUTRAL", 5, 5, 5, "Battlecry: Gain 3 Armor.", "RARE"),
    "Raphael": ("Raphael", "ASTRID", 5, 4, 6, "Taunt. Battlecry: Gain 2 Armor.", "RARE"),
    "Raye": ("Raye", "IZZY", 4, 3, 4, "Battlecry: Gain 3 Armor.", "COMMON"),
    "Recorder": ("Recorder", "DEREK", 2, 1, 3, "Battlecry: Draw a card.", "COMMON"),
    "Rhea": ("Rhea", "NEUTRAL", 4, 3, 5, "Battlecry: Restore 3 Health to your hero.", "COMMON"),
    "Roderick": ("Roderick", "ASTRID", 4, 3, 5, "Taunt.", "COMMON"),
    "Romulus": ("Romulus", "DES", 6, 5, 5, "Deathrattle: Summon a 4/4 Shadow.", "EPIC"),
    "RoRo": ("RoRo", "NEUTRAL", 1, 1, 1, "Deathrattle: Draw a card.", "COMMON"),
    "Ruby": ("Ruby", "JIMMY", 2, 2, 2, "Battlecry: Deal 1 damage to a random enemy.", "COMMON"),
    "SallE": ("Sall-E", "AVA", 3, 2, 4, "Deathrattle: Summon a 1/1 Gadget Drone.", "COMMON"),
    "Selena": ("Selena", "DES", 4, 3, 4, "Stealth. Deathrattle: Deal 2 damage to the enemy hero.", "RARE"),
    "Shazarda": ("Shazarda", "DES", 7, 6, 6, "Deathrattle: Deal 3 damage to all enemies.", "EPIC"),
    "Sho": ("Sho", "LUCAS", 3, 4, 2, "Combo: Draw a card.", "COMMON"),
    "Skales": ("Skales", "NEUTRAL", 5, 4, 5, "Taunt.", "COMMON"),
    "Spence": ("Spence", "DEREK", 2, 2, 2, "Battlecry: Add a spare part to your hand.", "COMMON"),
    "Stern": ("Stern", "JIMMY", 4, 5, 3, "Battlecry: Deal 1 damage to all enemies.", "COMMON"),
    "Stix": ("Stix", "TALA", 1, 2, 1, "", "COMMON"),
    "Sygna": ("Sygna", "IZZY", 5, 4, 5, "Battlecry: Gain 4 Armor.", "RARE"),
    "Tamara": ("Tamara", "ASTRID", 3, 2, 4, "Divine Shield.", "RARE"),
    "Tandem": ("Tandem", "LUCAS", 4, 4, 3, "Combo: Gain +2/+1.", "COMMON"),
    "Tayvon": ("Tayvon", "JIMMY", 3, 3, 2, "Battlecry: Deal 2 damage to a random enemy.", "COMMON"),
    "TheAnarchist": ("The Anarchist", "DES", 5, 6, 4, "Battlecry: Destroy a random enemy minion.", "LEGENDARY"),
    "TheGrandSequoia": ("The Grand Sequoia", "TALA", 8, 5, 8, "Taunt. Battlecry: Restore 5 Health to all friendly characters.", "LEGENDARY"),
    "TheSearingAnvil": ("The Searing Anvil", "JIMMY", 4, 3, 4, "Your other minions have +1 Attack.", "RARE"),
    "TheZipper": ("The Zipper", "DEREK", 3, 2, 3, "Battlecry: Return a friendly minion to your hand.", "COMMON"),
    "Tori": ("Tori", "NEUTRAL", 3, 3, 3, "", "COMMON"),
    "Trav": ("Trav", "NEUTRAL", 4, 4, 4, "", "COMMON"),
    "Trax": ("Trax", "DEREK", 4, 4, 3, "Deathrattle: Summon a 2/2 mech.", "COMMON"),
    "Trickwing": ("Trickwing", "LUCAS", 2, 2, 2, "Stealth.", "COMMON"),
    "TrimmerV1": ("Trimmer V1", "DEREK", 3, 3, 2, "Deathrattle: Deal 2 damage to a random enemy.", "COMMON"),
    "Trinity": ("Trinity", "ASTRID", 5, 3, 6, "Taunt. Divine Shield.", "EPIC"),
    "Tumbler": ("Tumbler", "NEUTRAL", 2, 3, 2, "", "COMMON"),
    "Tybiel": ("Tybiel", "NEUTRAL", 6, 5, 6, "Battlecry: Restore 4 Health to your hero.", "RARE"),
    "Ulan": ("Ulan", "DES", 5, 5, 5, "Deathrattle: Deal 2 damage to all minions.", "RARE"),
    "Vanilla": ("Vanilla", "TALA", 3, 2, 4, "Battlecry: Restore 3 Health to a friendly character.", "COMMON"),
    "Vince": ("Vince", "NEUTRAL", 4, 4, 3, "Charge.", "RARE"),
    "Vlad": ("Vlad", "DES", 4, 4, 4, "Deathrattle: Deal 2 damage to the enemy hero.", "COMMON"),
    "Vortex": ("Vortex", "ANDERS", 4, 3, 5, "Battlecry: Freeze two random enemy minions.", "RARE"),
    "Voulder": ("Voulder", "NEUTRAL", 7, 7, 7, "Taunt.", "COMMON"),
    "Vrasp": ("Vrasp", "DES", 3, 4, 2, "Stealth.", "COMMON"),
    "Vyren": ("Vyren", "DES", 6, 5, 5, "Battlecry: Destroy a random enemy minion.", "RARE"),
    "Whizz": ("Whizz", "AVA", 2, 2, 2, "Battlecry: Summon a 1/1 Gadget Drone.", "COMMON"),
    "Xiao": ("Xiao", "ANDERS", 2, 2, 3, "Freeze any character damaged by this minion.", "RARE"),
    "Yip": ("Yip", "NEUTRAL", 1, 1, 2, "", "COMMON"),
    "Yvette": ("Yvette", "ASTRID", 3, 2, 4, "Battlecry: Give a friendly minion Taunt.", "COMMON"),
    "Zahava": ("Zahava", "IZZY", 6, 5, 6, "Battlecry: Gain 5 Armor.", "EPIC"),
    "Zhang": ("Zhang", "NEUTRAL", 5, 5, 4, "Battlecry: Deal 2 damage to a random enemy.", "COMMON"),
}

# ── Robots → Derek class mechs ─────────────────────────────────────
ROBOTS = {
    "Andrii": ("Andrii", 4, 4, 3, "Deathrattle: Deal 2 damage to a random enemy.", "COMMON"),
    "Bjorn": ("Bjorn", 5, 4, 5, "Taunt.", "COMMON"),
    "Candice": ("Candice", 3, 3, 3, "", "COMMON"),
    "Caytum": ("Caytum", 4, 3, 4, "Battlecry: Draw a card.", "RARE"),
    "HelixianRecycler": ("Helixian Recycler", 5, 3, 5, "Deathrattle: Add a random mech to your hand.", "RARE"),
    "HelixRobot": ("Helix Robot", 3, 3, 2, "Charge.", "COMMON"),
    "Pero": ("Pero", 2, 2, 2, "", "COMMON"),
    "Prema": ("Prema", 6, 5, 6, "Taunt. Deathrattle: Summon a 3/3 mech.", "EPIC"),
    "Skip": ("Skip", 1, 1, 2, "Deathrattle: Draw a card.", "COMMON"),
    "TalbotL": ("Talbot L", 7, 6, 7, "Taunt. Deathrattle: Summon a 4/4 mech.", "EPIC"),
    "TalbotM": ("Talbot M", 5, 4, 5, "Taunt.", "COMMON"),
    "TalbotS": ("Talbot S", 3, 2, 3, "Deathrattle: Summon a 1/1 mech.", "COMMON"),
    "Zims": ("Zims", 2, 2, 3, "Battlecry: Give a friendly mech +1 Attack.", "COMMON"),
}

# ── Hero portraits (map to existing cards or use for hero images) ──
HERO_PORTRAITS = {
    "Jimmy_Final.png": "JIMMY",
    "Tala_Final.png": "TALA",
    "Derek_Final.png": "DEREK",
}

# ── Skip these (variants, duplicates) ──
SKIP = {
    "ASTRID Tessa_Final Only Tessa",
    "BloodthirstyPolearm_Final No Blood",
    "CardboardPickaxe_Final Axe Only",
    "SallE_Final Bees Only",
    "ShieldofFragility_Final Shield Only",
    "Ulan_Final No Blood",
    "WarningShot_Final No Human",
}


def get_stem(filename):
    """Extract the name stem from a filename."""
    name = filename
    # Remove extension
    for ext in ['.png', '.jpg', '.jpeg']:
        if name.lower().endswith(ext):
            name = name[:-len(ext)]
    # Remove _Final, _FINAL suffixes
    name = re.sub(r'[_ ]FINAL$', '', name, flags=re.IGNORECASE)
    name = re.sub(r'_Final$', '', name)
    return name


def build_mapping():
    """Build the complete mapping and new card list."""

    # Load existing cards
    with open('data/cards.json') as f:
        existing_cards = json.load(f)

    # Track next available codes per class
    code_counters = {}
    loc_counters = {}
    for card in existing_cards:
        code = card['cardCode']
        hc = card['heroClass']
        prefix_map = {
            'JIMMY': 'JIM', 'TALA': 'TAL', 'DEREK': 'DRK', 'ANDERS': 'AND',
            'DES': 'DES', 'ASTRID': 'AST', 'AVA': 'AVA', 'LUCAS': 'LUC',
            'IZZY': 'IZZ', 'NEUTRAL': 'NEU'
        }
        prefix = prefix_map.get(hc, 'NEU')

        # Track numbered codes
        m = re.match(rf'^{prefix}(\d+)$', code)
        if m:
            num = int(m.group(1))
            code_counters[prefix] = max(code_counters.get(prefix, 0), num)

        # Track location codes
        m = re.match(rf'^{prefix}_LOC(\d+)$', code) or re.match(rf'^(\w+)_LOC(\d+)$', code)
        if m:
            groups = m.groups()
            loc_prefix = groups[0] if len(groups) == 2 else prefix
            loc_num = int(groups[-1])
            loc_counters[loc_prefix] = max(loc_counters.get(loc_prefix, 0), loc_num)

    prefix_map = {
        'JIMMY': 'JIM', 'TALA': 'TAL', 'DEREK': 'DRK', 'ANDERS': 'AND',
        'DES': 'DES', 'ASTRID': 'AST', 'AVA': 'AVA', 'LUCAS': 'LUC',
        'IZZY': 'IZZ', 'NEUTRAL': 'NEU'
    }

    def next_code(hero_class):
        prefix = prefix_map[hero_class]
        code_counters[prefix] = code_counters.get(prefix, 0) + 1
        return f"{prefix}{code_counters[prefix]:03d}"

    def next_loc_code(hero_class):
        prefix = prefix_map[hero_class]
        loc_counters[prefix] = loc_counters.get(prefix, 0) + 1
        return f"{prefix}_LOC{loc_counters[prefix]:02d}"

    art_map = {}  # filename -> cardCode
    new_cards = []  # new card entries

    # ── Process all PNGs ──
    png_files = sorted(os.listdir(PNG_DIR))

    for filename in png_files:
        if not filename.lower().endswith('.png'):
            continue
        if filename.endswith('.psd'):
            continue

        stem = get_stem(filename)

        # Skip variants
        if stem in SKIP:
            continue

        # Skip card backs and orra crystals (handled separately)
        if 'Miro_CardBack' in filename or 'BasicOrra' in filename:
            continue

        # ── Hero portraits ──
        if filename in HERO_PORTRAITS:
            # Map to hero portrait, not a card
            art_map[filename] = f"HERO_{HERO_PORTRAITS[filename]}"
            continue

        # ── Locations ──
        loc_stem = stem.split('_Final')[0].split(' _Final')[0]
        if loc_stem in LOCATIONS or stem in LOCATIONS:
            key = loc_stem if loc_stem in LOCATIONS else stem
            display_name, hero_class = LOCATIONS[key]
            card_code = next_loc_code(hero_class)
            art_map[filename] = card_code
            new_cards.append({
                "cardCode": card_code,
                "name": display_name,
                "manaCost": 3,
                "type": "LOCATION",
                "heroClass": hero_class,
                "rarity": "RARE",
                "attack": 0,
                "health": 3,
                "text": "",
                "flavor": "",
                "keywords": []
            })
            continue

        # ── Weapons ──
        weapon_key = None
        for k in WEAPONS:
            if k in stem or stem.startswith(k):
                weapon_key = k
                break
        if weapon_key:
            name, hero_class, cost, atk, dur = WEAPONS[weapon_key]
            card_code = next_code(hero_class)
            art_map[filename] = card_code
            new_cards.append({
                "cardCode": card_code,
                "name": name,
                "manaCost": cost,
                "type": "WEAPON",
                "heroClass": hero_class,
                "rarity": "RARE",
                "attack": atk,
                "health": dur,
                "text": "",
                "flavor": "",
                "keywords": []
            })
            continue

        # ── Spells ──
        spell_key = None
        for k in SPELLS:
            if k in stem or stem.startswith(k):
                spell_key = k
                break
        if spell_key:
            name, hero_class, cost, text, rarity = SPELLS[spell_key]
            card_code = next_code(hero_class)
            art_map[filename] = card_code
            new_cards.append({
                "cardCode": card_code,
                "name": name,
                "manaCost": cost,
                "type": "SPELL",
                "heroClass": hero_class,
                "rarity": rarity,
                "attack": 0,
                "health": 0,
                "text": text,
                "flavor": "",
                "keywords": []
            })
            continue

        # ── Hero-labeled cards ──
        hero_key = None
        for k in HERO_LABELED:
            if stem == k or stem.startswith(k.split('(')[0].strip()):
                # More precise matching for hero-labeled
                if k.replace('.png', '') in filename.replace('.png', ''):
                    hero_key = k
                    break
        # Try exact match
        for k in HERO_LABELED:
            clean_k = k.replace('.png', '').replace('_Final', '').replace(')', '')
            clean_stem = stem.replace('_Final', '').replace(')', '')
            if clean_stem == clean_k or filename.startswith(k.split('(')[0].strip() + ' (') or filename.startswith(k.split('(')[0].strip() + '('):
                hero_key = k
                break
        if hero_key:
            name, hero_class, cost, atk, hp, text, rarity = HERO_LABELED[hero_key]
            card_code = next_code(hero_class)
            art_map[filename] = card_code
            new_cards.append({
                "cardCode": card_code,
                "name": name,
                "manaCost": cost,
                "type": "MINION",
                "heroClass": hero_class,
                "rarity": rarity,
                "attack": atk,
                "health": hp,
                "text": text,
                "flavor": "",
                "keywords": []
            })
            continue

        # ── Robots (Derek class mechs) ──
        robot_key = None
        for k in ROBOTS:
            if k in stem and 'ROBOT' in filename:
                robot_key = k
                break
        if robot_key:
            name, cost, atk, hp, text, rarity = ROBOTS[robot_key]
            card_code = next_code("DEREK")
            art_map[filename] = card_code
            card_entry = {
                "cardCode": card_code,
                "name": name,
                "manaCost": cost,
                "type": "MINION",
                "heroClass": "DEREK",
                "rarity": rarity,
                "attack": atk,
                "health": hp,
                "text": text,
                "flavor": "",
                "keywords": [],
                "minionType": "MECH"
            }
            new_cards.append(card_entry)
            continue

        # ── Character minions ──
        char_key = None
        for k in CHARACTERS:
            if k == stem or stem.startswith(k):
                char_key = k
                break
        if char_key:
            name, hero_class, cost, atk, hp, text, rarity = CHARACTERS[char_key]
            card_code = next_code(hero_class)
            art_map[filename] = card_code
            keywords = []
            if "Taunt" in text:
                keywords.append("TAUNT")
            if "Charge" in text:
                keywords.append("CHARGE")
            if "Divine Shield" in text:
                keywords.append("DIVINE_SHIELD")
            if "Stealth" in text:
                keywords.append("STEALTH")
            if "Windfury" in text:
                keywords.append("WINDFURY")
            if "Battlecry" in text:
                keywords.append("BATTLECRY")
            if "Deathrattle" in text:
                keywords.append("DEATHRATTLE")
            if "Combo" in text:
                keywords.append("COMBO")
            new_cards.append({
                "cardCode": card_code,
                "name": name,
                "manaCost": cost,
                "type": "MINION",
                "heroClass": hero_class,
                "rarity": rarity,
                "attack": atk,
                "health": hp,
                "text": text,
                "flavor": "",
                "keywords": keywords
            })
            continue

        # If nothing matched, print it
        print(f"UNMATCHED: {filename} (stem: {stem})")

    # Save mapping
    with open('data/cardArtMap.json', 'w') as f:
        json.dump(art_map, f, indent=2)

    # Save new cards
    all_cards = existing_cards + new_cards
    with open('data/cards.json', 'w') as f:
        json.dump(all_cards, f, indent=2)

    print(f"\nTotal PNGs mapped: {len(art_map)}")
    print(f"New cards created: {len(new_cards)}")
    print(f"Total cards now: {len(all_cards)}")
    print(f"\nMapping saved to data/cardArtMap.json")
    print(f"Updated cards saved to data/cards.json")

    # Print breakdown by class
    class_counts = {}
    for card in new_cards:
        hc = card['heroClass']
        class_counts[hc] = class_counts.get(hc, 0) + 1
    print("\nNew cards by class:")
    for hc, count in sorted(class_counts.items()):
        print(f"  {hc}: {count}")


if __name__ == '__main__':
    build_mapping()
