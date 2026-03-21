const STORAGE_KEY = 'spero-match-history';
const MAX_ENTRIES = 50;

export interface MatchRecord {
  id: string;
  date: number;
  myName: string;
  opponentName: string;
  isWin: boolean;
  winReason: 'ap' | 'deckout' | 'concede' | null;
  myAP: number;
  opponentAP: number;
  turns: number;
  myMissions: number;
  opponentMissions: number;
  myDamage: number;
  opponentDamage: number;
}

export function saveMatch(record: MatchRecord): void {
  const history = getHistory();
  history.unshift(record);
  if (history.length > MAX_ENTRIES) history.length = MAX_ENTRIES;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch { /* storage full */ }
}

export function getHistory(): MatchRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as MatchRecord[];
  } catch {
    return [];
  }
}

export function clearHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}
