# Achievement-Reward Audit — 2026-04-24

Full read of `shared/achievements.ts` (24 achievements) against the
fields actually tracked in the user Firestore doc + the reward-payout
path in `server/match-rewards.ts`.

## Coverage by condition type

| Condition type | Tiers | Source field | Was tracked? |
|----------------|-------|--------------|-------------|
| TOTAL_WINS     | 5 (1/10/50/100/500) | `gamesWon`          | ✓ |
| TOTAL_GAMES    | 3 (1/100/500)       | `gamesPlayed`       | ✓ |
| HERO_LEVEL     | 3 (10/30/60)        | `heroLevels[*].level` | ✓ |
| HERO_WINS      | 1 (500)             | `heroLevels[*].wins`  | ✓ |
| RANK           | 4 (Silver/Gold/Diamond/Legend) | `elo` | ✓ |
| PACKS_OPENED   | 2 (1/10)            | `packsOpened`       | ✓ |
| CARDS_CRAFTED  | 1 (1)               | `cardsCrafted`      | **✗ fixed 2026-04-24** (shop.ts now increments) |
| WIN_STREAK     | 3 (3/5/10)          | `bestWinStreak`     | **✗ fixed 2026-04-24** (match-rewards.ts now tracks) |
| LOGIN_STREAK   | 2 (7/30)            | `loginStreak`       | ✓ (profile.ts tracks) |

**Bugs found + fixed:**

1. **`WIN_STREAK`** family (On a Roll, Unstoppable, Invincible) — 3 achievements totalling 50g + 1 pack + 500g. `bestWinStreak` / `currentWinStreak` were never incremented anywhere. **Fixed** in `match-rewards.ts` — `currentWinStreak` resets on loss, bumps on win, `bestWinStreak = max(best, current)`. Achievement check re-runs on the post-update state so `streak-3` fires on the 3rd consecutive win.

2. **`CARDS_CRAFTED`** (Artisan) — 50 dust reward. `cardsCrafted` counter never incremented. **Fixed** in `shop.ts` craft-card handler — the atomic tx now bumps `cardsCrafted: (d.cardsCrafted ?? 0) + 1`.

## Reward balance

### Totals (if every achievement is unlocked)

| Reward type | Count | Sum                 |
|-------------|-------|---------------------|
| GOLD        | 14    | 4,550g              |
| PACK        | 7     | ~10 packs (≈ 900g)  |
| DUST        | 2     | 150 dust            |

Total lifetime achievement value: **~5,450g + 150 dust**, or roughly
**54 packs** worth. Spread across a player's entire career, this is
fair — about 2 packs' worth per achievement on average.

### Reward distribution skew

- Gold-heavy (14/24 = 58%)
- Pack rewards cluster on harder achievements (win 50, play 100,
  hero level 30, Gold rank, win streak 5, login 7)
- Dust rewards only on Collection achievements (open 10 packs, craft 1)

This is fine — gold is the universal currency and achievement gold
directly compresses time-to-pack.

### Reachability sanity

- **Hardest reachable:** `golden-hero` (500 wins on one hero) = 1000g reward. At ~40% WR on one hero, ~1250 games on that hero to unlock. ~400 hours of play. Deliberately aspirational.
- **Easiest:** `first-win` / `play-1` / `open-pack` — all hit in session 1. Good first-time-user rewards.
- **Now reachable:** `streak-3` (3 wins in a row), `streak-5` (5 wins in a row), `streak-10` (10 wins in a row), `craft-card` (craft 1 card). Previously unreachable.

## Gaps (not shipping, notes for future)

- **No "win with every class"** achievement. Would be a natural "play the full game" milestone.
- **No "craft a legendary"** tier. Current `craft-card` tier caps at 1 craft.
- **No per-class wins tiers** beyond the 500-win golden-hero unlock.
- **No "open 100 packs"** — `PACKS_OPENED` stops at 10. Natural extension.
- **No `goldEarnedTotal` / `dustEarnedTotal` based achievements.** These lifetime counters were added this session for observability; they could power "earned 10,000 gold lifetime" style milestones later.

Nothing critical. Current 24 achievements with the two fixes shipped
give a healthy progression curve from session 1 through lifetime
play.
