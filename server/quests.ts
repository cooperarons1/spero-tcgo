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
