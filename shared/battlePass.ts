/**
 * Battle Pass — Miro TCG
 *
 * 50 tiers per season, XP-based progression.
 * Free track: every tier has a reward
 * Premium track: bonus rewards on every tier (requires purchase)
 *
 * XP per tier: 100 base, scales slightly
 * Earn XP from: games (same as hero XP), quests, daily login
 */

export interface BattlePassTier {
  tier: number;
  xpRequired: number; // cumulative XP to reach this tier
  freeReward: BattlePassReward;
  premiumReward: BattlePassReward;
}

export interface BattlePassReward {
  type: 'GOLD' | 'DUST' | 'PACK' | 'CARD_BACK' | 'HERO_SKIN' | 'NONE';
  amount?: number;
  itemId?: string; // for card backs / skins
  label: string;
}

export interface PlayerBattlePass {
  seasonId: string;
  xp: number;
  tier: number;
  isPremium: boolean;
  claimedFree: number[]; // tier numbers claimed
  claimedPremium: number[]; // tier numbers claimed
}

export const CURRENT_SEASON = 'season-1';
export const SEASON_NAME = 'Season 1: Aster Academy';
export const MAX_TIER = 50;

// XP required per tier (100 per tier, flat)
export function getXPForTier(tier: number): number {
  return tier * 100;
}

export function getTierFromXP(xp: number): number {
  return Math.min(Math.floor(xp / 100), MAX_TIER);
}

export function getTierProgress(xp: number): number {
  const tier = getTierFromXP(xp);
  if (tier >= MAX_TIER) return 1;
  const currentTierXP = tier * 100;
  return (xp - currentTierXP) / 100;
}

// Generate all 50 tiers with rewards
export function generateBattlePassTiers(): BattlePassTier[] {
  const tiers: BattlePassTier[] = [];

  for (let i = 1; i <= MAX_TIER; i++) {
    let freeReward: BattlePassReward;
    let premiumReward: BattlePassReward;

    // Free track rewards pattern
    if (i % 10 === 0) {
      // Every 10th tier: pack
      freeReward = { type: 'PACK', amount: 1, label: 'Miro Pack' };
    } else if (i % 5 === 0) {
      // Every 5th tier: 50 gold
      freeReward = { type: 'GOLD', amount: 50, label: '50 Gold' };
    } else if (i % 3 === 0) {
      // Every 3rd tier: 20 dust
      freeReward = { type: 'DUST', amount: 20, label: '20 Dust' };
    } else {
      // Other tiers: 20 gold
      freeReward = { type: 'GOLD', amount: 20, label: '20 Gold' };
    }

    // Premium track rewards (better versions)
    if (i === 50) {
      // Final tier: exclusive card back
      premiumReward = { type: 'CARD_BACK', itemId: 'season1-cardback', label: 'Season 1 Card Back' };
    } else if (i === 25) {
      // Midpoint: hero skin
      premiumReward = { type: 'HERO_SKIN', itemId: 'season1-skin', label: 'Golden Hero Frame' };
    } else if (i % 10 === 0) {
      // Every 10th: 2 packs
      premiumReward = { type: 'PACK', amount: 2, label: '2 Miro Packs' };
    } else if (i % 5 === 0) {
      // Every 5th: 100 gold
      premiumReward = { type: 'GOLD', amount: 100, label: '100 Gold' };
    } else if (i % 3 === 0) {
      // Every 3rd: 50 dust
      premiumReward = { type: 'DUST', amount: 50, label: '50 Dust' };
    } else if (i % 2 === 0) {
      // Even tiers: 30 gold
      premiumReward = { type: 'GOLD', amount: 30, label: '30 Gold' };
    } else {
      // Odd tiers: 15 dust
      premiumReward = { type: 'DUST', amount: 15, label: '15 Dust' };
    }

    tiers.push({
      tier: i,
      xpRequired: i * 100,
      freeReward,
      premiumReward,
    });
  }

  return tiers;
}

export const BATTLE_PASS_TIERS = generateBattlePassTiers();
