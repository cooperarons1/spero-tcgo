import type { Server, Socket } from 'socket.io';
import { getAllCardDefs } from '../cards.js';
import { adminDb } from '../firebaseAdmin.js';
import { validated } from '../state.js';
import { CraftCardSchema, DisenchantCardSchema } from '../validation.js';
import { isAdminUid } from '../admin.js';

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

export function registerShopHandlers(
  io: Server,
  socket: Socket,
  uid: string,
) {
  // ── Pack Opening ──

  // Bundle pricing for multi-pack purchases. The single-pack handler
  // below normalizes payload?.count to one of these tiers and applies
  // the corresponding total cost. Keeping the table server-side prevents
  // a malicious client from sending count=10, cost=100.
  const PACK_BUNDLE_COSTS: Record<number, number> = {
    1: 100,
    5: 450,   // 10% off
    10: 800,  // 20% off
  };

  socket.on('open-pack', async (payload?: { count?: number }) => {
    try {
      const { openPack, DUST_VALUES } = await import('../packs.js');
      // Validate the requested count against the bundle table — anything
      // not in the table falls back to a single pack so we never accept
      // a hand-crafted "count: 1000" from a client.
      const requestedCount = payload?.count ?? 1;
      const count = (requestedCount in PACK_BUNDLE_COSTS) ? requestedCount : 1;
      const totalCost = PACK_BUNDLE_COSTS[count];

      const userRef = adminDb.collection('users').doc(uid);

      // ── Atomic transaction ──
      const result = await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(userRef);
        const data = snap.data() ?? {};
        const gold = data.gold ?? 0;

        if (gold < totalCost) {
          return { ok: false as const, error: 'Not enough gold' };
        }

        const ownedCards: Record<string, number> = { ...(data.ownedCards ?? {}) };
        let packsSinceLegendary = data.packsSinceLegendary ?? 0;
        let packsSinceEpic = data.packsSinceEpic ?? 0;
        let dustGained = 0;
        const allCards: { cardCode: string; rarity: string; isNew: boolean }[] = [];

        for (let i = 0; i < count; i++) {
          const r = openPack(ownedCards, packsSinceLegendary, packsSinceEpic);
          for (const card of r.cards) {
            const current = ownedCards[card.cardCode] ?? 0;
            const max = card.rarity === 'LEGENDARY' ? 1 : 2;
            if (current < max) {
              ownedCards[card.cardCode] = current + 1;
            } else {
              // Extra card — auto-disenchant to dust
              dustGained += DUST_VALUES[card.rarity] ?? 5;
            }
            allCards.push(card);
          }
          packsSinceLegendary = r.packsSinceLegendary;
          packsSinceEpic = r.packsSinceEpic;
        }

        const newGold = gold - totalCost;
        const newDust = (data.dust ?? 0) + dustGained;

        tx.update(userRef, {
          gold: newGold,
          dust: newDust,
          ownedCards,
          packsOpened: (data.packsOpened ?? 0) + count,
          packsSinceLegendary,
          packsSinceEpic,
        });

        return { ok: true as const, allCards, dustGained, newGold, newDust };
      });

      if (!result.ok) {
        socket.emit('pack-error', result.error);
        return;
      }

      socket.emit('pack-opened', {
        cards: result.allCards,
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

      const userRef = adminDb.collection('users').doc(uid);

      const result = await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(userRef);
        const d = snap.data() ?? {};
        const dust = d.dust ?? 0;

        if (dust < cost) return { ok: false as const, error: 'Not enough dust' };

        const ownedCards: Record<string, number> = { ...(d.ownedCards ?? {}) };
        const current = ownedCards[data.cardCode] ?? 0;
        if (current >= max) return { ok: false as const, error: 'Already own max copies' };

        ownedCards[data.cardCode] = current + 1;
        const newDust = dust - cost;

        tx.update(userRef, { dust: newDust, ownedCards });
        return { ok: true as const, newDust, newCount: current + 1 };
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

      const userRef = adminDb.collection('users').doc(uid);

      const result = await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(userRef);
        const d = snap.data() ?? {};
        const ownedCards: Record<string, number> = { ...(d.ownedCards ?? {}) };
        const current = ownedCards[data.cardCode] ?? 0;
        if (current <= 0) return { ok: false as const, error: "You don't own this card" };

        ownedCards[data.cardCode] = current - 1;
        const newDust = (d.dust ?? 0) + dustValue;

        tx.update(userRef, { dust: newDust, ownedCards });
        return { ok: true as const, newDust, newCount: current - 1 };
      });

      if (!result.ok) {
        socket.emit('disenchant-error', result.error);
        return;
      }
      socket.emit('disenchant-success', { cardCode: data.cardCode, newDust: result.newDust, dustGained: dustValue, newCount: result.newCount });
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
        // Admins: synthesize unlimited economy + full collection. No
        // Firestore write — keeps the underlying doc untouched in case
        // admin status is later revoked.
        socket.emit('inventory-update', {
          dust: 999999,
          gold: 999999,
          ownedCards: buildAdminOwnedCards(),
          packsOpened: userData.packsOpened ?? 0,
          isAdmin: true,
        });
        return;
      }
      socket.emit('inventory-update', {
        dust: userData.dust ?? 0,
        gold: userData.gold ?? 0,
        ownedCards: userData.ownedCards ?? {},
        packsOpened: userData.packsOpened ?? 0,
      });
    } catch (err) {
      console.error('get-inventory error:', err);
      socket.emit('inventory-update', { dust: 0, gold: 0, ownedCards: {}, packsOpened: 0 });
    }
  });
}
