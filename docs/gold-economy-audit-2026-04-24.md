# Gold Economy Audit — 2026-04-24

Snapshot of the live economy the day after Shop + Open Packs shipped
to the home screen. Covers earn rates, sinks, and a sanity check on
"can a casual player complete the collection."

## Gold sources

### Match win (server/state.ts:343)
- **10 gold per win**
- **+10 bonus every 3rd win**
- Effective rate: ~13g / win (at 50% WR, ~6.5g / game played)
- Losses pay 0.

### Daily quests (shared/questDefs.ts, 3 concurrent, 1 refresh/day)
- 50g quests: play-minions (10), deal-damage (30), cast-spells (10), destroy-minions (10)
- 60g quests: win-games (3), win-2-as-class
- 80g quests: play-minions (20), deal-damage (50), destroy-minions (15), win-3-as-class
- 100g quests: win-games (5)
- Average per completed quest: **~65-80g**

### Login streak (server/handlers/profile.ts:279)
| Day | Gold |
|-----|------|
| 1   | 10   |
| 2   | 15   |
| 3   | 20   |
| 4   | 25   |
| 5   | 30   |
| 6   | 40   |
| 7   | **100** (weekly bonus) |

- 7-day total: **240g**, avg ~34g/day.

### Battle Pass (shared/battlePass.ts, gated by FEATURE_FLAGS.BATTLEPASS)
- Free track: 20g most tiers, 50g every 5th
- Premium: 100g every 5th tier (+ cosmetics)
- Currently flag is shelved per memory (project_miro_tcg_state).

## Gold sinks

### Packs (server/packs.ts PACK_BUNDLE_COSTS)
| Count | Gold | Per-pack | Discount |
|-------|------|----------|----------|
| 1     | 100  | 100      | —        |
| 5     | 450  | 90       | 10%      |
| 10    | 800  | 80       | 20%      |

Each pack = 5 cards, guaranteed rare+, with pity timers at 10 packs
(epic) and 40 packs (legendary).

### Crafting (server/packs.ts CRAFT_COSTS + DUST_VALUES)
| Rarity    | Craft | Disenchant | Net loss |
|-----------|-------|------------|----------|
| COMMON    | 40    | 5          | -35      |
| RARE      | 100   | 20         | -80      |
| EPIC      | 400   | 100        | -300     |
| LEGENDARY | 1600  | 400        | -1200    |

Disenchant value always < craft cost (verified by test — no infinite
dust exploit). Dust only comes from duplicate-card auto-disenchant
when opening packs.

## Earn-rate scenarios

Assumptions: ~50% win rate, 1 quest refresh per day used.

### Casual player (3-5 games/day)
- Match gold: 3 wins × 13g = 39g
- Daily quests: 1 completed × 70g = 70g
- Login streak: 34g avg
- **Total: ~140-150g/day** → **1.4 packs/day**

### Active player (10+ games/day, all 3 quests done)
- Match gold: 10 wins × 13g = 130g
- Daily quests: 3 × 70g = 210g
- Login streak: 34g
- **Total: ~370g/day** → **~3.7 packs/day**

## Collection completion math

339 cards total. Assume target:
- COMMONs/RAREs/EPICs × 2 copies each
- LEGENDARYs × 1 copy

Rough pack breakdown:
- Each pack: ~3.5 commons + 1.2 rares + 0.25 epics + ~0.02 legendaries
- Pity legendary every 40 packs on average
- Dust fallback covers misses

Back-of-envelope: **~120-150 packs** for a complete collection.

| Playstyle | Packs/day | Days to complete |
|-----------|-----------|------------------|
| Casual    | 1.4       | ~85-105          |
| Active    | 3.7       | ~30-40           |

## Health check

- ✓ Casual players can buy ~1 pack/day without effort
- ✓ Active players can keep the dust pipeline fed for targeted crafts
- ✓ Disenchant < craft cost at every rarity (no exploit)
- ✓ Bundle discounts reward batched spending
- ✓ Weekly login bonus creates a 7-day retention hook

## Gaps / not yet shipped

- **First-win-of-day bonus** — HS-style retention sweetener not in
  current code. Would be `+25-50g on first match win each UTC day`.
- **Weekly gold cap** (no current cap; infinite grind possible)
- **Milestone pack rewards** (e.g. "open 10 packs" → +1 free pack)
- **Gold purchase (real money)** — Shop UI shows 4 tiers "Coming Soon"
  but no Stripe integration landed (per memory, monetization was
  removed in gold-only economy pivot).

## Recommendations (not shipping)

None critical. Economy is in a healthy casual-friendly spot. If
retention becomes an issue later, the first-win-of-day bonus is the
cheapest lever. If hardcore grinding becomes a problem, add a daily
cap (but unlikely with only ~4 packs/day ceiling).
