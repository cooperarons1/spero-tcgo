"""
Animation parameter schema and card feature extraction for the Miro TCG
animation model.

Defines:
  - ANIM_PARAMS: the full animation parameter space (~47 output dims)
  - CARD_FEATURE_DIM: total input feature dimensionality (~50 dims)
  - extract_card_features(): card dict → normalized float vector
  - sample_random_params(): generate a random animation parameter vector
  - PARAM_RANGES: min/max for each parameter (used for normalization + sampling)

Pairs with render_frames.py (consumes params), label.py (consumes features),
and train.py (trains features → params mapping).
"""

from __future__ import annotations

import json
import random
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np

# ── Enums (must match cards.json values) ─────────────────────────────

CARD_TYPES = ["MINION", "SPELL", "WEAPON", "LOCATION"]
RARITIES = ["COMMON", "RARE", "EPIC", "LEGENDARY"]
HERO_CLASSES = [
    "JIMMY", "TALA", "DEREK", "ANDERS", "DES",
    "ASTRID", "AVA", "LUCAS", "IZZY", "NEUTRAL",
]
KEYWORDS = [
    "TAUNT", "CHARGE", "DIVINE_SHIELD", "BATTLECRY", "DEATHRATTLE",
    "FREEZE", "WINDFURY", "STEALTH", "SECRET", "COMBO", "BOND", "COLLAR",
]
EFFECT_TYPES = [
    "DEAL_DAMAGE", "DEAL_DAMAGE_ALL_ENEMIES", "DEAL_DAMAGE_ALL_MINIONS",
    "RESTORE_HEALTH", "DRAW_CARDS", "BUFF_MINION", "BUFF_ALL_FRIENDLY",
    "BUFF_ALL_FRIENDLY_MINIONS", "SUMMON_MINION", "DESTROY_MINION",
    "FREEZE_TARGET", "GRANT_KEYWORD", "GAIN_ARMOR_AND_DRAW",
    "GAIN_TEMPORARY_MANA", "RETURN_TO_HAND", "SILENCE_TARGET",
    "STEAL_MINION", "SPELL_DISCOUNT", "DESTROY_FROZEN_MINION",
    "DEAL_DAMAGE_BASED_ON_ARMOR",
]
ANIM_CONTEXTS = [
    "entrance", "attack", "death", "spell",
    "damage", "buff", "draw", "idle",
]

# ── Feature dimensions ───────────────────────────────────────────────

# card_type(4) + rarity(4) + hero_class(10) + mana(1) + atk(1) + hp(1)
# + keywords(12) + effects(20) + anim_context(8) + target_quality(1) = 62
# The trailing target_quality feature is score-conditional generation:
# at training time it's the sample's normalized Gemma score; at inference
# we always set it to 1.0 so the MLP is asked "what params for this card
# + context produce the HIGHEST-quality animation?" — fixes the v1 model
# collapsing to the mean of random params (val loss ~0.083).
CARD_FEATURE_DIM = (
    len(CARD_TYPES) + len(RARITIES) + len(HERO_CLASSES)
    + 3  # mana, attack, health
    + len(KEYWORDS) + len(EFFECT_TYPES) + len(ANIM_CONTEXTS)
    + 1  # target_quality (v2, 2026-04-19)
)

# ── Animation parameters ─────────────────────────────────────────────

# Each param: (name, min, max, default)
# All values are floats. Durations in seconds, distances in px-equiv,
# counts are integers but stored as float for the network.

PARAM_DEFS: list[tuple[str, float, float, float]] = [
    # Entrance / summon
    ("entrance_duration",     0.15, 0.80, 0.35),
    ("entrance_scale_from",   0.00, 0.80, 0.30),
    ("entrance_scale_to",     0.90, 1.20, 1.00),
    ("entrance_opacity_from", 0.00, 0.50, 0.00),
    ("entrance_translate_y",  -60., 60.0, 30.0),
    ("entrance_overshoot",    0.00, 0.30, 0.05),

    # Attack
    ("attack_lunge_dist",     10.0, 80.0, 40.0),
    ("attack_lunge_dur",      0.10, 0.50, 0.30),
    ("attack_recoil_dur",     0.10, 0.40, 0.20),
    ("attack_shake_intensity", 0.0, 15.0, 5.00),

    # Death
    ("death_fade_dur",        0.20, 0.80, 0.50),
    ("death_scale_to",        0.00, 0.50, 0.00),
    ("death_particle_count",  0.00, 16.0, 8.00),
    ("death_particle_spread", 20.0, 120., 60.0),
    ("death_particle_speed",  40.0, 200., 100.),

    # Spell
    ("spell_proj_dur",        0.15, 0.60, 0.40),
    ("spell_proj_arc",        -40., 40.0, 0.00),
    ("spell_impact_scale",    0.80, 2.00, 1.20),
    ("spell_impact_dur",      0.10, 0.50, 0.30),
    ("spell_impact_brightness", 0.5, 2.0, 1.50),

    # Damage
    ("dmg_flash_dur",         0.10, 0.60, 0.30),
    ("dmg_flash_r",           0.50, 1.00, 1.00),
    ("dmg_flash_g",           0.00, 0.50, 0.10),
    ("dmg_flash_b",           0.00, 0.50, 0.10),
    ("dmg_shake_amp",         0.00, 12.0, 4.00),

    # Buff
    ("buff_pulse_scale",      1.00, 1.40, 1.15),
    ("buff_pulse_dur",        0.20, 0.80, 0.40),
    ("buff_glow_intensity",   0.00, 1.00, 0.60),
    ("buff_glow_r",           0.00, 1.00, 0.30),
    ("buff_glow_g",           0.00, 1.00, 0.90),
    ("buff_glow_b",           0.00, 1.00, 0.30),

    # Draw
    ("draw_slide_dur",        0.20, 0.70, 0.50),
    ("draw_slide_dist",       50.0, 200., 120.),
    ("draw_flip_dur",         0.15, 0.50, 0.30),

    # General modifiers
    ("delay_offset",          0.00, 0.30, 0.00),
    ("color_shift_h",         -30., 30.0, 0.00),
    ("color_shift_s",         -0.3, 0.30, 0.00),
    ("color_shift_l",         -0.2, 0.20, 0.00),
]

PARAM_NAMES = [p[0] for p in PARAM_DEFS]
PARAM_MINS = np.array([p[1] for p in PARAM_DEFS], dtype=np.float32)
PARAM_MAXS = np.array([p[2] for p in PARAM_DEFS], dtype=np.float32)
PARAM_DEFAULTS = np.array([p[3] for p in PARAM_DEFS], dtype=np.float32)
ANIM_PARAM_DIM = len(PARAM_DEFS)


# ── Card feature extraction ──────────────────────────────────────────

def _one_hot(value: str, options: list[str]) -> list[float]:
    return [1.0 if value == o else 0.0 for o in options]


def _multi_hot(values: list[str], options: list[str]) -> list[float]:
    s = set(values)
    return [1.0 if o in s else 0.0 for o in options]


def _get_effect_types(card: dict) -> list[str]:
    """Extract all effect type strings from a card definition."""
    types: list[str] = []
    for key in ("spellEffect", "battlecry", "deathrattle", "heropower"):
        e = card.get(key)
        if e is None:
            continue
        if isinstance(e, list):
            for x in e:
                if isinstance(x, dict) and "type" in x:
                    types.append(x["type"])
        elif isinstance(e, dict) and "type" in e:
            types.append(e["type"])
    return types


def extract_card_features(
    card: dict,
    anim_context: str = "entrance",
    target_quality: float = 1.0,
) -> np.ndarray:
    """
    Convert a card dict (from cards.json) + animation context into a
    fixed-size float feature vector of length CARD_FEATURE_DIM.

    ``target_quality`` is the v2 score-conditional knob: at training time
    it's the sample's Gemma score normalized to [0, 1] (so each example
    tells the model "these random params got this quality"). At inference
    the server always passes 1.0 so the MLP is asked for the best-quality
    params for the given (card, context). Default 1.0 matches the
    inference semantics.
    """
    feats: list[float] = []

    # One-hot categoricals
    feats.extend(_one_hot(card.get("type", "MINION"), CARD_TYPES))
    feats.extend(_one_hot(card.get("rarity", "COMMON"), RARITIES))
    feats.extend(_one_hot(card.get("heroClass", "NEUTRAL"), HERO_CLASSES))

    # Numeric (normalized to ~[0, 1])
    feats.append(min(card.get("manaCost", 0) / 10.0, 1.0))
    feats.append(min(card.get("attack", 0) / 12.0, 1.0))
    feats.append(min(card.get("health", 0) / 12.0, 1.0))

    # Multi-hot
    feats.extend(_multi_hot(card.get("keywords", []), KEYWORDS))
    feats.extend(_multi_hot(_get_effect_types(card), EFFECT_TYPES))

    # Animation context
    feats.extend(_one_hot(anim_context, ANIM_CONTEXTS))

    # v2: score-conditional target. Clamped to [0, 1].
    feats.append(max(0.0, min(1.0, float(target_quality))))

    assert len(feats) == CARD_FEATURE_DIM, f"Expected {CARD_FEATURE_DIM}, got {len(feats)}"
    return np.array(feats, dtype=np.float32)


# ── Parameter sampling ───────────────────────────────────────────────

def sample_random_params(rng: random.Random | None = None) -> np.ndarray:
    """Sample a random animation parameter vector within defined ranges."""
    r = rng or random
    return np.array(
        [r.uniform(lo, hi) for _, lo, hi, _ in PARAM_DEFS],
        dtype=np.float32,
    )


def normalize_params(params: np.ndarray) -> np.ndarray:
    """Normalize params to [0, 1] range using PARAM_MINS/PARAM_MAXS."""
    span = PARAM_MAXS - PARAM_MINS
    span[span == 0] = 1.0
    return (params - PARAM_MINS) / span


def denormalize_params(normed: np.ndarray) -> np.ndarray:
    """Denormalize from [0, 1] back to original ranges."""
    return normed * (PARAM_MAXS - PARAM_MINS) + PARAM_MINS


def params_to_dict(params: np.ndarray) -> dict[str, float]:
    """Convert a parameter vector to a named dict."""
    return {name: float(params[i]) for i, name in enumerate(PARAM_NAMES)}


# ── Card loading ─────────────────────────────────────────────────────

CARDS_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "cards.json"


def load_cards() -> list[dict]:
    """Load all card definitions from data/cards.json."""
    with open(CARDS_PATH) as f:
        return json.load(f)


# ── Smoke test ───────────────────────────────────────────────────────

if __name__ == "__main__":
    cards = load_cards()
    print(f"Loaded {len(cards)} cards")
    print(f"Card feature dim: {CARD_FEATURE_DIM}")
    print(f"Animation param dim: {ANIM_PARAM_DIM}")

    # Test feature extraction
    feats = extract_card_features(cards[0], "entrance")
    print(f"Sample features shape: {feats.shape}, sum: {feats.sum():.2f}")

    # Test param sampling
    params = sample_random_params()
    print(f"Sample params shape: {params.shape}")
    normed = normalize_params(params)
    print(f"Normalized range: [{normed.min():.3f}, {normed.max():.3f}]")
    recovered = denormalize_params(normed)
    assert np.allclose(params, recovered, atol=1e-5), "Round-trip failed!"
    print("Round-trip normalization: OK")
    print(f"\nSample param dict:\n{json.dumps(params_to_dict(params), indent=2)}")
