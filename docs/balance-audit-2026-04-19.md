# Spero TCG — Balance Audit (2026-04-19)

## Source

`data/balance-audit-2026-04-19.jsonl` — 80,000 teacher-vs-teacher self-play
games using current `data/neural-eval-weights.json` (Run E). 45.5 s wall,
1,759 games/sec across 16 workers.

Aggregated by `scripts/aggregate_balance.py`.

## Class win rates

| Hero | Wins | Losses | Games | Win Rate | Status |
|------|-----:|-------:|------:|---------:|--------|
| **DEREK**  | 1,399  | 16,529 | 17,928 | **7.8%**  | 🔴 CATASTROPHICALLY UNDERPERFORMING |
| TALA    | 8,686  |  8,878 | 17,564 | 49.5% | ✅ in band |
| DES     | 9,397  |  8,327 | 17,724 | 53.0% | ✅ in band |
| IZZY    | 9,525  |  8,383 | 17,908 | 53.2% | ✅ in band |
| ASTRID  | 9,449  |  8,248 | 17,697 | 53.4% | ✅ in band |
| LUCAS   | 9,597  |  8,242 | 17,839 | 53.8% | ✅ in band |
| AVA     | 9,633  |  8,043 | 17,676 | 54.5% | ✅ in band |
| ANDERS  | 9,789  |  8,054 | 17,843 | 54.9% | ✅ in band |
| **JIMMY**  | 12,525 |  5,296 | 17,821 | **70.3%** | 🔴 BROKEN DOMINANT |

## Comparison vs 2026-04-08 audit

| Hero | 2026-04-08 | 2026-04-19 | Delta |
|------|-----------:|-----------:|------:|
| DEREK | 20.1% | **7.8%** | **−12.3 pp** (got much worse) |
| JIMMY | 59.1% | **70.3%** | **+11.2 pp** (got much worse) |
| Others | 47-55% (7 heroes) | 49.5-54.9% (7 heroes) | ~stable |

**The 2026-04-13 balance patch** (DRK034 → buff+taunt, JIM030 cost→5,
JIM032 health→4, NEU106 self-damage downside) **FAILED**. Both outliers
worsened significantly — likely because:
- DEREK fixes (DRK034 alone) were not enough to compensate for existing weak cards
- JIMMY nerfs (JIM030 cost, JIM032 health, NEU106) did not touch the real
  carry cards for JIMMY — something else in the JIMMY toolbox is stronger
  than these patches addressed

## Worst matchups

Any matchup where one side wins ≥70% (min 50 games):

| Matchup | Win Rate |
|---|---|
| JIMMY vs DEREK | **99.5%** |
| IZZY vs DEREK | 99.4% |
| ANDERS vs DEREK | 98.2% |
| AVA vs DEREK | 97.9% |
| LUCAS vs DEREK | 96.8% |
| ASTRID vs DEREK | 96.7% |
| TALA vs DEREK | 96.7% |
| DES vs DEREK | 95.5% |
| JIMMY vs IZZY | 73.9% |
| JIMMY vs ANDERS | 73.2% |
| JIMMY vs DES | 70.5% |

Every DEREK matchup is a blowout. JIMMY beats the next tier (IZZY/ANDERS/DES)
by 20+ points. JIMMY vs DEREK is 99.5% — effectively unwinnable for DEREK.

## Matchup matrix (row WR% vs col, min 1 game)

```
            DER   TAL   JIM   AND   DES   AST   AVA   LUC   IZZ
DEREK        50     3     0     2     4     3     2     3     1
TALA         97    50    35    43    43    44    47    44    42
JIMMY       100    65    50    73    70    66    65    70    74
ANDERS       98    57    27    50    49    53    52    50    58
DES          96    57    30    51    50    52    44    50    48
ASTRID       97    56    34    47    48    50    53    47    50
AVA          98    53    35    48    56    47    50    53    51
LUCAS        97    56    30    50    50    53    47    50    49
IZZY         99    58    26    42    52    50    49    51    50
```

Note: the 50/50 diagonal is mirror matches. Non-DEREK/non-JIMMY pairs all
cluster 43-58 — the "balanced 7" are internally consistent.

## Recommended action

This is a **design crisis**, not a numbers-tuning problem. Two distinct issues:

1. **DEREK needs a fundamental rework**, not balance tweaks. Sub-10% WR
   suggests DEREK's core mechanic (heavy armor / defensive) doesn't fire
   fast enough in the current meta. Needs early-game threats OR faster
   armor stacking OR new keyword support.

2. **JIMMY needs to find the real carries.** The 2026-04-13 nerfs hit
   JIM030 and JIM032 but JIMMY got stronger — the carry power is in other
   JIMMY cards. Recommend per-card winrate analysis (play-count weighted)
   to find the top 5 over-performing JIMMY cards before another patch.

Per-card winrate aggregation is not in `aggregate_balance.py` — the
bloom-fingerprint features don't invert to card identity. Instead, a
proxy analysis in `scripts/card_strength.py` reads the 98 GB
`data/teacher-decisions.jsonl` and surfaces each card's mean AI score
across all plays (`play_count × mean_score` as carry proxy).

## Per-card strength (2026-04-19 decisions, 5M-line sample)

### JIMMY carries (mean AI score, min 100 plays)

| Card | Description | Mean Score |
|---|---|---:|
| JIM030 | Infernic (6/6 LEGENDARY, 5 mana) — already patched 2026-04-13 | **59.16** |
| JIM026 | Engulfed in Flames (7-cost spell, EPIC) | 59.11 |
| NEU102 | — | 56.01 |
| NEU103 | — | 54.10 |
| JIM032 | Nova Ramiro (6/4 LEGENDARY, 7 mana) — already patched 2026-04-13 | 50.65 |
| JIM028 | Flaming Sword of Pain (5/2 weapon, 5 mana) | 47.85 |
| JIM022 | Brutus (6/5 EPIC, 6 mana) | 46.68 |

The 2026-04-13 nerfs touched JIM030 cost and JIM032 health but those
cards remain **top-3 JIMMY carries**. The next patch needs to hit the
stat lines (attack/health) and/or the under-nerfed JIM026/JIM028/JIM022.

### DEREK has no carries

Every DEREK class card has near-zero or **negative** mean AI score:

| Card | Plays | Mean Score |
|---|---:|---:|
| NEU103 (neutral) | 185 | 24.22 |
| NEU102 (neutral) | 298 | 15.48 |
| DRK041 | 635 | 3.71 |
| DRK028 | 807 | 0.54 |
| DRK019 | 1,561 | −1.54 |
| DRK042 | 1,034 | −3.31 |
| **DRK038** | **2,782** | **−4.01** (highest-volume net-negative) |
| DRK045 | 1,998 | −6.59 |

DEREK's kit doesn't build a winning board — the AI plays DRK038 2,782
times per sample knowing each play reduces win-prob. This is curve-forced
(nothing better in hand), confirming DEREK's mana curve is broken.

Top priority: rework DRK038 and buff the other DRK* cards so at least
some have positive contribution. Alternatively add 3-5 new strong DEREK
class cards.

## Reproducing

```
npx tsx scripts/parallel-simulate.ts \
  --workers 16 --games-per-worker 5000 --teacher-vs-teacher \
  --output data/balance-audit-YYYY-MM-DD.jsonl
python3 scripts/aggregate_balance.py data/balance-audit-YYYY-MM-DD.jsonl
```
