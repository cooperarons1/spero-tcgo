import {
  collection,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../firebase';
import { PLATFORM } from '../config';
import { restGetDoc, restListCollection, restSetDoc, restDeleteDoc } from './firestoreRest';
import { STARTER_DECKS } from '../../../shared/starterDecks';
import type { HeroClass, CardDef } from '../../../shared/types';
import cardsData from '../../../data/cards.json';

const USE_REST = PLATFORM === 'ios';

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
  const rawDocs: { id: string; data: any }[] = USE_REST
    ? (await restListCollection(`users/${uid}/decks`)).map(d => ({ id: d.id, data: d.data }))
    : (await getDocs(query(collection(db, 'users', uid, 'decks'), orderBy('createdAt', 'asc')))).docs.map(d => ({ id: d.id, data: d.data() }));

  const decks = rawDocs.map(d => {
    const data = d.data;
    const rawCards: string[] = data.cards ?? [];
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
  // REST path returns docs in arbitrary order; sort to match the JS-SDK
  // orderBy('createdAt') so the deck list is stable across platforms.
  if (USE_REST) decks.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));

  // Background cleanup of corrupt entries
  (async () => {
    try {
      for (const d of rawDocs) {
        const data = d.data;
        const rawCards: string[] = data.cards ?? [];
        const cleanCards = rawCards.filter(code => validCardCodes.has(code));
        if (cleanCards.length === 0) {
          if (USE_REST) await restDeleteDoc(`users/${uid}/decks/${d.id}`);
          else await deleteDoc(doc(db, 'users', uid, 'decks', d.id));
        } else if (cleanCards.length !== rawCards.length || rawCards.length > 30) {
          if (USE_REST) await restSetDoc(`users/${uid}/decks/${d.id}`, { cards: cleanCards.slice(0, 30) }, true);
          else await setDoc(doc(db, 'users', uid, 'decks', d.id), { cards: cleanCards.slice(0, 30) }, { merge: true });
        }
      }
    } catch (e) {
      console.error('Deck cleanup error:', e);
    }
  })();

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
  const payload = {
    name: deck.name,
    heroClass: deck.heroClass,
    cards: deck.cards,
    createdAt: deck.createdAt,
    updatedAt: deck.updatedAt,
    isStarterDeck: deck.isStarterDeck || false,
  };
  if (USE_REST) await restSetDoc(`users/${uid}/decks/${deck.id}`, payload);
  else await setDoc(doc(db, 'users', uid, 'decks', deck.id), payload);
}

export async function deleteDeck(uid: string, id: string): Promise<void> {
  if (USE_REST) await restDeleteDoc(`users/${uid}/decks/${id}`);
  else await deleteDoc(doc(db, 'users', uid, 'decks', id));
  if (getSelectedDeckId() === id) {
    localStorage.removeItem(SELECTED_KEY);
  }
}

/** Bump this key when you need to force-wipe all player decks in response to
 * a class-pool overhaul. Users with an older migration version in their user
 * doc get all decks wiped and starters re-seeded on next login. */
const DECK_MIGRATION_VERSION = 2;

async function readUserDoc(uid: string): Promise<{ exists: boolean; data: any }> {
  if (USE_REST) {
    const d = await restGetDoc(`users/${uid}`);
    return { exists: !!d, data: d?.data ?? {} };
  }
  const snap = await getDoc(doc(db, 'users', uid));
  return { exists: snap.exists(), data: snap.data() ?? {} };
}

async function writeUserDoc(uid: string, data: Record<string, unknown>, merge: boolean): Promise<void> {
  if (USE_REST) await restSetDoc(`users/${uid}`, data, merge);
  else await setDoc(doc(db, 'users', uid), data, { merge });
}

async function writeStarterDeck(uid: string, starter: typeof STARTER_DECKS[number], now: number): Promise<void> {
  const payload = {
    name: starter.name,
    heroClass: starter.heroClass,
    cards: starter.cards,
    createdAt: now,
    updatedAt: now,
    isStarterDeck: true,
  };
  if (USE_REST) await restSetDoc(`users/${uid}/decks/${starter.id}`, payload);
  else await setDoc(doc(db, 'users', uid, 'decks', starter.id), payload);
}

export async function seedStarterDecks(uid: string): Promise<void> {
  const userDoc = await readUserDoc(uid);
  const userVersion = (userDoc.data?.deckMigrationVersion ?? 0) as number;

  if (userVersion < DECK_MIGRATION_VERSION) {
    if (USE_REST) {
      const docs = await restListCollection(`users/${uid}/decks`);
      for (const d of docs) await restDeleteDoc(`users/${uid}/decks/${d.id}`);
    } else {
      const snap = await getDocs(collection(db, 'users', uid, 'decks'));
      for (const d of snap.docs) await deleteDoc(doc(db, 'users', uid, 'decks', d.id));
    }
    const now = Date.now();
    for (const starter of STARTER_DECKS) await writeStarterDeck(uid, starter, now);
    localStorage.removeItem(SELECTED_KEY);
    await writeUserDoc(uid, { deckMigrationVersion: DECK_MIGRATION_VERSION }, true);
    if (!userDoc.exists || !userDoc.data?.gold) {
      await writeUserDoc(uid, { gold: 500, dust: 0 }, true);
    }
    return;
  }

  const existing = await loadDecks(uid);
  const needsReseed = STARTER_DECKS.some(starter => {
    const found = existing.find(d => d.id === starter.id);
    if (!found || found.cards.length !== 30) return true;
    const sorted1 = [...found.cards].sort().join(',');
    const sorted2 = [...starter.cards].sort().join(',');
    return sorted1 !== sorted2;
  });
  const firstTime = existing.length === 0;
  if (!firstTime && !needsReseed) return;

  const now = Date.now();
  for (const starter of STARTER_DECKS) await writeStarterDeck(uid, starter, now);

  if (firstTime && (!userDoc.exists || !userDoc.data?.gold)) {
    await writeUserDoc(uid, { gold: 500, dust: 0 }, true);
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
