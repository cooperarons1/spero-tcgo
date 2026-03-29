import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { HeroClass } from '../../../shared/types';

export interface HeroLevelData {
  xp: number;
  level: number;
  wins: number;
}

export type HeroLevelsMap = Partial<Record<HeroClass, HeroLevelData>>;

export async function loadHeroLevels(uid: string): Promise<HeroLevelsMap> {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      return snap.data()?.heroLevels ?? {};
    }
  } catch {}
  return {};
}

export function getHeroLevel(heroXP: number): number {
  return Math.min(Math.floor(heroXP / 50) + 1, 69);
}

export function getHeroLevelProgress(heroXP: number): number {
  const level = getHeroLevel(heroXP);
  if (level >= 69) return 1;
  const currentLevelXP = (level - 1) * 50;
  const nextLevelXP = level * 50;
  return (heroXP - currentLevelXP) / (nextLevelXP - currentLevelXP);
}
