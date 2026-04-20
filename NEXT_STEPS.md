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

### 1. Balance patches — round 2+3 shipped, round 4 still pending

**Shipped 2026-04-19** (commit `f703390`, 10-card patch):
  - JIMMY stat nerfs: JIM030 cost 5→6, JIM032 atk 6→5, JIM022 lost
    CHARGE, JIM028 atk 5→4, JIM026 spellEffect damage 5→4
  - JIMMY battlecry damage cuts: JIM030 4→3, JIM032 3→2, JIM026 4→3
  - DEREK +1 stat buffs across 5 bottom-performers (DRK019/028/038/042/045)

Post-patch sim (80k games): JIMMY 70.4% → 68.8% (-1.6pp),
DEREK 7.8% → 8.1% (+0.3pp). Direction correct but MAGNITUDE insufficient.

**Round 4 — DEREK mechanics rework (still blocked on you).** Numbers
tuning maxed out. Real fix is Option D from the patch proposal: add a
`GAIN_ARMOR` spellEffect type to the game engine, seed 3-4 DEREK cards
with it, synergize with DRK's existing defensive-minion baseline. That
requires engine-level code in server/effects.ts, not just card-data
edits. Scope: half a day. Document the design before starting.

**Round 5 — remove a JIMMY carry from the random-deck pool.** Last
resort if round 4 still leaves JIMMY above 60%. Either remove one of
JIM030/JIM026 from the random deck builder entirely, or cap JIMMY's
random decks at 1 copy of the top 3 carries.

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

### 3. Animation model v3 — regenerate training data

**v2 shipped 2026-04-19** (commit `6d8ddc5`): added target_quality
feature (62-dim) + cubic score weighting. Infrastructure works, but val
loss only moved 0.0836 → 0.0832. The real bottleneck is the training
DATA, not the OBJECTIVE: ~2 samples per (card, context) bin means the
"best" sample per bin is the lucky winner of random-sampling noise, not
a systematic "good params" target.

**v3 plan:** regenerate `data/animation-training.jsonl` with ~10-20
samples per bin (at ~319 cards × 8 contexts that's 25-50k samples vs
today's 5k). After 10 samples per bin the top-quality one is an
informative target. Cost: 25-50 min of Gemma-4-e4b VLM labeling per
5000 samples.

Run: `python3 scripts/animation-model/generate.py --samples 40000`
Then: `python3 scripts/animation-model/train.py`
Expect: val loss should break below 0.07 once the signal-to-noise
improves. If not, the objective needs deeper work (rank learning on
paired samples).

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
