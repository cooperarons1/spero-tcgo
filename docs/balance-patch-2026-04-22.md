# Balance Patch — 2026-04-22

Session-level log of the BOND/COLLAR/ORRA_CHARGE keyword shelf + a
17-round balance iteration loop against the 10k-game teacher-vs-teacher
sim, with one teacher retrain cycle mid-session.

## Context

500k-game audit from 2026-04-21 showed balance had regressed since
2026-04-19's 15-round overhaul. Hero-WR spread 34.8% (DES) – 68.3% (DEREK);
DEREK vs DES 78.2%. Rerun post-shelf (see below) widened to 22.9% – 71.9%.

## Keyword shelf

Three keywords fully removed from the live card pool, infrastructure
either kept dormant (animation model vocab) or deleted:

- **BOND** — partner-pair buff mechanic. 16 pair cards (2 per non-DES
  hero) stripped to vanilla; `bondPartnerCode` / `bondEffect` fields and
  the engine handler in `server/actions.ts` removed.
- **COLLAR** — DES class mechanic (mind-control on hit, end-of-turn
  transfer). 2 DES cards re-themed: DES_COLLAR_02 → "Deathrattle: Deal 1
  damage to a random enemy"; DES_COLLAR_03 → "Battlecry: Deal 4 damage
  to all enemy minions". Removed `isCollared` / `collarOwnerIndex` /
  `transferredTurn` state, the attack-collar branch in combat.ts, the
  end-of-turn transfer in game.ts, and the UI chain indicator.
- **ORRA_CHARGE** — ticking time-bomb minions. No cards actually used
  it; removed fields (`orraChargeMax`, `orraChargeEffect`,
  `currentOrraCharge`), the `startTurn` tick, and UI counter.

`BOND` and `COLLAR` retained as always-0 vocab slots in
`server/animation-model.ts` so the trained animation weights file still
loads at the correct feature dimension.

## New keyword wired

- **LIFESTEAL** — keyword was declared in `shared/types.ts` with no
  runtime implementation. Wired into `server/combat.ts`: when a minion
  with LIFESTEAL deals attack damage (hero or minion), the attacker's
  controller heals for that amount (capped at maxHealth). Tooltips added
  to GameBoard and Collection.

  Applied to 6 DES threats: Romulus, Ulan, Selena, Vrasp, Ezra,
  Kabistan, The Anarchist, Vyren, DES_COLLAR_03.

## Balance patches

17 rounds of iterative 10k-game audits. Key per-class changes:

### DEREK (nerfs)

- DRK032 Prema: 5/7 @ 6 → 4/6 @ 9; deathrattle summons 1x 3/3 instead of 2x
- DRK028 Sir Helio: 6/7 @ 5 Taunt+Divine Shield → 3/4 @ 7 Taunt (DS removed)
- DRK019 Bjorn: 6/7 @ 5 Taunt → 4/6 @ 7 Taunt
- DRK041 Talbot L: 6/7 @ 6 → 5/6; armor gain 3→1; DR token downgraded to 2/1 vanilla (was 5/5 taunt in text, NEU_TOKEN_01 in effect — text/effect mismatch fixed)
- DRK042 Talbot M: 5/7 Taunt cost 5 → 6
- DRK060 The Architect: armor gain 5 → 2
- DRK027 Klein: 3/5 → 3/4; BC buff +1/+1 → +0/+1
- DRK024 GPU: 3/4 → 2/4
- DRK037 Resourcefulness: "Draw a card. Gain 2 armor." → "Draw a card."
- DRK047 Zims: 3/4 → 2/3
- DRK052 Nature's Wrath: armor gain 2 → 1
- DRK070 Rebuild: cost 4 → 5
- DRK071 Ironwood Guardian: 4/5 Taunt cost 4 → 5
- NEU099 Voulder: 7/7 Taunt → 6/6
- NEU097 Tybiel: 5/6 @ 6 Taunt+DR-2x-2/2 → 4/5 @ 6

DEREK ramp preserved (Innervate, Wild Growth, Rebuild-at-5).

### IZZY (nerfs)

- IZZ043 Arcane Leviathan: 5/7 @ 7 Taunt+BC-3-AOE → 3/5 @ 8 Taunt+BC-2-AOE
- IZZ040 Bling's Grand Discovery: 4 dmg → 3 dmg; cost 6 → 7
- IZZ042 Flamestrike: 4 dmg → 3 dmg; cost 7 → 8
- IZZ036 Senga: 4/3 @ 4 Windfury+BC-2 → 3/3 @ 4 BC-only (Windfury removed)
- IZZ025 Cynthie: 2/4 → 2/3
- IZZ024 Coastal Typhoon: cost 5 → 6
- IZZ022 Blizzard: cost 4 → 5
- IZZ027 Brittana: cost 3 → 4
- IZZ031 Little Dipper: cost 1 → 2

### DES (buffs)

- 6 class LIFESTEAL additions (see above)
- DES025 Ezra: BC self-damage 3 → 1
- DES028 Maso: 3/3 @ 2 stripped of self-damage battlecry (was 2 self-damage)
- DES021 Crimson Cells: self-damage 3 → 1
- DES023 Destroy Your Surroundings: self-damage 3 → 1
- DES027 Lateo: deathrattle hero damage 2 → 4
- DES030 Selena: deathrattle hero damage 2 → 4 (+ LIFESTEAL)
- DES026 Kabistan deathrattle: all characters → enemies only (+ LIFESTEAL)
- DES041 Crucible Scythe DR: all characters → enemies only
- DES022 Death's Descent: "4 to all minions" → "4 to enemy minions + restore 3 HP"
- DES034 Twilight's Judgment: "3 to all minions" → "3 to enemy minions + restore 2 HP"
- DES037 Vrasp: 4/3 Stealth → 4/4 Stealth + LIFESTEAL
- DES_LOC04 Obexian Slums: damage 1 → 2

### Other

- ASTRID: Sprint cost 7 → 5; Call to Arms 6 → 5; Elle 3/2 → 3/3; Roderick 5/3 → 5/4; Alexis combo +1/+1 → +2/+2; Cold Blood +2/+4 → +3/+5; Trinity combo +2/+2 → +3/+3
- ASTRID AST041 Shadowblade Sensei: BC +2/+0 → +2/+1
- AVA (nerfs, creeping up): Breakthrough Innovation summon 3x → 2x; Mega Mech summon 2x → 1x
- ANDERS: Hot Springs heal 2 → 3
- NEU066 Chomp: 5/4 → 4/4

### Teacher retrain

6 cycles × 2000 games teacher-vs-teacher with `--learn`, stabilizing
weights to the new pool. Mid-cycle DES briefly reached 57%, but the
converged equilibrium settled back to the ~30-60% band — the card pool,
not the teacher, is the remaining lever.

## Final result (30k-game audit)

`docs/audits/balance-30k-final-2026-04-22.txt`

| Hero   | WR %  | Δ vs pre-shelf 500k (34.8% DES – 68.3% DEREK) |
|--------|-------|-----------------------------------------------|
| DEREK  | 61.8% | -6.5pp |
| IZZY   | 59.9% | +0.6pp |
| AVA    | 54.4% | +0.2pp |
| TALA   | 52.4% | +0.9pp |
| JIMMY  | 50.5% | -0.2pp |
| LUCAS  | 49.0% | +1.2pp |
| ANDERS | 41.1% | -2.6pp |
| ASTRID | 41.1% | +1.5pp |
| DES    | 39.6% | +4.8pp |

**Spread: 39.6 – 61.8 = 22.2pp** (pre-shelf 33.5pp, post-shelf-pre-patch 49pp).
Net ~11pp tighter than pre-shelf baseline.

Worst matchup still in extreme: IZZY vs ASTRID 72%, and the DES matchups
against DEREK (67%) / IZZY (68%) / JIMMY (69%) remain above the 70%
threshold individually-ish. The class-vs-class gap is the next
frontier.

## Commits

Uncommitted at session end (waiting on user approval). `data/cards.json`
+ engine surgery across `shared/types.ts`, `server/actions.ts`,
`server/combat.ts`, `server/game.ts`, `server/effects.ts`,
`server/ai-state-pool.ts`, `server/ai-teacher.ts`,
`server/animation-model.ts`, `client/src/components/GameBoard.tsx`,
`client/src/components/Collection.tsx`. Tests (210/210) passing.

## Text/effect mismatch audit (bonus)

Ran a scan for cards whose `text` promises stats/damage/summons that don't
match the underlying `effect` data. Found 14 issues; fixed 9:

- **Caused by this session**: DES023 ("Deal 1 damage to your hero" — effect
  still said 3); DRK032 Prema ("Summon a 3/3 mech" — summoned NEU_TOKEN_01
  which is 2/1 Scrap Golem). Fixed both.
- **Pre-existing**: JIM032 Nova Ramiro ("Deal 2" text, effect 1),
  DES021 Crimson Cells (text promised 1 self-damage + draw, effect only
  had draw), AND040 Anders Frost Prodigy (compound battlecry "Freeze all +
  deal 2 to Frozen" — second half missing), plus 4 summon-stats mismatches
  (Talbot S 1/1, Trax 2/2, Romulus 3/3, AVA cards 1/1 "Gadget Drone")
  that all used NEU_TOKEN_01 (2/1 Scrap Golem) regardless of text.
- **Added 3 new vanilla mech tokens**: NEU_TOKEN_MECH_11 / _22 / _33
  (Spare Mech Mk.I/II/III) so summon effects can match the advertised
  stats.
- **AVA Gadget Drone references** repointed to the existing AVA_TOKEN_01
  ("Gadget Drone" 1/1 mech).
- **4 false positives** (audit script didn't check `secretEffect` field;
  JIM_S01, JIM_S03, DES_S01, DES_S02 secrets are correctly wired).
- **Still broken**: DES040 "Dominion Control Rod" weapon — text "After
  your hero attacks, deal 1 damage to all enemy minions" is a triggered
  effect not modeled by the current engine's on-attack hooks. Flagged
  as a known issue; requires custom wiring in combat.ts.

### Balance side-effect of the mismatch fixes

5k-game sanity sim after the token/effect fixes:

- DES 41.1% (was 39.6%) — Romulus's DR token upgraded 2/1 → 3/3
- AVA 48.2% (was 54.4%, −6.2pp) — "Gadget Drone" summons were
  silently 2/1 Scrap Golems (via NEU_TOKEN_01); now honest 1/1. AVA
  had been quietly overperforming on this.
- DEREK 61.7% / IZZY 61.5% — unchanged
- Spread: 41.1 – 61.7 = **20.6pp** (best of session)

Even tighter than the 30k post-patch 22.2pp spread. Sample is smaller so
take with a grain of salt, but the direction is clearly benign: the
mismatch fixes paid out by removing a hidden AVA tempo advantage.

## Not done

- DEREK at 62% is still top; further nerfs have diminishing returns
  because the broader mech-taunt-armor synergy is structural, not a
  single-card issue.
- DES at 39% has risen but still bottom; its "Life Tap" hero power
  (draw 1, -2 HP) is a permanent tempo drag that stat-level patches
  can't fully offset without touching hero powers (memory rule).
- Mirror-level fixes for DEREK-vs-DES (~76%) would likely need one of:
  bigger DES class overhaul, DEREK ramp removal, or hero power
  revisions (off-limits).
