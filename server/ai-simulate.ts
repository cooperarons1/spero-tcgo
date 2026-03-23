#!/usr/bin/env npx tsx
/**
 * AI Self-Play Simulator — runs headless AI-vs-AI games.
 *
 * Usage:
 *   npx tsx server/ai-simulate.ts --games 100
 *   npx tsx server/ai-simulate.ts --games 100 --verbose
 */

import { createGame, endTurn, startTurn, confirmMulligan } from './game.js';
import { playCard, useHeroPower } from './actions.js';
import { attack } from './combat.js';
import { getCardDef } from './cards.js';
import { STARTER_DECKS } from '../shared/starterDecks.js';
import { minionHasKeyword, hasActiveTaunt, getTauntMinions } from './keywords.js';
import type { GameState, BoardMinion, PlayerState, HeroClass } from '../shared/types.js';

const args = process.argv.slice(2);
const gameCount = parseInt(args[args.indexOf('--games') + 1] || '10');
const verbose = args.includes('--verbose');

console.log(`\n🎮 Spero TCGO AI Simulator — Hearthstone Edition`);
console.log(`Running ${gameCount} games...\n`);

let wins = [0, 0];
let totalTurns = 0;
let errors = 0;
const MAX_TURNS = 80;

for (let g = 0; g < gameCount; g++) {
  try {
    const deck1 = STARTER_DECKS[Math.floor(Math.random() * STARTER_DECKS.length)];
    const deck2 = STARTER_DECKS[Math.floor(Math.random() * STARTER_DECKS.length)];

    const game = createGame(
      [
        { id: 'ai-1', name: 'Bot Alpha', heroClass: deck1.heroClass },
        { id: 'ai-2', name: 'Bot Beta', heroClass: deck2.heroClass },
      ],
      { deckLists: [deck1.cards, deck2.cards] }
    );

    // Auto-mulligan: keep all
    confirmMulligan(game, 'ai-1', game.players[0].hand.map(() => false));
    confirmMulligan(game, 'ai-2', game.players[1].hand.map(() => false));

    let turnCount = 0;
    while (!game.winner && turnCount < MAX_TURNS) {
      turnCount++;
      const pIdx = game.currentPlayerIndex;
      const me = game.players[pIdx];
      const oppIdx = (pIdx === 0 ? 1 : 0) as 0 | 1;
      const opp = game.players[oppIdx];

      // Play cards
      let played = true;
      let safety = 0;
      while (played && !game.winner && safety < 30) {
        played = false;
        safety++;

        const playable = me.hand
          .filter(c => {
            const def = getCardDef(c.cardCode);
            return def.manaCost <= me.mana && c.cardCode !== 'COIN';
          })
          .sort((a, b) => getCardDef(b.cardCode).manaCost - getCardDef(a.cardCode).manaCost);

        for (const card of playable) {
          if (game.winner) break;
          const def = getCardDef(card.cardCode);
          if (def.type === 'MINION' && me.board.length >= 7) continue;

          let targetId: string | null = null;
          const result = playCard(game, me.playerId, card.instanceId, undefined, targetId);
          if (result.success) {
            played = true;
            break;
          } else if (result.needsTarget && result.validTargets && result.validTargets.length > 0) {
            // Pick first enemy target for damage, first friendly for buffs
            const target = result.validTargets[0];
            const retry = playCard(game, me.playerId, card.instanceId, undefined, target);
            if (retry.success) {
              played = true;
              break;
            }
          }
        }
      }

      if (game.winner) break;

      // Attacks
      for (const minion of [...me.board]) {
        if (game.winner) break;
        if (!minion.canAttack || minion.attacksRemaining <= 0 || minion.isFrozen || minion.currentAttack <= 0) continue;

        const taunts = getTauntMinions(opp.board);
        let target: string;
        if (taunts.length > 0) {
          target = taunts[0].instanceId;
        } else if (opp.board.length > 0) {
          const killable = opp.board.filter(m => m.currentHealth <= minion.currentAttack && !m.hasStealthUntilAttack);
          if (killable.length > 0) {
            target = killable.sort((a, b) => b.currentAttack - a.currentAttack)[0].instanceId;
          } else {
            target = `hero-${oppIdx}`;
          }
        } else {
          target = `hero-${oppIdx}`;
        }

        attack(game, me.playerId, minion.instanceId, target);
      }

      if (game.winner) break;

      // Hero power
      if (!me.heroPowerUsed && me.mana >= 2) {
        let hpTarget: string | null = null;
        if (me.heroClass === 'JIMMY') {
          hpTarget = opp.board.length > 0 ? opp.board[0].instanceId : `hero-${oppIdx}`;
        } else if (me.heroClass === 'TALA') {
          hpTarget = me.health < me.maxHealth ? `hero-${pIdx}` : `hero-${pIdx}`;
        } else if (me.heroClass === 'ANDERS') {
          hpTarget = opp.board.length > 0 ? opp.board[0].instanceId : null;
        }
        // Derek has no target needed
        if (me.heroClass === 'DEREK' || hpTarget) {
          useHeroPower(game, me.playerId, hpTarget);
        }
      }

      if (game.winner) break;

      // End turn
      endTurn(game, me.playerId);
    }

    if (game.winner) {
      const winnerIdx = game.players.findIndex(p => p.playerId === game.winner);
      wins[winnerIdx]++;
      totalTurns += game.turnNumber;
      if (verbose) {
        console.log(`Game ${g + 1}: ${game.players[winnerIdx].playerName} (${game.players[winnerIdx].heroClass}) wins on turn ${game.turnNumber} via ${game.winReason}`);
      }
    } else {
      if (verbose) console.log(`Game ${g + 1}: Draw (max turns reached)`);
    }
  } catch (err) {
    errors++;
    if (verbose) console.error(`Game ${g + 1}: ERROR:`, (err as Error).message);
  }
}

console.log(`\n── Results ──`);
console.log(`Bot Alpha wins: ${wins[0]}/${gameCount} (${((wins[0] / gameCount) * 100).toFixed(1)}%)`);
console.log(`Bot Beta wins:  ${wins[1]}/${gameCount} (${((wins[1] / gameCount) * 100).toFixed(1)}%)`);
console.log(`Draws/Errors:   ${gameCount - wins[0] - wins[1]}`);
console.log(`Avg turns:      ${totalTurns > 0 ? (totalTurns / (wins[0] + wins[1])).toFixed(1) : 'N/A'}`);
console.log(`Errors:         ${errors}`);
console.log();
