# Miro TCG — What's Next

Living doc for picking up where a prior session left off. Update this
whenever a multi-session workstream changes state.

Last session: 2026-04-19 (full-day arc, 10 commits).

## Current state

**Prod neural eval:** `data/neural-eval-weights.json` = **Run E** (Llama-70B
labels, weight 0.3, acc=0.6992 on 1M held-out). Undefeated against all
2026-04-19 experiments (E2-E6 Gemma-e4b sweep, Run F Gemma-31B).

**Balance (2026-04-19 audit):**
- DEREK 7.8% WR — CATASTROPHIC. 2026-04-13 DRK034 patch FAILED.
- JIMMY 70.3% WR — BROKEN DOMINANT. 2026-04-13 JIMMY nerfs FAILED.
- JIMMY vs DEREK = 99.5% (unwinnable mirror).
- Other 7 heroes: 49.5-54.9% (perfectly balanced among themselves).

**Animation model:** trained + shipped as `data/animation-weights.json`
(59.5K params). Val loss 0.083 (flat — predicts the mean). Works but
quality is not great; acceptable baseline.

## Immediate next actions (prioritized)

### 1. Balance patches (USER DECISION, design-level) — blocked on you

See `docs/balance-patch-proposal-2026-04-19.md`. Two scopes:

**A. JIMMY nerfs** — 5 recommended edits to cards.json. I tested
JIM030 hp 6→5 alone; it did NOTHING (the battlecry is the OP part, not
the stat line). Next attempt should hit MULTIPLE carries simultaneously:
- JIM030 Infernic: reduce battlecry damage 4→3 OR raise cost 5→6
- JIM026 Engulfed in Flames: reduce damage 5→4 OR raise cost 7→8
- JIM022 Brutus: remove Charge (the burst is the problem, not the body)
- JIM028 Flaming Sword of Pain: durability 2→1 (only one swing)

**B. DEREK — not tunable, needs mechanics rework.** Data shows every DRK*
class card has near-zero or NEGATIVE mean AI score. Top-volume offender
DRK038 "Scrap Scythe" played 2,782×/5M decisions at −4.01 mean.
Options from proposal: stat buffs (won't be enough), DRK038 rework,
add 3-5 new DEREK cards, introduce a GAIN_ARMOR spellEffect keyword.
Claude recommends **Option D (ARMOR keyword)** as the real fix.

Verify any patch with `npx tsx scripts/parallel-simulate.ts --workers 16
--games-per-worker 5000 --teacher-vs-teacher --output
data/balance-audit-YYYY-MM-DD.jsonl` + `python3 scripts/aggregate_balance.py`.

### 2. 26B-A4B labeler retry (optional, ~30h overnight)

Memory: `feedback_mlx_26b_a4b_concurrency.md` — 26B-A4B via mlx_lm.server
fails at concurrency > 1 (empty-content races). At concurrency=1 it would
take ~30h for 9,999 labels; too slow to ship in a session but fine as
background overnight.

Script already exists at `scripts/runF-26b-switch.sh`. Would need the
`--concurrency 1` flag passed through to `gemma_label_positions.py`.

Likely outcome: marginally better labels than e4b, maybe beats Run E
but user decided not worth the wait (see earlier session notes).

### 3. Animation model v2 (low priority)

Val loss is stuck at 0.083 because the objective is score-weighted MSE
on random-sampled params — model collapses to predicting the mean. Fixes
attempted (top-K filtering at min-score 60 + 70) gave marginal wins.
Real fix needs objective redesign: score-conditional generation or
rank-learning with paired samples. Not started.

### 4. Ship observability on the game

If the game is live anywhere, instrument per-card and per-hero winrate
telemetry server-side so we don't rely on offline sim for balance. The
simulator is a fine proxy but real-player data would catch humans
exploiting things the AI doesn't see.

## Data / artifacts reference

- `data/neural-eval-weights.runE*.json` (6 weight files from the 2026-04-19 sweep, local-only)
- `data/teacher-labels.e4b.bak.jsonl` — 9,764 Gemma-e4b labels (archived, local)
- `data/teacher-labels.31b.jsonl` — 1,351 Gemma-31B labels (Run F, local)
- `data/teacher-labels.llama-contaminated.bak.jsonl` — 8,452 original Llama-70B labels (archived, local)
- `data/teacher-queue.jsonl` — 9,999 disagreement positions, renamed from `llama-queue.jsonl`
- `scripts/gemma_label_positions.py` — labeler (was `llama_label_positions.py`)
- `scripts/aggregate_balance.py` — class + matchup + per-card winrate from sim JSONL
- `scripts/card_strength.py` — AI-score proxy from `teacher-decisions.jsonl`
- `docs/balance-audit-2026-04-19.md`, `docs/balance-patch-proposal-2026-04-19.md`

## Git state (as of 2026-04-19 session end)

- `main` synced with origin, no uncommitted changes.
- 10 commits this session; key ones:
  - `00c64a1` Rename llama → teacher/gemma
  - `70b9309` Balance audit 2026-04-19
  - `99a79c2` Per-card winrate in SimRecord
  - `1ebae28` Run F evaluated, not promoted
  - `ded0830` ai-weights snapshot

## If this doc is stale

Check `git log --since='2026-04-20' --oneline` — anything after the last
committed ai-weights snapshot may have evolved the state. The audit docs
in `docs/` are the most reliable snapshot; memory at
`~/.claude/projects/-Users-cooperarons/memory/project_spero_neural_eval.md`
tracks changes session-to-session.
