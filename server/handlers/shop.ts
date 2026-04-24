import type { Server, Socket } from 'socket.io';
import { getAllCardDefs } from '../cards.js';
import { adminDb } from '../firebaseAdmin.js';
import { validated } from '../state.js';
import { CraftCardSchema, DisenchantCardSchema } from '../validation.js';
import { isAdminUid } from '../admin.js';
import { CARD_BACKS, COINS } from '../../shared/cosmetics.js';

// Synthesize "all cards maxed" inventory for admin accounts so owners
// don't have to buy packs to test the full card pool.
function buildAdminOwnedCards(): Record<string, number> {
  const owned: Record<string, number> = {};
  for (const c of getAllCardDefs()) {
    if (c.cardCode === 'COIN' || c.cardCode.includes('_TOKEN_')) continue;
    owned[c.cardCode] = c.rarity === 'LEGENDARY' ? 1 : 2;
  }
  return owned;
}

// Same layout as ownedCards but tracks golden/foil copies separately.
// Admins get one gold copy of every card so they can preview the
// foil render path without opening packs.
function buildAdminOwnedGolden(): Record<string, number> {
  const owned: Record<string, number> = {};
  for (const c of getAllCardDefs()) {
    if (c.cardCode === 'COIN' || c.cardCode.includes('_TOKEN_')) continue;
    owned[c.cardCode] = 1;
  }
  return owned;
}

export function registerShopHandlers(
  io: Server,
  socket: Socket,
  uid: string,
) {
  // ── Pack Opening ──

  socket.on('open-pack', async (payload?: { count?: number }) => {
    try {
      const { openPack, openPackBundle, PACK_BUNDLE_COSTS } = await import('../packs.js');
      const requestedCount = payload?.count ?? 1;

      const userRef = adminDb.collection('users').doc(uid);
      const admin = isAdminUid(uid);

      // Admins bypass the Firestore economy entirely — no gold deduction,
      // no ownership tracking (get-inventory synthesizes the full pool +
      // 999k gold/dust). Just roll packs and return the cards so the
      // opening flow can be exercised for testing.
      if (admin) {
        const count = (requestedCount in PACK_BUNDLE_COSTS) ? requestedCount : 1;
        const allCards: { cardCode: string; rarity: string; isNew: boolean }[] = [];
        for (let i = 0; i < count; i++) {
          const r = openPack({}, 0, 0);
          for (const card of r.cards) allCards.push(card);
        }
        socket.emit('pack-opened', {
          cards: allCards,
          dustGained: 0,
          newGold: 999999,
          newDust: 999999,
        });
        return;
      }

      // ── Atomic transaction ──
      // The bundle logic is a pure function in packs.ts; we only use
      // the tx to read the user's current state and write the result
      // atomically so two simultaneous open-pack calls can't double-spend.
      const result = await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(userRef);
        const data = snap.data() ?? {};

        const outcome = openPackBundle({
          requestedCount,
          currentGold: data.gold ?? 0,
          currentDust: data.dust ?? 0,
          ownedCards: (data.ownedCards ?? {}) as Record<string, number>,
          packsSinceLegendary: data.packsSinceLegendary ?? 0,
          packsSinceEpic: data.packsSinceEpic ?? 0,
          packsOpened: data.packsOpened ?? 0,
        });

        if (!outcome.ok) return outcome;

        tx.update(userRef, {
          gold: outcome.newGold,
          dust: outcome.newDust,
          ownedCards: outcome.newOwnedCards,
          packsOpened: outcome.newPacksOpened,
          packsSinceLegendary: outcome.newPacksSinceLegendary,
          packsSinceEpic: outcome.newPacksSinceEpic,
        });

        return outcome;
      });

      if (!result.ok) {
        socket.emit('pack-error', result.error);
        return;
      }

      socket.emit('pack-opened', {
        cards: result.cards,
        dustGained: result.dustGained,
        newGold: result.newGold,
        newDust: result.newDust,
      });
    } catch (err) {
      console.error('open-pack error:', err);
      socket.emit('pack-error', 'Failed to open pack');
    }
  });

  // ── Craft / Disenchant ──

  socket.on('craft-card', validated(CraftCardSchema, async (data) => {
    try {
      const { CRAFT_COSTS } = await import('../packs.js');
      const { getCardDef } = await import('../cards.js');
      const def = getCardDef(data.cardCode);
      const cost = CRAFT_COSTS[def.rarity] ?? 40;
      const max = def.rarity === 'LEGENDARY' ? 1 : 2;

      if (isAdminUid(uid)) {
        socket.emit('craft-success', { cardCode: data.cardCode, newDust: 999999, newCount: max });
        return;
      }

      const userRef = adminDb.collection('users').doc(uid);
      const { craftCard } = await import('../packs.js');

      const result = await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(userRef);
        const d = snap.data() ?? {};
        const outcome = craftCard({
          cardCode: data.cardCode,
          rarity: def.rarity,
          currentDust: d.dust ?? 0,
          ownedCards: (d.ownedCards ?? {}) as Record<string, number>,
        });
        if (!outcome.ok) return outcome;
        tx.update(userRef, { dust: outcome.newDust, ownedCards: outcome.newOwnedCards });
        return outcome;
      });

      if (!result.ok) {
        socket.emit('craft-error', result.error);
        return;
      }
      socket.emit('craft-success', { cardCode: data.cardCode, newDust: result.newDust, newCount: result.newCount });
    } catch (err) {
      console.error('craft-card error:', err);
      socket.emit('craft-error', 'Failed to craft');
    }
  }));

  socket.on('disenchant-card', validated(DisenchantCardSchema, async (data) => {
    try {
      const { DUST_VALUES } = await import('../packs.js');
      const { getCardDef } = await import('../cards.js');
      const def = getCardDef(data.cardCode);
      const dustValue = DUST_VALUES[def.rarity] ?? 5;
      const max = def.rarity === 'LEGENDARY' ? 1 : 2;

      if (isAdminUid(uid)) {
        socket.emit('disenchant-success', { cardCode: data.cardCode, newDust: 999999, dustGained: dustValue, newCount: max });
        return;
      }

      const userRef = adminDb.collection('users').doc(uid);
      const { disenchantCard } = await import('../packs.js');

      const result = await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(userRef);
        const d = snap.data() ?? {};
        const outcome = disenchantCard({
          cardCode: data.cardCode,
          rarity: def.rarity,
          currentDust: d.dust ?? 0,
          ownedCards: (d.ownedCards ?? {}) as Record<string, number>,
        });
        if (!outcome.ok) return outcome;
        tx.update(userRef, { dust: outcome.newDust, ownedCards: outcome.newOwnedCards });
        return outcome;
      });

      if (!result.ok) {
        socket.emit('disenchant-error', result.error);
        return;
      }
      socket.emit('disenchant-success', { cardCode: data.cardCode, newDust: result.newDust, dustGained: result.dustGained, newCount: result.newCount });
    } catch (err) {
      console.error('disenchant-card error:', err);
      socket.emit('disenchant-error', 'Failed to disenchant');
    }
  }));

  // ── Get inventory (dust, gold, owned cards) ──

  socket.on('get-inventory', async () => {
    try {
      const userDoc = await adminDb.collection('users').doc(uid).get();
      const userData = userDoc.data() ?? {};
      if (isAdminUid(uid)) {
        // Admins: synthesize unlimited economy + full collection + gold
        // copies + every cosmetic. No Firestore write — keeps the
        // underlying doc untouched in case admin status is later
        // revoked.
        socket.emit('inventory-update', {
          dust: 999999,
          gold: 999999,
          ownedCards: buildAdminOwnedCards(),
          ownedGolden: buildAdminOwnedGolden(),
          ownedCardBacks: CARD_BACKS.map(c => c.id),
          ownedCoins: COINS.map(c => c.id),
          selectedCardBack: userData.selectedCardBack ?? 'default',
          selectedCoin: userData.selectedCoin ?? 'default',
          packsOpened: userData.packsOpened ?? 0,
          isAdmin: true,
        });
        return;
      }
      // Non-admins: everyone gets the base card back + base coin for
      // free; others are tracked in Firestore as they're earned.
      const ownedBacks = Array.isArray(userData.ownedCardBacks) ? userData.ownedCardBacks : [];
      const ownedCoins = Array.isArray(userData.ownedCoins) ? userData.ownedCoins : [];
      socket.emit('inventory-update', {
        dust: userData.dust ?? 0,
        gold: userData.gold ?? 0,
        ownedCards: userData.ownedCards ?? {},
        ownedGolden: userData.ownedGolden ?? {},
        ownedCardBacks: Array.from(new Set(['default', ...ownedBacks])),
        ownedCoins: Array.from(new Set(['default', ...ownedCoins])),
        selectedCardBack: userData.selectedCardBack ?? 'default',
        selectedCoin: userData.selectedCoin ?? 'default',
        packsOpened: userData.packsOpened ?? 0,
      });
    } catch (err) {
      console.error('get-inventory error:', err);
      socket.emit('inventory-update', { dust: 0, gold: 0, ownedCards: {}, packsOpened: 0 });
    }
  });
}
