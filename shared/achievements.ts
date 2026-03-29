export interface Achievement {
  id: string;
  name: string;
  description: string;
  reward: { type: 'GOLD' | 'DUST' | 'PACK'; amount: number };
  condition: { type: string; target: number };
}

export const ACHIEVEMENTS: Achievement[] = [
  // First steps
  { id: 'first-win', name: 'First Victory', description: 'Win your first game', reward: { type: 'GOLD', amount: 50 }, condition: { type: 'TOTAL_WINS', target: 1 } },
  { id: 'win-10', name: 'Getting Started', description: 'Win 10 games', reward: { type: 'GOLD', amount: 100 }, condition: { type: 'TOTAL_WINS', target: 10 } },
  { id: 'win-50', name: 'Veteran', description: 'Win 50 games', reward: { type: 'PACK', amount: 2 }, condition: { type: 'TOTAL_WINS', target: 50 } },
  { id: 'win-100', name: 'Centurion', description: 'Win 100 games', reward: { type: 'GOLD', amount: 300 }, condition: { type: 'TOTAL_WINS', target: 100 } },
  { id: 'win-500', name: 'Champion', description: 'Win 500 games', reward: { type: 'GOLD', amount: 500 }, condition: { type: 'TOTAL_WINS', target: 500 } },

  // Games played
  { id: 'play-1', name: 'Welcome to Miro', description: 'Play your first game', reward: { type: 'GOLD', amount: 25 }, condition: { type: 'TOTAL_GAMES', target: 1 } },
  { id: 'play-100', name: 'Dedicated', description: 'Play 100 games', reward: { type: 'PACK', amount: 1 }, condition: { type: 'TOTAL_GAMES', target: 100 } },
  { id: 'play-500', name: 'Miro Addict', description: 'Play 500 games', reward: { type: 'GOLD', amount: 500 }, condition: { type: 'TOTAL_GAMES', target: 500 } },

  // Hero mastery
  { id: 'hero-level-10', name: 'Hero Training', description: 'Reach level 10 with any hero', reward: { type: 'GOLD', amount: 100 }, condition: { type: 'HERO_LEVEL', target: 10 } },
  { id: 'hero-level-30', name: 'Hero Mastery', description: 'Reach level 30 with any hero', reward: { type: 'PACK', amount: 2 }, condition: { type: 'HERO_LEVEL', target: 30 } },
  { id: 'hero-level-60', name: 'Orra Master', description: 'Reach level 60 with any hero', reward: { type: 'GOLD', amount: 500 }, condition: { type: 'HERO_LEVEL', target: 60 } },
  { id: 'golden-hero', name: 'Golden Hero', description: 'Win 500 games with a single hero', reward: { type: 'GOLD', amount: 1000 }, condition: { type: 'HERO_WINS', target: 500 } },

  // Rank
  { id: 'rank-silver', name: 'Silver Rank', description: 'Reach Silver rank', reward: { type: 'GOLD', amount: 100 }, condition: { type: 'RANK', target: 1200 } },
  { id: 'rank-gold', name: 'Gold Rank', description: 'Reach Gold rank', reward: { type: 'PACK', amount: 2 }, condition: { type: 'RANK', target: 1500 } },
  { id: 'rank-diamond', name: 'Diamond Rank', description: 'Reach Diamond rank', reward: { type: 'GOLD', amount: 300 }, condition: { type: 'RANK', target: 1800 } },
  { id: 'rank-legend', name: 'Legend', description: 'Reach Legend rank', reward: { type: 'GOLD', amount: 1000 }, condition: { type: 'RANK', target: 2100 } },

  // Collection
  { id: 'open-pack', name: 'Pack Rat', description: 'Open your first pack', reward: { type: 'GOLD', amount: 25 }, condition: { type: 'PACKS_OPENED', target: 1 } },
  { id: 'open-10-packs', name: 'Card Collector', description: 'Open 10 packs', reward: { type: 'DUST', amount: 100 }, condition: { type: 'PACKS_OPENED', target: 10 } },
  { id: 'craft-card', name: 'Artisan', description: 'Craft your first card', reward: { type: 'DUST', amount: 50 }, condition: { type: 'CARDS_CRAFTED', target: 1 } },

  // Streak
  { id: 'streak-3', name: 'On a Roll', description: 'Win 3 games in a row', reward: { type: 'GOLD', amount: 50 }, condition: { type: 'WIN_STREAK', target: 3 } },
  { id: 'streak-5', name: 'Unstoppable', description: 'Win 5 games in a row', reward: { type: 'PACK', amount: 1 }, condition: { type: 'WIN_STREAK', target: 5 } },
  { id: 'streak-10', name: 'Invincible', description: 'Win 10 games in a row', reward: { type: 'GOLD', amount: 500 }, condition: { type: 'WIN_STREAK', target: 10 } },

  // Login
  { id: 'login-7', name: 'Weekly Regular', description: 'Log in 7 days in a row', reward: { type: 'PACK', amount: 1 }, condition: { type: 'LOGIN_STREAK', target: 7 } },
  { id: 'login-30', name: 'Monthly Devotee', description: 'Log in 30 days in a row', reward: { type: 'GOLD', amount: 500 }, condition: { type: 'LOGIN_STREAK', target: 30 } },
];

export function checkAchievements(
  userData: any,
  heroLevels: Record<string, { level: number; wins: number }>,
  unlockedIds: string[],
): { newlyUnlocked: Achievement[]; allUnlocked: string[] } {
  const unlocked = new Set(unlockedIds);
  const newlyUnlocked: Achievement[] = [];

  for (const ach of ACHIEVEMENTS) {
    if (unlocked.has(ach.id)) continue;

    let met = false;
    switch (ach.condition.type) {
      case 'TOTAL_WINS':
        met = (userData.gamesWon ?? 0) >= ach.condition.target;
        break;
      case 'TOTAL_GAMES':
        met = (userData.gamesPlayed ?? 0) >= ach.condition.target;
        break;
      case 'HERO_LEVEL':
        met = Object.values(heroLevels).some((h: any) => (h.level ?? 1) >= ach.condition.target);
        break;
      case 'HERO_WINS':
        met = Object.values(heroLevels).some((h: any) => (h.wins ?? 0) >= ach.condition.target);
        break;
      case 'RANK':
        met = (userData.elo ?? 1000) >= ach.condition.target;
        break;
      case 'PACKS_OPENED':
        met = (userData.packsOpened ?? 0) >= ach.condition.target;
        break;
      case 'CARDS_CRAFTED':
        met = (userData.cardsCrafted ?? 0) >= ach.condition.target;
        break;
      case 'WIN_STREAK':
        met = (userData.bestWinStreak ?? 0) >= ach.condition.target;
        break;
      case 'LOGIN_STREAK':
        met = (userData.loginStreak ?? 0) >= ach.condition.target;
        break;
    }

    if (met) {
      newlyUnlocked.push(ach);
      unlocked.add(ach.id);
    }
  }

  return { newlyUnlocked, allUnlocked: Array.from(unlocked) };
}
