import { describe, it, expect } from 'vitest';
import {
  calculateElo, kFactorFor, applyRankFloor,
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
