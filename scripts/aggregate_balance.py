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
    # Per-card: (hero, cardCode) → {"wins": int, "losses": int}
    card_stats = defaultdict(lambda: {"wins": 0, "losses": 0})
    n_games = 0
    n_skipped = 0
    n_card_games = 0

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
            if not winner_id:
                n_skipped += 1
                continue

            # Prefer inline winner_hero / loser_hero (added 2026-04-19). Fall
            # back to snapshot feature-decode for older SimRecord files.
            winner_hero = game.get("winner_hero")
            loser_hero = game.get("loser_hero")
            if not winner_hero or not loser_hero:
                snapshots = game.get("snapshots", [])
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

            # Per-card tallies (only when the new fields are present).
            winner_cards = game.get("winner_cards")
            loser_cards = game.get("loser_cards")
            if winner_cards is not None and loser_cards is not None:
                n_card_games += 1
                for cc in winner_cards:
                    card_stats[(winner_hero, cc)]["wins"] += 1
                for cc in loser_cards:
                    card_stats[(loser_hero, cc)]["losses"] += 1

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

    # ── Per-card WR (only when SimRecord includes winner_cards/loser_cards) ─
    if n_card_games > 0:
        print(f"\n=== Per-card winrate ({n_card_games:,} games w/ card manifest) ===\n")
        # Aggregate per hero → top carries + bottom drags
        by_hero = defaultdict(list)
        for (hero, cc), stats in card_stats.items():
            total = stats["wins"] + stats["losses"]
            if total < 100:
                continue
            wr = stats["wins"] / total
            by_hero[hero].append((wr, cc, stats["wins"], total))

        for hero in HERO_CLASSES + ["NEUTRAL"]:
            rows = by_hero.get(hero, [])
            if not rows:
                continue
            rows.sort(key=lambda r: -r[0])
            print(f"\n-- {hero} --")
            print(f"{'Card':<16} {'Wins':>6} {'Plays':>6} {'WR':>7}")
            # Top 5 + bottom 5 if enough
            show = rows[:5] + ([("---", "", 0, 0)] if len(rows) > 10 else []) + rows[-5:] \
                if len(rows) > 10 else rows
            for wr, cc, w, total in show:
                if cc == "":
                    print("...")
                    continue
                print(f"{cc:<16} {w:>6} {total:>6} {wr*100:>6.1f}%")


if __name__ == "__main__":
    path = Path(sys.argv[1] if len(sys.argv) > 1 else "data/balance-audit-2026-04-19.jsonl")
    analyze(path)
