# Miro TCG — What's Next

Living doc for picking up where a prior session left off. Update this
whenever a multi-session workstream changes state.

Last session: **2026-04-22 evening** — landed v4 animation model,
card-lint engine audit (9 bugs plugged), weapon-equip stale-closure
fix, board spacing fix, hero-attack badge, mulligan weapon display,
full deploy pipeline cleaned.

Main: `main` at commit **a1d0b2d or later** (see `git log --oneline -5`).
Server: Cloud Run revision **spero-tcgo-server-00022-9mh** serving 100%.
Client: https://miro-tcgo.web.app (redeployed with latest UI fixes).

## Current state

**Prod neural eval:** `data/neural-eval-weights.json` = Run E (Llama-70B
labels, weight 0.3, acc=0.6992 on 1M held-out). Untouched this session.

**Balance — 200k authoritative audit 2026-04-22:**
- Spread 42.0% (ASTRID) – 62.4% (DEREK) = **20.4pp**
- Pre-shelf (500k, 2026-04-21): 33.5pp
- Tightened ~13pp over the session
- Worst matchups still hot but none exceed 70%: DEREK vs ANDERS 69%,
  IZZY vs ASTRID ~72% on smaller samples
- DES/ASTRID/ANDERS cluster at 42-43%, AVA/LUCAS 47-48%, DEREK/IZZY
  59-62% — the remaining spread is structural (card-pool shape, not
  single-card outliers)

**Animation model — v4 shipped (2026-04-22 commit `07d36f3`):**
- File: `data/animation-weights-v4.json`, 190→512→256→128→38, ~287K params
- Val rank-loss **0.0111** (vs v2's 0.012-0.019)
- Improvement from: wider MLP, residual skip (folded at export),
  blended rank+MSE loss, gradient clipping, AdamW weight_decay 1e-4
- Training in 3.2s on M5 MPS
- Server loads v4 → v2 → v1 → mse in priority

## Engine + data fixes landed this session

**Keyword shelf** (commit `e5e6b92`):
- BOND removed (16 pair cards stripped to vanilla)
- COLLAR removed (2 DES cards re-themed: Collar Drone → DR: 1 dmg
  random; Dominion Puppetmaster → BC: 4 dmg to all enemy minions)
- ORRA_CHARGE removed (was unused)
- UI tooltips/indicators removed; type union purged;
  `bondPartnerCode`/`bondEffect`/`isCollared`/`collarOwnerIndex`
  /`currentOrraCharge`/`transferredTurn` all deleted

**Wired previously-dormant keyword**:
- **LIFESTEAL** now fires on minion attack (combat.ts)
- Applied to 11 DES cards: Romulus, Ulan, Selena, Vrasp, Ezra,
  Kabistan, The Anarchist, Vyren, DES_COLLAR_03, Maso, Shazarda
- Tooltip + blood-drop badge on cards

**Effect engine bugs (via scripts/card-lint.py)**:
- DESTROY_MINION target=RANDOM_ENEMY branch (DES023/033/038)
- SILENCE_TARGET target=ALL_ENEMY_MINIONS (AVA029 Nullification Field)
- STEAL_MINION handler (DES024 Elixir of Domination)
- DESTROY_FROZEN_MINION handler (AND039 Shatter)
- AST_S02 Second Chance special-case in secrets.ts (re-summon
  `deadMinionCardCode` with 1 HP)
- DES040 Dominion Control Rod on-hero-attack AOE wired in combat.ts
- AND040 Anders Frost Prodigy compound battlecry (Freeze-all + 2-dmg)
- JIM032 Nova Ramiro text/value mismatch
- DES021 Crimson Cells missing DEAL_DAMAGE effect

**UI bugs fixed**:
- Weapon equip didn't let hero attack until browser refresh —
  `handleHeroPointerDown` useCallback had stale `gs.myWeapon` closure
- DEREK Reforge +1 atk wasn't visible — hero-attack amber badge added
  when `heroAttackThisTurn > 0` and no weapon
- Mulligan screen didn't show weapon attack/durability badges
- Hand card hover rendered TWO previews (fixed — in-hand card now
  scales 1.45× in place; unplayable cards still hover)
- COIN card art reverted to SVG (PNG was off-theme)
- LIFESTEAL blood-drop badge on cards with the keyword
- Card art `draggable={false}` so the browser drag-ghost no longer
  appears when you click and hold
- Hero portrait + card-back images also `draggable={false}`
- Board minion layout switched from `justify-center`+computed-gap to
  `justify-between` so minions span the full 72rem row at every count
- Weapon slot pinned to `opacity: 1` as defense against any
  mid-keyframe animation state

**Art regens** (via Gemma-3-27B VLM audit + SDXL regen):
- 65 name/art mismatches flagged initially
- Round 1-4: 65/65 fixed after iterated prompts. Highlights:
  Cardboard Pickaxe actually a pickaxe (was a dagger); Xiao
  frost-themed (was fire); Rosie a bottlenose dolphin; Bling a puffin;
  DEREK BEAST minions actual animals (were leftover mechs/humans).
- All 3 Despicable Me Minion lookalikes replaced with non-character art.
- `.old.png` backups preserved for every regen'd card.

## Tooling added

- `scripts/card-lint.py` — walks cards.json + checks every
  `(effect.type, effect.target)` combo against the engine's switch
  cases. Also verifies summonCardCode→real card, text/value
  consistency, and keyword-type sanity. Zero issues across 339 cards
  post-fix. Run via `npm run lint:cards`.
- `scripts/animation-model/train_rank_v4.py` — drop-in replacement
  for train_rank_v2.py with the wider/residual/blended-loss model.
- `scripts/regen-art-mismatches.py`, `regen-art-round2.py`,
  `regen-art-round3.py`, `regen-art-round4.py` — the iterated art
  regens, all with prompts checked in for future reference.

## Tests

**240/240 passing**, 18 test files. New files this session:
- `server/__tests__/effect-engine-fixes.test.ts` (8 tests)
- `server/__tests__/lifesteal-dominion.test.ts` (6 tests)
- `server/__tests__/integration-scenarios.test.ts` (11 tests)
- `server/__tests__/weapon-card-data.test.ts` (5 tests)

## Known issues remaining

- **DES/ASTRID/ANDERS at 42-43% WR** — ~8pp below the ideal 50%.
  Levers I haven't pulled: (a) buff their hero powers (user rule says
  no), (b) add more LIFESTEAL/sustain cards beyond the current set,
  (c) 2-3 more new class cards each. Next session candidate.
- **Weapon-equip stale closure** is *probably* fixed — dep array
  updated on `handleHeroPointerDown`, audited 16 other useCallbacks
  (all clean). User hasn't confirmed the live fix works yet.
- **`client/public/cards/*.old.png` backups** take ~300 MB. If the
  regens stick, these can be deleted in a cleanup pass. Excluded from
  `.gcloudignore` so they don't inflate server deploys.

## Immediate next actions (prioritized)

### 1. User playtest on `miro-tcgo.web.app`

Confirm the weapon-equip-attack fix actually resolves. Sanity-check
LIFESTEAL healing, silence-all, DES040 AOE on hero swing, DEREK
Reforge attack badge.

### 2. Balance: close the 42% gap for the bottom three classes

Options:
- Add 2-3 new class cards to DES/ASTRID/ANDERS that tilt toward their
  identity (silent backstab for ASTRID, shadow pressure for DES, frost
  combo for ANDERS)
- Buff existing class weapons / mid-cost drops
- Accept the 20pp spread and move on

### 3. 26B-A4B labeler retry for animation v5

Memory: `feedback_mlx_26b_a4b_concurrency.md` — 26B-A4B at concurrency=1
is a stronger teacher but ~30h for the full queue. Would give v5 a
cleaner label distribution and likely tighten val rank-loss below
0.010.

### 4. Human-preference animation labels

Replace the VLM judge with a tiny "pick between A and B" UI. Yields
ground-truth labels the VLM can't match, but requires building the
UI + labeling 2-3k pairs by hand.

## Data / artifacts reference

- `data/balance-audit-*.jsonl`, `data/balance-round*.jsonl`,
  `data/balance-200k.jsonl` — local-only (gitignored + gcloudignored)
- `docs/balance-patch-2026-04-22.md` — full card-by-card changelog
- `docs/audits/balance-200k-2026-04-22.txt` — authoritative WR table
- `data/animation-training.jsonl` — 13,500 samples, gitignored
- `data/animation-art-embeddings.json` — 240 ResNet18 card-art
  embeddings, kept in git (small)

## Git state

`git log --oneline -5` at session end:
- v4 animation model
- integration tests
- card-lint + engine fixes
- deploy pipeline `.gcloudignore` cleanup
- balance UI fixes
