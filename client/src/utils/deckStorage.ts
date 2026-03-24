import {
  collection,
  getDocs,
  setDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../firebase';
import { STARTER_DECKS } from '../../../shared/starterDecks';
import type { HeroClass, CardDef } from '../../../shared/types';
import cardsData from '../../../data/cards.json';

const validCardCodes = new Set((cardsData as CardDef[]).map(c => c.cardCode));

export interface DeckList {
  id: string;
  name: string;
  heroClass: HeroClass;
  cards: string[];
  createdAt: number;
  updatedAt: number;
  isStarterDeck?: boolean;
}

const MAX_DECKS = 30;
const SELECTED_KEY = 'spero-selected-deck';

export async function loadDecks(uid: string): Promise<DeckList[]> {
  const q = query(collection(db, 'users', uid, 'decks'), orderBy('createdAt', 'asc'));
  const snap = await getDocs(q);
  const decks = snap.docs.map(d => {
    const data = d.data();
    const rawCards: string[] = data.cards ?? [];
    // Filter out any card codes that no longer exist in the database
    const cards = rawCards.filter(code => validCardCodes.has(code));
    return {
      id: d.id,
      name: data.name,
      heroClass: data.heroClass ?? inferHeroClass(cards),
      cards: cards.length > 30 ? cards.slice(0, 30) : cards,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      isStarterDeck: data.isStarterDeck,
    } as DeckList;
  });

  // Clean up Firestore in background — don't block loading
  (async () => {
    try {
      for (const d of snap.docs) {
        const data = d.data();
        const rawCards: string[] = data.cards ?? [];
        const cleanCards = rawCards.filter(code => validCardCodes.has(code));
        if (cleanCards.length === 0) {
          await deleteDoc(doc(db, 'users', uid, 'decks', d.id));
        } else if (cleanCards.length !== rawCards.length || rawCards.length > 30) {
          await setDoc(doc(db, 'users', uid, 'decks', d.id), { cards: cleanCards.slice(0, 30) }, { merge: true });
        }
      }
    } catch (e) {
      console.error('Deck cleanup error:', e);
    }
  })();

  // Always filter out empty decks from the UI immediately
  return decks.filter(d => d.cards.length > 0);
}

/** Infer heroClass from card codes for legacy decks missing the field */
function inferHeroClass(cards: string[]): HeroClass {
  for (const code of cards) {
    if (code.startsWith('JIM')) return 'JIMMY';
    if (code.startsWith('TAL')) return 'TALA';
    if (code.startsWith('DRK')) return 'DEREK';
    if (code.startsWith('AND')) return 'ANDERS';
    if (code.startsWith('DES')) return 'DES';
    if (code.startsWith('AST')) return 'ASTRID';
    if (code.startsWith('AVA')) return 'AVA';
    if (code.startsWith('LUC')) return 'LUCAS';
    if (code.startsWith('IZZ')) return 'IZZY';
  }
  return 'JIMMY'; // fallback
}

export async function saveDeck(uid: string, deck: DeckList): Promise<void> {
  if (deck.cards.length > 30) {
    deck.cards = deck.cards.slice(0, 30);
  }
  const decks = await loadDecks(uid);
  const existing = decks.find(d => d.id === deck.id);
  if (!existing && decks.length >= MAX_DECKS) {
    throw new Error(`Deck limit reached (${MAX_DECKS})`);
  }
  await setDoc(doc(db, 'users', uid, 'decks', deck.id), {
    name: deck.name,
    heroClass: deck.heroClass,
    cards: deck.cards,
    createdAt: deck.createdAt,
    updatedAt: deck.updatedAt,
    isStarterDeck: deck.isStarterDeck || false,
  });
}

export async function deleteDeck(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'decks', id));
  if (getSelectedDeckId() === id) {
    localStorage.removeItem(SELECTED_KEY);
  }
}

export async function seedStarterDecks(uid: string): Promise<void> {
  const existing = await loadDecks(uid);
  const starterIds = STARTER_DECKS.map(s => s.id);

  // Check if any starter deck needs fixing (wrong card count or missing)
  const needsReseed = STARTER_DECKS.some(starter => {
    const found = existing.find(d => d.id === starter.id);
    return !found || found.cards.length !== 30;
  });

  // No starters exist and user has no decks — first time setup
  const firstTime = existing.length === 0;

  if (!firstTime && !needsReseed) return;

  const now = Date.now();
  for (const starter of STARTER_DECKS) {
    await setDoc(doc(db, 'users', uid, 'decks', starter.id), {
      name: starter.name,
      heroClass: starter.heroClass,
      cards: starter.cards,
      createdAt: now,
      updatedAt: now,
      isStarterDeck: true,
    });
  }
}

export async function migrateLocalStorageDecks(uid: string): Promise<void> {
  const MIGRATED_KEY = 'spero-decks-migrated';
  if (localStorage.getItem(MIGRATED_KEY)) return;

  try {
    const raw = localStorage.getItem('spero-decks');
    if (!raw) {
      localStorage.setItem(MIGRATED_KEY, '1');
      return;
    }
    const localDecks = JSON.parse(raw) as DeckList[];
    if (localDecks.length === 0) {
      localStorage.setItem(MIGRATED_KEY, '1');
      return;
    }

    for (const deck of localDecks) {
      await setDoc(doc(db, 'users', uid, 'decks', deck.id), {
        name: deck.name,
        heroClass: deck.heroClass ?? inferHeroClass(deck.cards),
        cards: deck.cards,
        createdAt: deck.createdAt,
        updatedAt: deck.updatedAt,
        isStarterDeck: false,
      });
    }
    localStorage.setItem(MIGRATED_KEY, '1');
  } catch {
    // Migration failed, will retry next login
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
