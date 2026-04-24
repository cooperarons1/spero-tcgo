#!/usr/bin/env python3
"""Card linter — catches silently-broken effects in data/cards.json.

Only flags cases where an effect will genuinely no-op at runtime:

  1. effect.type not in server/effects.ts switch at all → real bug.
  2. effect.type requires a single-target (findMinion(targetId))
     but effect.target is a multi-target enum → silent no-op.
     (This is the AVA029 SILENCE_TARGET/ALL_ENEMY_MINIONS family.)
  3. SUMMON_MINION.summonCardCode points to a card that isn't in the pool.
  4. Text/value drift: "Deal 4 damage" text vs effect.value=3 etc.
  5. LIFESTEAL/WINDFURY/TAUNT on a non-MINION (keyword dormant).

Everything else (e.g. DEAL_DAMAGE_ALL_ENEMIES with target='ALL_ENEMY_MINIONS')
is NOT flagged — those handlers read effect.target as an optional flag,
and unknown targets fall through to the default branch.

Usage:  python scripts/card-lint.py
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
CARDS_JSON = REPO_ROOT / "data" / "cards.json"

# Effect types the switch in server/effects.ts actually has a case for.
# If an effect.type isn't in here, it falls through unhandled.
IMPLEMENTED_TYPES = {
    "DEAL_DAMAGE", "RESTORE_HEALTH", "DRAW_CARDS", "SUMMON_MINION",
    "BUFF_MINION", "BUFF_ALL_FRIENDLY", "BUFF_ALL_ENEMY", "DESTROY_MINION",
    "FREEZE_TARGET", "SILENCE_TARGET", "GAIN_ARMOR",
    "DEAL_DAMAGE_ALL_ENEMIES", "DEAL_DAMAGE_ALL_MINIONS",
    "DEAL_DAMAGE_RANDOM_ENEMY", "RETURN_TO_HAND", "GAIN_MANA_CRYSTAL",
    "GAIN_TEMPORARY_MANA", "SPELL_DISCOUNT", "GRANT_KEYWORD",
    "COUNTER_SPELL", "COPY_MINION", "DEAL_DAMAGE_BASED_ON_ARMOR",
    "SWAP_ATTACK_HEALTH", "DRAW_CARDS_CONDITIONAL",
    "DESTROY_ALL_ENEMY_MINIONS", "FREEZE_ALL_ENEMIES",
    "GIVE_DIVINE_SHIELD", "BUFF_ALL_FRIENDLY_MINIONS", "SUMMON_TOKENS",
    "RETURN_TO_HAND_SELF", "BOUNCE_ENEMY_MINIONS_CONDITIONAL",
    "GAIN_ARMOR_AND_DRAW", "HEAL_ALL_FRIENDLY_FULL",
    "DEAL_DAMAGE_ALL_CHARACTERS",
    "STEAL_MINION", "DESTROY_FROZEN_MINION",
}

# Handlers that REQUIRE a targetId to be passed at runtime. If the card
# data carries an AOE target like 'ALL_ENEMY_MINIONS' on one of these,
# the handler's findMinion(targetId) path is a no-op.
# (DEAL_DAMAGE and RESTORE_HEALTH both have SELF/TARGET_HERO shortcuts
# so they don't belong here.)
REQUIRES_SINGLE_TARGET = {
    "BUFF_MINION", "SWAP_ATTACK_HEALTH", "GIVE_DIVINE_SHIELD",
}

# Effect types that have been audited and confirmed to handle multi-target
# branches OR the 'RANDOM_*' branches added as part of this cleanup.
TARGET_BRANCHES_HANDLED = {
    "DESTROY_MINION": {"RANDOM_ENEMY", "RANDOM_FRIENDLY"},  # added 2026-04-22
    "SILENCE_TARGET": {"ALL_ENEMY_MINIONS", "ALL_FRIENDLY_MINIONS"},
    "FREEZE_TARGET": {"ALL_ENEMY_MINIONS", "ALL_MINIONS"},
    "GRANT_KEYWORD": {"ALL_FRIENDLY_MINIONS"},
    "RESTORE_HEALTH": {"ALL_FRIENDLY_MINIONS", "TARGET_HERO", "SELF"},
    "RETURN_TO_HAND": set(),                # secret-sourced targetId
    "DEAL_DAMAGE": {"SELF", "TARGET_ENEMY_HERO"},
}

MULTI_TARGETS = {
    "ALL_ENEMY_MINIONS", "ALL_FRIENDLY_MINIONS", "ALL_MINIONS",
    "ALL_ENEMIES", "RANDOM_ENEMY", "NONE",
}

EFFECT_FIELDS = [
    "battlecryEffect", "battlecryEffects",
    "deathrattleEffect", "deathrattleEffects",
    "spellEffect", "spellEffects",
    "secretEffect", "secretEffects",
    "endOfTurnEffect",
    "comboEffect", "comboEffects",
    "locationEffect", "locationEffects",
]


def walk_effects(card):
    for f in EFFECT_FIELDS:
        val = card.get(f)
        if val is None:
            continue
        if isinstance(val, list):
            for e in val:
                if isinstance(e, dict):
                    yield f, e
        elif isinstance(val, dict):
            yield f, val


def check_effect(cards_by_code, card, field, effect):
    issues = []
    t = effect.get("type")
    if not t:
        issues.append(f"{field}: missing 'type'")
        return issues
    if t not in IMPLEMENTED_TYPES:
        issues.append(f"{field}.type={t} not implemented in server/effects.ts")
        return issues

    target = effect.get("target", "NONE")
    # Secrets pull targetId from the trigger event (e.g. attackerInstanceId),
    # so a card-data target of NONE is expected and not a bug.
    is_secret = field.startswith("secret")
    if (t in REQUIRES_SINGLE_TARGET
        and target in MULTI_TARGETS
        and target not in TARGET_BRANCHES_HANDLED.get(t, set())
        and not is_secret):
        issues.append(
            f"{field}: {t} requires a single target but target={target} "
            f"is a multi-target enum — runtime will no-op"
        )

    # SUMMON_MINION summonCardCode must exist. AST_S02 Second Chance is
    # special-cased in secrets.ts (re-summons the deadMinionCardCode from
    # the trigger context), so missing summonCardCode is intentional.
    if t == "SUMMON_MINION" and card.get("cardCode") != "AST_S02":
        code = effect.get("summonCardCode")
        if not code:
            issues.append(f"{field}: SUMMON_MINION missing summonCardCode")
        elif code not in cards_by_code:
            issues.append(f"{field}: SUMMON_MINION summonCardCode={code} not in pool")

    if t == "SUMMON_TOKENS":
        code = effect.get("tokenCode") or effect.get("summonCardCode")
        if code and code not in cards_by_code:
            issues.append(f"{field}: SUMMON_TOKENS tokenCode={code} not in pool")

    return issues


def check_text_vs_effect(card, field, effect):
    issues = []
    text = (card.get("text") or "").lower()
    if not text:
        return issues
    t = effect.get("type") or ""
    v = effect.get("value")

    if "DAMAGE" in t and v is not None:
        # Accept any "N damage" in the text — the compound case ("Deal 4
        # damage to an enemy and 1 damage to all other enemies" on DRK051)
        # has multiple DAMAGE effects each matching a different number.
        matches = re.findall(r"(\d+) damage", text)
        if matches and str(v) not in matches:
            issues.append(f"{field}: text 'N damage' nums=[{','.join(matches)}] vs value={v}")
    if t == "GAIN_ARMOR" and v is not None:
        matches = re.findall(r"gain (\d+) armor", text)
        if matches and str(v) not in matches:
            issues.append(f"{field}: text 'Gain [{','.join(matches)}] armor' vs value={v}")
    if t == "DRAW_CARDS" and v is not None:
        matches = re.findall(r"draw (\d+) card", text)
        if matches and str(v) not in matches:
            issues.append(f"{field}: text 'Draw [{','.join(matches)}]' vs value={v}")
    if t == "RESTORE_HEALTH" and v is not None:
        matches = re.findall(r"restore (\d+) health", text)
        if matches and str(v) not in matches:
            issues.append(f"{field}: text 'Restore [{','.join(matches)}]' vs value={v}")

    # summon N/M stats vs the actual token stats
    if t in ("SUMMON_MINION", "SUMMON_TOKENS"):
        code = effect.get("summonCardCode") or effect.get("tokenCode")
        if code:
            stat_matches = re.findall(r"summon (?:a |an |two |three |four |five )?(\d+)/(\d+)", text)
            if stat_matches:
                pass  # checked elsewhere against the actual card

    return issues


def check_spell_has_effect(card):
    """A SPELL (non-secret) with non-empty text must have at least one
    effect wired. DRK018 Ancient Knowledge shipped with text='Draw a card.'
    but spellEffect: null — it visibly did nothing when cast. LUC049
    Ancestral Knowledge had the opposite (effect but no text). Both
    are covered here."""
    issues = []
    if card.get('type') != 'SPELL':
        return issues
    if card.get('secretTrigger'):
        return issues  # secrets use secretEffect
    text = (card.get('text') or '').strip()
    has_effect = False
    for f in ('spellEffect', 'spellEffects', 'comboEffect', 'comboEffects'):
        v = card.get(f)
        if isinstance(v, dict) and v.get('type'):
            has_effect = True
            break
        if isinstance(v, list) and len(v) > 0 and any(e.get('type') for e in v if isinstance(e, dict)):
            has_effect = True
            break
    if text and not has_effect:
        issues.append("SPELL has non-empty text but no spellEffect wired — runtime no-op")
    if (not text) and has_effect:
        issues.append("SPELL has an effect but empty text — player has no card-face description")
    return issues


def check_keyword_sanity(card):
    issues = []
    kws = set(card.get("keywords") or [])
    typ = card.get("type", "MINION")
    for kw in ("LIFESTEAL", "WINDFURY", "TAUNT", "CHARGE", "STEALTH", "DIVINE_SHIELD"):
        if kw in kws and typ != "MINION":
            issues.append(
                f"keywords: {kw} on {typ} is dormant "
                f"(only applies to minions in combat)"
            )
    return issues


def main():
    cards = json.loads(CARDS_JSON.read_text())
    cards_by_code = {c["cardCode"]: c for c in cards}

    total = 0
    cards_with_issues = 0
    for c in cards:
        issues = []
        for field, effect in walk_effects(c):
            issues.extend(check_effect(cards_by_code, c, field, effect))
            issues.extend(check_text_vs_effect(c, field, effect))
        issues.extend(check_keyword_sanity(c))
        issues.extend(check_spell_has_effect(c))

        if issues:
            cards_with_issues += 1
            total += len(issues)
            print(f"{c['cardCode']:18} {c['name'][:28]:28}:")
            for i in issues:
                print(f"    - {i}")

    print()
    print(f"== {total} issue(s) across {cards_with_issues} card(s) / {len(cards)} total ==")
    return 1 if total > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
