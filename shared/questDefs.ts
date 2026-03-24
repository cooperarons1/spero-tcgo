import type { QuestType, HeroClass } from './types.js';

export interface QuestTemplate {
  type: QuestType;
  descriptionTemplate: string; // {class} and {count} are replaced
  target: number;
  reward: number; // gold
  requiresClass?: boolean;
}

export const QUEST_TEMPLATES: QuestTemplate[] = [
  { type: 'WIN_GAMES_AS_CLASS', descriptionTemplate: 'Win 2 games as {class}', target: 2, reward: 60, requiresClass: true },
  { type: 'WIN_GAMES_AS_CLASS', descriptionTemplate: 'Win 3 games as {class}', target: 3, reward: 80, requiresClass: true },
  { type: 'PLAY_MINIONS', descriptionTemplate: 'Play {count} minions', target: 10, reward: 50 },
  { type: 'PLAY_MINIONS', descriptionTemplate: 'Play {count} minions', target: 20, reward: 80 },
  { type: 'DEAL_DAMAGE_TO_HEROES', descriptionTemplate: 'Deal {count} damage to enemy heroes', target: 30, reward: 50 },
  { type: 'DEAL_DAMAGE_TO_HEROES', descriptionTemplate: 'Deal {count} damage to enemy heroes', target: 50, reward: 80 },
  { type: 'CAST_SPELLS', descriptionTemplate: 'Cast {count} spells', target: 10, reward: 50 },
  { type: 'DESTROY_MINIONS', descriptionTemplate: 'Destroy {count} enemy minions', target: 10, reward: 50 },
  { type: 'DESTROY_MINIONS', descriptionTemplate: 'Destroy {count} enemy minions', target: 15, reward: 80 },
  { type: 'WIN_GAMES', descriptionTemplate: 'Win {count} games', target: 3, reward: 60 },
  { type: 'WIN_GAMES', descriptionTemplate: 'Win {count} games', target: 5, reward: 100 },
];

export const HERO_CLASSES: HeroClass[] = ['DEREK', 'TALA', 'JIMMY', 'ANDERS', 'DES', 'ASTRID', 'AVA', 'LUCAS', 'IZZY'];
