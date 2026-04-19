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

Per-card winrate aggregation is not in `aggregate_balance.py` yet — the
bloom-fingerprint features don't invert to card identity. Would need to
extend `server/ai-simulate.ts` to log per-card played/won counts directly
in each `SimRecord`, or instrument the simulator to write per-card stats
to a sidecar file.

## Reproducing

```
npx tsx scripts/parallel-simulate.ts \
  --workers 16 --games-per-worker 5000 --teacher-vs-teacher \
  --output data/balance-audit-YYYY-MM-DD.jsonl
python3 scripts/aggregate_balance.py data/balance-audit-YYYY-MM-DD.jsonl
```
