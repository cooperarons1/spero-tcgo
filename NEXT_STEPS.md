# Miro TCG — What's Next

Living doc for picking up where a prior session left off. Update this
whenever a multi-session workstream changes state.

Last session: 2026-04-22 — shelved BOND/COLLAR/ORRA_CHARGE keywords,
wired LIFESTEAL into combat, ran a 17-round balance-patch loop +
teacher retrain. See `docs/balance-patch-2026-04-22.md` for the full
card-by-card list.

## Current state

**Prod neural eval:** `data/neural-eval-weights.json` = **Run E** (Llama-70B
labels, weight 0.3, acc=0.6992 on 1M held-out). Undefeated against all
2026-04-19 experiments (E2-E6 Gemma-e4b sweep, Run F Gemma-31B).

**Balance — 30k audit 2026-04-22 (post-patch, post-retrain):**
- Spread 39.6% (DES) – 61.8% (DEREK) = 22.2pp wide
- Improvement vs pre-shelf 500k (34.8–68.3, 33.5pp): ~11pp tighter
- Worst mirrors still hot: IZZY vs ASTRID 72%, DEREK vs ASTRID 68%,
  DES vs IZZY 32%, DES vs JIMMY 31%
- Next frontier: class-vs-class gap for DES (39.6%), ANDERS/ASTRID (~41%)

**Big moves this session:**
1. Shelved BOND + COLLAR keywords (16 + 2 cards re-themed; engine
   handlers deleted; state fields removed; UI indicators gone).
2. Shelved ORRA_CHARGE keyword (unused on cards; full infra removal).
3. **Wired LIFESTEAL** into combat.ts (was dormant; now real). Applied
   to 8 DES threats — the critical sustain layer that lifted DES from
   23% to 39% WR over the session.
4. 17 stat/cost/effect patches across DEREK (nerfs) / IZZY (nerfs) /
   AVA (summon-count nerfs) / ASTRID (combo + Sprint cost buffs) /
   DES (self-damage reductions + asymmetric AOE + sustain).
5. Teacher retrain (6 cycles × 2000 games) after round 10 — stabilized
   weights against the new pool.

**Hero power note:** memory claimed DEREK hero power was "Tinker: gain
3 armor + draw 1" — that's stale. Current code is **Reforge: +1 atk +
1 armor** (Hearthstone Druid Shapeshift). Memory has been updated.

**Animation model:** v3 shipped 2026-04-22 (commit `ad31c95`) at MSE
val 0.0828 on 13.5k samples. The rank-loss trainer v2 (val 0.012-0.019)
is the production model; MSE weights are reference-only.

**Animation model:** v2 shipped 2026-04-19 (val loss 0.083, still predicts
mean). Animation v3 data gen running (~2500/20000 samples as of session
end) — when done, train v3 and see if denser bins break the plateau.

## Immediate next actions (prioritized)

### 1. Commit 2026-04-22 session (NOT DONE)

Everything from today is uncommitted at session end. `data/cards.json`
+ engine surgery across:
- `shared/types.ts` — dropped BOND/COLLAR/ORRA_CHARGE from Keyword
  union; removed bondPartnerCode/bondEffect from CardDef and related
  MinionState fields
- `server/combat.ts` — wired LIFESTEAL; removed COLLAR-on-attack +
  DES_COLLAR_02 deathrattle special
- `server/actions.ts` — removed BOND handler (two places) +
  DES_COLLAR_03 battlecry special (two places)
- `server/game.ts` — removed end-of-turn COLLAR transfer + Orra Charge
  tick-up
- `server/effects.ts` — removed Collar/OrraCharge state cleanup
- `server/ai-state-pool.ts`, `server/ai-teacher.ts`,
  `server/animation-model.ts`, `server/packs.ts` — stale refs removed
- `client/src/components/GameBoard.tsx`,
  `client/src/components/Collection.tsx` — UI tooltips + Collar
  indicator + Orra Charge counter removed, LIFESTEAL tooltip added
- `client/public/cards/IZZ021.{png,webp}` — Arcane Missiles art
  regenerated as a single unified bolt (was a 2x2 grid). Backup at
  `IZZ021.grid-backup.png`.

Tests 210/210 passing.

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
