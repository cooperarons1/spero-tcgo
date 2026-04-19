#!/usr/bin/env python3
"""Aggregate per-class winrates + matchup matrix from a teacher-vs-teacher
simulation JSONL produced by parallel-simulate.ts.

Hero class is decoded from the features vector at offsets [31..39] (perspective)
and [95..103] (opponent) — must match server/ai-neural.ts HERO_CLASSES.

Usage:
    python scripts/aggregate_balance.py data/balance-audit-2026-04-19.jsonl
"""
import json
import sys
from collections import defaultdict
from pathlib import Path

HERO_CLASSES = ['DEREK', 'TALA', 'JIMMY', 'ANDERS', 'DES', 'ASTRID', 'AVA', 'LUCAS', 'IZZY']
PERSP_HERO_START = 31  # features[31..39] = active-player hero one-hot
PERSP_HERO_END = 40
OPP_HERO_START = 95  # features[95..103] = opponent hero one-hot
OPP_HERO_END = 104


def hero_of(one_hot: list) -> str | None:
    """Map a 9-dim one-hot slice back to its class name (or None if no bit set)."""
    for i, v in enumerate(one_hot):
        if v > 0.5:
            return HERO_CLASSES[i]
    return None


def analyze(path: Path) -> None:
    class_wins = defaultdict(int)
    class_losses = defaultdict(int)
    matchup_wins = defaultdict(int)  # (winner_hero, loser_hero) → count
    n_games = 0
    n_skipped = 0

    with path.open("r") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                game = json.loads(line)
            except json.JSONDecodeError:
                n_skipped += 1
                continue

            winner_id = game.get("winner_id")
            snapshots = game.get("snapshots", [])
            if not winner_id or not snapshots:
                n_skipped += 1
                continue

            # Find a snapshot where winner is active → features[31..39] = winner's hero,
            # features[95..103] = loser's hero.
            winner_hero = None
            loser_hero = None
            for s in snapshots:
                if s.get("active_player_id") == winner_id:
                    feats = s.get("features", [])
                    if len(feats) >= OPP_HERO_END:
                        winner_hero = hero_of(feats[PERSP_HERO_START:PERSP_HERO_END])
                        loser_hero = hero_of(feats[OPP_HERO_START:OPP_HERO_END])
                        break

            if not winner_hero or not loser_hero:
                n_skipped += 1
                continue

            class_wins[winner_hero] += 1
            class_losses[loser_hero] += 1
            matchup_wins[(winner_hero, loser_hero)] += 1
            n_games += 1

    # ── Class winrates ────────────────────────────────────────────────
    print(f"\n=== Balance audit: {n_games:,} games ({n_skipped:,} skipped) ===\n")
    print(f"{'Hero':<10} {'Wins':>7} {'Losses':>7} {'Games':>7} {'WR':>8}")
    rows = []
    for hc in HERO_CLASSES:
        w = class_wins[hc]
        l = class_losses[hc]
        total = w + l
        wr = w / total if total else 0.0
        rows.append((hc, w, l, total, wr))
    for hc, w, l, total, wr in sorted(rows, key=lambda r: r[4]):
        print(f"{hc:<10} {w:>7} {l:>7} {total:>7} {wr*100:>7.1f}%")

    # ── Matchup matrix ────────────────────────────────────────────────
    print(f"\n=== Matchup matrix — row wins vs col (row WR%) ===\n")
    header = "          " + " ".join(f"{c[:3]:>5}" for c in HERO_CLASSES)
    print(header)
    for row in HERO_CLASSES:
        cells = []
        for col in HERO_CLASSES:
            rw = matchup_wins[(row, col)]
            cw = matchup_wins[(col, row)]
            total = rw + cw
            if total == 0:
                cells.append("   -")
            else:
                pct = rw / total * 100
                cells.append(f"{pct:4.0f}")
        print(f"{row:<10}" + " ".join(f"{c:>5}" for c in cells))

    # ── Worst matchups ────────────────────────────────────────────────
    print(f"\n=== Worst matchups (WR >=70% or <=30%, min 50 games) ===\n")
    rare = []
    for (winner, loser), w in matchup_wins.items():
        other = matchup_wins.get((loser, winner), 0)
        total = w + other
        if total < 50:
            continue
        wr = w / total
        if wr >= 0.70 or wr <= 0.30:
            rare.append((wr, winner, loser, w, total))
    for wr, winner, loser, w, total in sorted(rare, key=lambda r: -r[0]):
        print(f"  {winner:<10} vs {loser:<10}: {w:>4}/{total:<5} ({wr*100:.1f}%)")


if __name__ == "__main__":
    path = Path(sys.argv[1] if len(sys.argv) > 1 else "data/balance-audit-2026-04-19.jsonl")
    analyze(path)
