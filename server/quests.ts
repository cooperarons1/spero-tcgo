import type { DailyQuest, QuestType, HeroClass, PlayerStats } from '../shared/types.js';
import { QUEST_TEMPLATES, HERO_CLASSES } from '../shared/questDefs.js';

/** Generate 3 random daily quests */
export function generateDailyQuests(): DailyQuest[] {
  const quests: DailyQuest[] = [];
  const usedTypes = new Set<string>();

  while (quests.length < 3) {
    const template = QUEST_TEMPLATES[Math.floor(Math.random() * QUEST_TEMPLATES.length)];
    const key = `${template.type}-${template.target}`;
    if (usedTypes.has(key)) continue;
    usedTypes.add(key);

    let description = template.descriptionTemplate.replace('{count}', String(template.target));
    let heroClass: HeroClass | undefined;
    if (template.requiresClass) {
      heroClass = HERO_CLASSES[Math.floor(Math.random() * HERO_CLASSES.length)];
      description = description.replace('{class}', heroClass.charAt(0) + heroClass.slice(1).toLowerCase());
    }

    quests.push({
      id: `quest-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: template.type,
      description,
      target: template.target,
      progress: 0,
      reward: template.reward,
      heroClass,
      completed: false,
    });
  }

  return quests;
}

/** Check if quests need refreshing (once per day) */
export function shouldRefreshQuests(lastRefreshedAt: number | undefined): boolean {
  if (!lastRefreshedAt) return true;
  const now = new Date();
  const last = new Date(lastRefreshedAt);
  // Refresh if different UTC day
  return now.getUTCDate() !== last.getUTCDate() ||
    now.getUTCMonth() !== last.getUTCMonth() ||
    now.getUTCFullYear() !== last.getUTCFullYear();
}

/** Update quest progress after a game. Returns updated quests and gold earned. */
export function updateQuestProgress(
  quests: DailyQuest[],
  isWin: boolean,
  heroClass: HeroClass,
  stats: PlayerStats
): { quests: DailyQuest[]; goldEarned: number } {
  let goldEarned = 0;

  for (const quest of quests) {
    if (quest.completed) continue;

    switch (quest.type) {
      case 'WIN_GAMES_AS_CLASS':
        if (isWin && quest.heroClass === heroClass) quest.progress++;
        break;
      case 'WIN_GAMES':
        if (isWin) quest.progress++;
        break;
      case 'PLAY_MINIONS':
        quest.progress += stats.minionsPlayed;
        break;
      case 'DEAL_DAMAGE_TO_HEROES':
        quest.progress += stats.damageDealtToHeroes;
        break;
      case 'CAST_SPELLS':
        quest.progress += stats.spellsCast;
        break;
      case 'DESTROY_MINIONS':
        quest.progress += stats.minionsKilled;
        break;
    }

    if (quest.progress >= quest.target && !quest.completed) {
      quest.completed = true;
      goldEarned += quest.reward;
    }
  }

  return { quests, goldEarned };
}

/** Calculate XP earned from a game */
export function calculateXP(isWin: boolean): number {
  return isWin ? 50 : 20;
}

/** Calculate level from total XP (100 XP per level) */
export function getLevel(xp: number): number {
  return Math.floor(xp / 100) + 1;
}

/** Calculate hero-specific XP earned */
export function calculateHeroXP(isWin: boolean): number {
  return isWin ? 30 : 10;
}

/** XP required to reach a given hero level (scaling curve) */
export function getHeroXPForLevel(level: number): number {
  // Level 1 = 0 XP, Level 2 = 50, Level 10 = 450, Level 69 = 3400
  if (level <= 1) return 0;
  return (level - 1) * 50;
}

/** Calculate hero level from total hero XP (max 60) */
export function getHeroLevel(heroXP: number): number {
  const level = Math.floor(heroXP / 50) + 1;
  return Math.min(level, 60);
}

/** Get hero progress to next level as 0-1 */
export function getHeroLevelProgress(heroXP: number): number {
  const level = getHeroLevel(heroXP);
  if (level >= 60) return 1;
  const currentLevelXP = (level - 1) * 50;
  const nextLevelXP = level * 50;
  return (heroXP - currentLevelXP) / (nextLevelXP - currentLevelXP);
}
