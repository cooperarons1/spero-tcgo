import { describe, it, expect } from 'vitest';
import {
  calculateElo, kFactorFor, applyRankFloor, softResetElo,
  K_NORMAL, K_PLACEMENT, PLACEMENT_MATCHES,
} from '../matchmaking.js';

/**
 * Ranked matchmaking polish: placement-K scaling + rank floors.
 * These tests lock down the ladder invariants that protect players
 * from bad streaks and let new accounts settle fast.
 */

describe('kFactorFor (placement scaling)', () => {
  it('returns K_PLACEMENT for 0 games played', () => {
    expect(kFactorFor(0)).toBe(K_PLACEMENT);
  });
  it('returns K_PLACEMENT on the last placement game', () => {
    expect(kFactorFor(PLACEMENT_MATCHES - 1)).toBe(K_PLACEMENT);
  });
  it('returns K_NORMAL after placements are done', () => {
    expect(kFactorFor(PLACEMENT_MATCHES)).toBe(K_NORMAL);
    expect(kFactorFor(PLACEMENT_MATCHES + 100)).toBe(K_NORMAL);
  });
  it('K_PLACEMENT > K_NORMAL (placements are more volatile)', () => {
    expect(K_PLACEMENT).toBeGreaterThan(K_NORMAL);
  });
});

describe('calculateElo with K override', () => {
  it('defaults both sides to K_NORMAL when opts omitted', () => {
    const r = calculateElo(1500, 1500);
    // Equal ELO, K=32, winner gets 16, loser loses 16
    expect(r.newWinnerElo).toBe(1516);
    expect(r.newLoserElo).toBe(1484);
  });

  it('applies per-side K override for placement matches', () => {
    // Winner is provisional (K=48), loser is not (K=32)
    const r = calculateElo(1500, 1500, {
      winnerK: K_PLACEMENT,
      loserK: K_NORMAL,
    });
    // Equal expected, so winner gains 48 * 0.5 = 24, loser loses 16
    expect(r.newWinnerElo).toBe(1524);
    expect(r.newLoserElo).toBe(1484);
  });

  it('placement-vs-placement doubles volatility vs normal-vs-normal', () => {
    const normal = calculateElo(1500, 1500);
    const placement = calculateElo(1500, 1500, {
      winnerK: K_PLACEMENT, loserK: K_PLACEMENT,
    });
    const normalSwing = normal.newWinnerElo - 1500;
    const placementSwing = placement.newWinnerElo - 1500;
    expect(placementSwing).toBeGreaterThan(normalSwing);
    expect(placementSwing / normalSwing).toBeCloseTo(K_PLACEMENT / K_NORMAL, 1);
  });

  it('underdog win gains more than favorite win (both K_NORMAL)', () => {
    const underdog = calculateElo(1200, 1800); // underdog wins
    const favorite = calculateElo(1800, 1200); // favorite wins
    const underdogGain = underdog.newWinnerElo - 1200;
    const favoriteGain = favorite.newWinnerElo - 1800;
    expect(underdogGain).toBeGreaterThan(favoriteGain);
  });
});

describe('applyRankFloor', () => {
  it('BRONZE peak has floor 0 — no protection', () => {
    expect(applyRankFloor(500, 'BRONZE')).toBe(500);
    expect(applyRankFloor(0, 'BRONZE')).toBe(0);
  });

  it('SILVER peak clamps ELO at 1200', () => {
    expect(applyRankFloor(1100, 'SILVER')).toBe(1200);
    expect(applyRankFloor(1199, 'SILVER')).toBe(1200);
    expect(applyRankFloor(1201, 'SILVER')).toBe(1201);
  });

  it('GOLD peak clamps at 1500', () => {
    expect(applyRankFloor(1300, 'GOLD')).toBe(1500);
    expect(applyRankFloor(1499, 'GOLD')).toBe(1500);
  });

  it('DIAMOND peak clamps at 1800', () => {
    expect(applyRankFloor(1700, 'DIAMOND')).toBe(1800);
    expect(applyRankFloor(1800, 'DIAMOND')).toBe(1800);
  });

  it('LEGEND peak clamps at 2100', () => {
    expect(applyRankFloor(2000, 'LEGEND')).toBe(2100);
    expect(applyRankFloor(2100, 'LEGEND')).toBe(2100);
    expect(applyRankFloor(2500, 'LEGEND')).toBe(2500);
  });

  it('unknown tier defaults to floor 0', () => {
    expect(applyRankFloor(500, 'MYTHIC' as any)).toBe(500);
  });

  it('never increases ELO — floor only, no ceiling', () => {
    // A DIAMOND-peaked player at 2000 ELO (inside Diamond range) is
    // unchanged — the floor is 1800 and they're well above it.
    expect(applyRankFloor(2000, 'DIAMOND')).toBe(2000);
  });
});

describe('softResetElo (season boundary)', () => {
  it('compresses Legend (2500) down to 2000', () => {
    expect(softResetElo(2500)).toBe(2000);
  });

  it('compresses Legend floor (2100) down to 1800', () => {
    expect(softResetElo(2100)).toBe(1800);
  });

  it('compresses Diamond (1800) down to 1650', () => {
    expect(softResetElo(1800)).toBe(1650);
  });

  it('leaves 1500 unchanged (axis of reset)', () => {
    expect(softResetElo(1500)).toBe(1500);
  });

  it('bumps Bronze (1000) up to 1250', () => {
    expect(softResetElo(1000)).toBe(1250);
  });

  it('bumps very-low ELO (500) up to 1000', () => {
    expect(softResetElo(500)).toBe(1000);
  });

  it('is idempotent-ish: reset-then-reset lands below original', () => {
    // A player reset twice (hypothetical) shouldn't crash out —
    // the result just compresses further toward 1500.
    expect(softResetElo(softResetElo(2500))).toBe(1750);
  });

  it('new top-of-season Legend can re-reach Legend with reasonable games', () => {
    // Starting from 2000 (post-reset), climbing back to 2100 against
    // same-ELO opponents. Each win gives ~16 ELO at even, less as the
    // player climbs above the fixed 2000 opponent. Healthy pace = <12
    // wins to re-hit Legend.
    let elo = softResetElo(2500); // 2000
    let wins = 0;
    while (elo < 2100 && wins < 20) {
      elo = calculateElo(elo, 2000).newWinnerElo;
      wins++;
    }
    expect(elo).toBeGreaterThanOrEqual(2100);
    expect(wins).toBeLessThan(12);
  });
});

describe('end-to-end: placement win at Bronze gets boosted + floored', () => {
  it('new player (0 placements) winning vs equal ELO gains 24, not 16', () => {
    const r = calculateElo(1000, 1000, { winnerK: kFactorFor(0), loserK: kFactorFor(50) });
    // Winner K=48, loser K=32
    expect(r.newWinnerElo - 1000).toBe(24);
    expect(1000 - r.newLoserElo).toBe(16);
  });

  it('gold-peaked player losing at 1500 stays at 1500 floor', () => {
    const r = calculateElo(1800, 1500, { winnerK: K_NORMAL, loserK: K_NORMAL });
    // Favorite wins, loser drops ~8 to ~1492
    const floored = applyRankFloor(r.newLoserElo, 'GOLD');
    expect(floored).toBe(1500);
    expect(r.newLoserElo).toBeLessThan(1500); // was below before flooring
  });
});
