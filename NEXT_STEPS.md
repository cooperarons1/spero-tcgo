# Miro TCG — What's Next

Living doc for picking up where a prior session left off. Update this
whenever a multi-session workstream changes state.

Last session: 2026-04-19 (15-round balance overhaul, 12+ commits, teacher
retrain, animation v3 data gen started).

## Current state

**Prod neural eval:** `data/neural-eval-weights.json` = **Run E** (Llama-70B
labels, weight 0.3, acc=0.6992 on 1M held-out). Undefeated against all
2026-04-19 experiments (E2-E6 Gemma-e4b sweep, Run F Gemma-31B).

**Balance — 15 rounds shipped 2026-04-19 (post-patch audit):**
- DEREK 44.6% (was 7.8% at session start, +36.8pp)
- JIMMY 47.0% (was 70.3%, -23.3pp) — IN the balanced band
- Spread 44.6%-54.1% (was 7.8%-70.3%)
- Worst mirror JIMMY vs DEREK 74.1% (was 99.5% — unwinnable before)
- Worst remaining: IZZY vs DEREK 74.5% (rush vs control; acceptable)

**What landed the fix (after stat-only nerfs plateaued in rounds 1-8):**
1. Round 10 — DEREK hero power "Tinker" rewritten from "draw 1" to
   "gain 2 armor + draw 1" (round 15 bumped to 3 armor). +8.9pp DEREK.
   Stat buffs couldn't close the gap; DEREK had no persistent tempo tool.
2. Round 9 — `classBonus` in buildRandomDeck (server/ai-simulate.ts)
   raised 1.5 → 3.0. Random decks now heavily favor class cards, so
   DEREK's 6 rounds of class buffs actually get represented. +2.8pp.
3. Round 11 — JIMMY hero power "Orra Arrow" 2→1 base damage (upgraded
   still 2+1 adjacent). -15.3pp JIMMY in one round. The 2-dmg-to-anything
   was the engine behind JIMMY's 66% WR floor.
4. Round 12-13 — DEREK starts with 10 armor (effective 40hp vs aggro).
5. Teacher AI retrain on current pool — fixed the JIMMY mirror.

**Animation model:** v2 shipped 2026-04-19 (val loss 0.083, still predicts
mean). Animation v3 data gen running (~2500/20000 samples as of session
end) — when done, train v3 and see if denser bins break the plateau.

## Immediate next actions (prioritized)

### 1. Balance — DONE this session (15 rounds, +36.8pp DEREK, −23.3pp JIMMY)

Commits: `019a4b6` (rounds 7-10), `c77cf77` (rounds 11-15), plus
`f703390`/`bfe2624`/`9a2e157`/`cbfd69d` from earlier in session.

Balance converged on:
- DEREK 44.6% (entry to band), JIMMY 47.0%, spread 44.6-54.1%
- No mirror >74.5%; worst remaining IZZY→DEREK 74.5% (aggro vs control)

**Only remaining balance task:** IZZY-vs-DEREK 74.5% if you want it
tighter, but cost would be nerfing IZZY which is otherwise fine.

### 1b. Final teacher retrain on post-round-15 pool (in progress)

`npx tsx server/ai-simulate.ts --learn --games 5000 --cycles 5
--teacher-vs-teacher` kicked off after the rounds 11-15 commit, so the
teacher is learning on the new card pool + new hero powers + 10-armor
DEREK. Takes ~70 min.

After it completes:
1. Run 80k-game audit one more time — teacher may further tighten balance
2. Commit ai-weights.json if audit looks clean

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
