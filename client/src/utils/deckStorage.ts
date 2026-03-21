export interface DeckList {
  id: string;
  name: string;
  cards: string[];    // cardCodes, length 60, duplicates = multiple copies
  createdAt: number;
  updatedAt: number;
}

const DECKS_KEY = 'spero-decks';
const SELECTED_KEY = 'spero-selected-deck';

export function loadDecks(): DeckList[] {
  try {
    const raw = localStorage.getItem(DECKS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as DeckList[];
  } catch {
    return [];
  }
}

export function saveDecks(decks: DeckList[]): void {
  try {
    localStorage.setItem(DECKS_KEY, JSON.stringify(decks));
  } catch { /* storage full */ }
}

export function saveDeck(deck: DeckList): void {
  const decks = loadDecks();
  const idx = decks.findIndex(d => d.id === deck.id);
  if (idx >= 0) {
    decks[idx] = deck;
  } else {
    decks.push(deck);
  }
  saveDecks(decks);
}

export function deleteDeck(id: string): void {
  const decks = loadDecks().filter(d => d.id !== id);
  saveDecks(decks);
  if (getSelectedDeckId() === id) {
    localStorage.removeItem(SELECTED_KEY);
  }
}

export function getSelectedDeckId(): string | null {
  return localStorage.getItem(SELECTED_KEY);
}

export function setSelectedDeckId(id: string | null): void {
  if (id) {
    localStorage.setItem(SELECTED_KEY, id);
  } else {
    localStorage.removeItem(SELECTED_KEY);
  }
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}
