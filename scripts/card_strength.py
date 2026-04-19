#!/usr/bin/env python3
"""Per-card strength proxy from teacher-decisions.jsonl.

The decisions file logs every AI move in self-play. Play decisions include
the active hero, cardCode, turn, and the AI's internal score for the play.

We can't link decisions back to game outcomes directly (no game_id), so we
use the AI's own score as a proxy for card strength:

    strength = play_count × mean_score

High-strength cards are the ones the AI plays often AND rates highly. These
are the suspected "carries" for their class.

Usage:
    python scripts/card_strength.py data/teacher-decisions.jsonl [--hero JIMMY] [--max-lines 10000000]
"""
import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("path", type=Path)
    ap.add_argument("--hero", help="Filter to plays by this hero only")
    ap.add_argument("--max-lines", type=int, default=10_000_000)
    ap.add_argument("--top", type=int, default=30)
    args = ap.parse_args()

    # (hero, cardCode) -> [sum_score, count]
    stats = defaultdict(lambda: [0.0, 0])
    lines_read = 0
    plays = 0

    with args.path.open("r") as f:
        for line in f:
            lines_read += 1
            if lines_read >= args.max_lines:
                break
            try:
                d = json.loads(line)
            except json.JSONDecodeError:
                continue
            if d.get("type") != "play":
                continue
            hero = d.get("hero")
            card = d.get("card")
            score = d.get("score")
            if not hero or not card or not isinstance(score, (int, float)):
                continue
            if args.hero and hero != args.hero:
                continue
            stats[(hero, card)][0] += score
            stats[(hero, card)][1] += 1
            plays += 1

    if plays == 0:
        print("No plays found.", file=sys.stderr)
        return 1

    print(f"Analyzed {lines_read:,} lines, {plays:,} play events")
    if args.hero:
        print(f"Filtered to hero: {args.hero}")

    rows = []
    for (hero, card), (ss, n) in stats.items():
        mean_score = ss / n
        strength = n * mean_score  # play_count × mean_score
        rows.append((strength, hero, card, n, mean_score))

    # Top carries
    print(f"\n=== Top {args.top} cards by strength (play_count × mean_AI_score) ===")
    print(f"{'Hero':<10} {'Card':<14} {'Plays':>8} {'Mean Score':>12} {'Strength':>12}")
    for strength, hero, card, n, ms in sorted(rows, key=lambda r: -r[0])[: args.top]:
        print(f"{hero:<10} {card:<14} {n:>8,} {ms:>12.2f} {strength:>12,.0f}")

    # Highest mean score (most prized)
    print(f"\n=== Top {args.top} cards by mean AI score (min 100 plays) ===")
    filtered = [r for r in rows if r[3] >= 100]
    print(f"{'Hero':<10} {'Card':<14} {'Plays':>8} {'Mean Score':>12}")
    for strength, hero, card, n, ms in sorted(filtered, key=lambda r: -r[4])[: args.top]:
        print(f"{hero:<10} {card:<14} {n:>8,} {ms:>12.2f}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
