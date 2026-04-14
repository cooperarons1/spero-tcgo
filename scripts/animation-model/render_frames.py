"""
PIL-based animation frame renderer for the Miro TCG animation model.

Renders a 6-frame animation sequence given card info + animation parameters.
Each frame shows a card shape on a dark background at a different point in
the animation timeline (t = 0%, 20%, 40%, 60%, 80%, 100%).

The frames are intentionally simple (colored rectangles with stats text) —
the goal is for Gemma 4 to evaluate motion quality, timing, and visual
appeal from the sequence, not photorealistic card art.

Usage:
    python render_frames.py --preview          # render sample to PNG
    python render_frames.py --card-index 42    # render specific card
"""

from __future__ import annotations

import argparse
import math
import random
from pathlib import Path
from typing import Optional

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from schema import (
    ANIM_CONTEXTS,
    HERO_CLASSES,
    PARAM_NAMES,
    load_cards,
    params_to_dict,
    sample_random_params,
)

# ── Constants ────────────────────────────────────────────────────────

FRAME_W, FRAME_H = 360, 640
CARD_W, CARD_H = 100, 140
NUM_FRAMES = 6
T_VALUES = [0.0, 0.2, 0.4, 0.6, 0.8, 1.0]

# Hero class → primary color (RGB)
HERO_COLORS: dict[str, tuple[int, int, int]] = {
    "JIMMY":   (220, 60,  40),   # red/fire
    "TALA":    (50,  180, 80),   # green/nature
    "DEREK":   (80,  80,  180),  # blue/dark
    "ANDERS":  (200, 180, 50),   # gold/light
    "DES":     (150, 50,  180),  # purple/shadow
    "ASTRID":  (60,  180, 200),  # cyan/frost
    "AVA":     (220, 120, 50),   # orange/arcane
    "LUCAS":   (100, 140, 60),   # olive/beast
    "IZZY":    (200, 80,  150),  # pink/tech
    "NEUTRAL": (120, 120, 120),  # gray
}

RARITY_GEMS: dict[str, tuple[int, int, int]] = {
    "COMMON":    (180, 180, 180),
    "RARE":      (40,  120, 220),
    "EPIC":      (160, 50,  200),
    "LEGENDARY": (240, 180, 30),
}

BG_COLOR = (18, 18, 30)


# ── Easing functions ─────────────────────────────────────────────────

def ease_out_back(t: float, overshoot: float = 0.05) -> float:
    """Ease-out with optional overshoot."""
    c1 = 1.70158 * (1 + overshoot * 10)
    c3 = c1 + 1
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2


def ease_out_cubic(t: float) -> float:
    return 1 - (1 - t) ** 3


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


# ── Drawing helpers ──────────────────────────────────────────────────

def _try_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in [
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/SFNSMono.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]:
        try:
            return ImageFont.truetype(path, size)
        except (OSError, IOError):
            continue
    return ImageFont.load_default()


def draw_card(
    draw: ImageDraw.ImageDraw,
    cx: float, cy: float,
    scale: float,
    opacity: float,
    card: dict,
    params: dict[str, float],
    rotation: float = 0.0,
) -> Image.Image | None:
    """Draw a card shape centered at (cx, cy) with given scale and opacity."""
    if opacity <= 0.01 or scale <= 0.01:
        return None

    w = int(CARD_W * scale)
    h = int(CARD_H * scale)
    x0 = int(cx - w / 2)
    y0 = int(cy - h / 2)

    hero = card.get("heroClass", "NEUTRAL")
    rarity = card.get("rarity", "COMMON")
    color = HERO_COLORS.get(hero, HERO_COLORS["NEUTRAL"])
    gem_color = RARITY_GEMS.get(rarity, RARITY_GEMS["COMMON"])

    # Apply color shift from params
    h_shift = params.get("color_shift_h", 0)
    s_shift = params.get("color_shift_s", 0)
    l_shift = params.get("color_shift_l", 0)

    # Simple color adjustment (approximate)
    r = max(0, min(255, int(color[0] + h_shift + l_shift * 255)))
    g = max(0, min(255, int(color[1] - h_shift * 0.5 + l_shift * 255)))
    b = max(0, min(255, int(color[2] + s_shift * 100 + l_shift * 255)))

    alpha = max(0, min(255, int(opacity * 255)))

    # Card body (rounded rectangle)
    card_color = (r, g, b, alpha)
    draw.rounded_rectangle([x0, y0, x0 + w, y0 + h], radius=8, fill=card_color)

    # Glow effect based on buff params
    glow = params.get("buff_glow_intensity", 0)
    if glow > 0.1:
        gr = int(params.get("buff_glow_r", 0.3) * 255)
        gg = int(params.get("buff_glow_g", 0.9) * 255)
        gb = int(params.get("buff_glow_b", 0.3) * 255)
        glow_alpha = int(glow * alpha * 0.4)
        draw.rounded_rectangle(
            [x0 - 3, y0 - 3, x0 + w + 3, y0 + h + 3],
            radius=10,
            outline=(gr, gg, gb, glow_alpha),
            width=2,
        )

    # Mana cost gem (top-left)
    gem_r = max(8, int(12 * scale))
    gem_cx = x0 + gem_r + 4
    gem_cy = y0 + gem_r + 4
    draw.ellipse(
        [gem_cx - gem_r, gem_cy - gem_r, gem_cx + gem_r, gem_cy + gem_r],
        fill=(*gem_color, alpha),
    )

    # Stats text
    font = _try_font(max(10, int(14 * scale)))
    small_font = _try_font(max(8, int(10 * scale)))

    mana = str(card.get("manaCost", 0))
    draw.text((gem_cx, gem_cy), mana, fill=(255, 255, 255, alpha),
              font=small_font, anchor="mm")

    # Card name (center)
    name = card.get("name", "?")[:12]
    draw.text((cx, cy - 10 * scale), name, fill=(255, 255, 255, alpha),
              font=small_font, anchor="mm")

    # Attack / Health for minions
    if card.get("type") == "MINION":
        atk = str(card.get("attack", 0))
        hp = str(card.get("health", 0))
        draw.text((x0 + 8, y0 + h - 16 * scale), atk,
                  fill=(255, 220, 50, alpha), font=font, anchor="lm")
        draw.text((x0 + w - 8, y0 + h - 16 * scale), hp,
                  fill=(220, 50, 50, alpha), font=font, anchor="rm")

    return None


# ── Particle rendering ───────────────────────────────────────────────

def draw_particles(
    draw: ImageDraw.ImageDraw,
    cx: float, cy: float,
    t: float,
    params: dict[str, float],
    color: tuple[int, int, int] = (220, 60, 40),
):
    """Draw death/impact particles radiating from a center point."""
    count = int(params.get("death_particle_count", 8))
    spread = params.get("death_particle_spread", 60)
    speed = params.get("death_particle_speed", 100)

    if count <= 0 or t <= 0:
        return

    for i in range(count):
        angle = (2 * math.pi * i) / count
        dist = speed * t * (spread / 100)
        px = cx + math.cos(angle) * dist
        py = cy + math.sin(angle) * dist
        alpha = max(0, min(255, int(255 * (1 - t))))
        size = max(2, int(6 * (1 - t * 0.5)))
        draw.ellipse(
            [px - size, py - size, px + size, py + size],
            fill=(*color, alpha),
        )


# ── Spell projectile ────────────────────────────────────────────────

def draw_spell_projectile(
    draw: ImageDraw.ImageDraw,
    t: float,
    params: dict[str, float],
    from_pos: tuple[float, float] = (180, 500),
    to_pos: tuple[float, float] = (180, 200),
):
    """Draw a spell projectile along an arc from source to target."""
    arc = params.get("spell_proj_arc", 0)
    brightness = params.get("spell_impact_brightness", 1.5)

    # Projectile position along arc
    px = lerp(from_pos[0], to_pos[0], t) + arc * math.sin(math.pi * t)
    py = lerp(from_pos[1], to_pos[1], t) - 30 * math.sin(math.pi * t)

    # Projectile glow
    size = max(4, int(12 * (1 - t * 0.3)))
    bright = min(255, int(200 * brightness))
    draw.ellipse(
        [px - size, py - size, px + size, py + size],
        fill=(bright, bright, min(255, int(bright * 0.6)), 220),
    )

    # Trail
    for j in range(3):
        trail_t = max(0, t - 0.05 * (j + 1))
        tx = lerp(from_pos[0], to_pos[0], trail_t) + arc * math.sin(math.pi * trail_t)
        ty = lerp(from_pos[1], to_pos[1], trail_t) - 30 * math.sin(math.pi * trail_t)
        trail_alpha = max(0, 150 - j * 50)
        trail_size = max(2, size - j * 2)
        draw.ellipse(
            [tx - trail_size, ty - trail_size, tx + trail_size, ty + trail_size],
            fill=(bright, bright, min(255, int(bright * 0.4)), trail_alpha),
        )

    # Impact burst at end
    if t > 0.85:
        impact_t = (t - 0.85) / 0.15
        impact_scale = params.get("spell_impact_scale", 1.2)
        impact_size = int(20 * impact_scale * impact_t)
        impact_alpha = max(0, int(200 * (1 - impact_t)))
        draw.ellipse(
            [to_pos[0] - impact_size, to_pos[1] - impact_size,
             to_pos[0] + impact_size, to_pos[1] + impact_size],
            fill=(255, 255, 200, impact_alpha),
        )


# ── Damage flash overlay ────────────────────────────────────────────

def draw_damage_flash(
    draw: ImageDraw.ImageDraw,
    cx: float, cy: float,
    t: float,
    params: dict[str, float],
):
    """Draw a damage flash effect at the target position."""
    dur = params.get("dmg_flash_dur", 0.3)
    if t > 1.0:
        return

    r = int(params.get("dmg_flash_r", 1.0) * 255)
    g = int(params.get("dmg_flash_g", 0.1) * 255)
    b = int(params.get("dmg_flash_b", 0.1) * 255)

    # Flash intensity peaks at t=0.3 then fades
    peak_t = 0.3
    if t < peak_t:
        intensity = t / peak_t
    else:
        intensity = 1.0 - (t - peak_t) / (1.0 - peak_t)

    alpha = max(0, min(180, int(180 * intensity)))
    shake = params.get("dmg_shake_amp", 4) * math.sin(t * 20) * (1 - t)
    size = 35 + int(10 * intensity)

    draw.ellipse(
        [cx - size + shake, cy - size, cx + size + shake, cy + size],
        fill=(r, g, b, alpha),
    )


# ── Main frame rendering ────────────────────────────────────────────

def render_animation_frames(
    card: dict,
    params: dict[str, float],
    anim_context: str = "entrance",
) -> list[Image.Image]:
    """
    Render 6 frames of an animation sequence for a given card + params.
    Returns a list of 6 RGBA PIL Images (360x640 each).
    """
    frames: list[Image.Image] = []
    center_x, center_y = FRAME_W / 2, FRAME_H / 2

    for t in T_VALUES:
        img = Image.new("RGBA", (FRAME_W, FRAME_H), (*BG_COLOR, 255))
        draw = ImageDraw.Draw(img, "RGBA")

        # Draw frame number indicator
        small = _try_font(10)
        draw.text((10, 10), f"t={t:.0%}", fill=(80, 80, 100, 200), font=small)

        if anim_context == "entrance":
            # Card enters from below, scales up, with overshoot
            overshoot = params.get("entrance_overshoot", 0.05)
            progress = ease_out_back(t, overshoot)
            scale_from = params.get("entrance_scale_from", 0.3)
            scale_to = params.get("entrance_scale_to", 1.0)
            scale = lerp(scale_from, scale_to, progress)
            opacity_from = params.get("entrance_opacity_from", 0.0)
            opacity = lerp(opacity_from, 1.0, min(1.0, t * 2.5))
            translate_y = params.get("entrance_translate_y", 30)
            cy = center_y + translate_y * (1 - progress)
            draw_card(draw, center_x, cy, scale, opacity, card, params)

        elif anim_context == "attack":
            # Card lunges upward then recoils
            lunge = params.get("attack_lunge_dist", 40)
            lunge_dur = params.get("attack_lunge_dur", 0.3)
            if t < 0.5:
                # Lunge phase
                progress = ease_out_cubic(t / 0.5)
                cy = center_y - lunge * progress
            else:
                # Recoil phase
                progress = ease_out_cubic((t - 0.5) / 0.5)
                cy = center_y - lunge * (1 - progress)

            shake = params.get("attack_shake_intensity", 5)
            cx = center_x + shake * math.sin(t * 30) * (1 - t) if t > 0.4 else center_x
            draw_card(draw, cx, cy, 1.0, 1.0, card, params)

            # Impact flash at peak
            if 0.4 < t < 0.7:
                impact_t = (t - 0.4) / 0.3
                draw_damage_flash(draw, center_x, center_y - lunge, impact_t, params)

        elif anim_context == "death":
            # Card fades and shrinks, particles fly out
            scale_to = params.get("death_scale_to", 0.0)
            scale = lerp(1.0, scale_to, ease_out_cubic(t))
            opacity = max(0, 1.0 - t * 1.2)
            draw_card(draw, center_x, center_y, scale, opacity, card, params)

            # Particles
            if t > 0.2:
                particle_t = (t - 0.2) / 0.8
                hero = card.get("heroClass", "NEUTRAL")
                color = HERO_COLORS.get(hero, HERO_COLORS["NEUTRAL"])
                draw_particles(draw, center_x, center_y, particle_t, params, color)

        elif anim_context == "spell":
            # Spell projectile from bottom to center
            draw_card(draw, center_x, center_y - 100, 0.8, 0.6, card, params)
            draw_spell_projectile(draw, t, params)

        elif anim_context == "damage":
            # Card shakes with red flash
            shake = params.get("dmg_shake_amp", 4) * math.sin(t * 25) * (1 - t)
            draw_card(draw, center_x + shake, center_y, 1.0, 1.0, card, params)
            draw_damage_flash(draw, center_x, center_y, t, params)

        elif anim_context == "buff":
            # Card pulses larger with glow
            pulse_scale = params.get("buff_pulse_scale", 1.15)
            pulse_t = math.sin(t * math.pi)
            scale = lerp(1.0, pulse_scale, pulse_t)
            draw_card(draw, center_x, center_y, scale, 1.0, card, params)

        elif anim_context == "draw":
            # Card slides in from right
            slide_dist = params.get("draw_slide_dist", 120)
            progress = ease_out_cubic(t)
            cx = center_x + slide_dist * (1 - progress)
            opacity = min(1.0, t * 2)
            flip = params.get("draw_flip_dur", 0.3)
            # Simulate flip by horizontal squash
            flip_progress = min(1.0, t / max(0.1, flip))
            h_scale = abs(math.cos(math.pi * (1 - flip_progress) * 0.5))
            draw_card(draw, cx, center_y, max(0.1, h_scale), opacity, card, params)

        else:
            # Idle — just draw the card
            draw_card(draw, center_x, center_y, 1.0, 1.0, card, params)

        frames.append(img)

    return frames


def frames_to_montage(frames: list[Image.Image]) -> Image.Image:
    """Combine 6 frames into a 3x2 grid for Gemma 4 scoring."""
    cols, rows = 3, 2
    montage = Image.new("RGBA", (FRAME_W * cols, FRAME_H * rows), (*BG_COLOR, 255))
    for i, frame in enumerate(frames):
        col = i % cols
        row = i // cols
        montage.paste(frame, (col * FRAME_W, row * FRAME_H))
    return montage


# ── CLI ──────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Render animation frame sequences")
    parser.add_argument("--preview", action="store_true", help="Render sample and save to PNG")
    parser.add_argument("--card-index", type=int, default=5, help="Card index from cards.json")
    parser.add_argument("--context", default="entrance", choices=ANIM_CONTEXTS)
    parser.add_argument("--output-dir", default="data/animation-preview")
    parser.add_argument("--all-contexts", action="store_true", help="Render all animation contexts")
    args = parser.parse_args()

    cards = load_cards()
    card = cards[args.card_index]
    print(f"Card: {card['name']} ({card['heroClass']} {card['type']})")

    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    contexts = ANIM_CONTEXTS if args.all_contexts else [args.context]

    for ctx in contexts:
        params = params_to_dict(sample_random_params())
        frames = render_animation_frames(card, params, ctx)
        montage = frames_to_montage(frames)

        # Save montage
        path = out_dir / f"{card['cardCode']}_{ctx}_montage.png"
        montage.save(str(path))
        print(f"Saved {ctx} montage: {path} ({montage.size[0]}x{montage.size[1]})")

        if args.preview:
            # Also save individual frames
            for i, frame in enumerate(frames):
                fpath = out_dir / f"{card['cardCode']}_{ctx}_frame{i}.png"
                frame.save(str(fpath))

    print("Done!")


if __name__ == "__main__":
    main()
