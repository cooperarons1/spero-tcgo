import { useState } from 'react';
import type { ClientGameState, PlayerStats, CardStats } from '../../../shared/types';
import { getCardDef } from '../utils/stackHelpers';
import { ConfettiCanvas } from './ConfettiCanvas';

type RematchState = 'default' | 'proposed' | 'received' | 'declined';

interface GameOverProps {
  winnerName: string;
  isMe: boolean;
  onPlayAgain: () => void;
  onRequestRematch: () => void;
  onDeclineRematch: () => void;
  gameState: ClientGameState;
  rematchState: RematchState;
}

function StatRow({ label, my, opp }: { label: string; my: number; opp: number }) {
  return (
    <tr className="border-t border-board-accent">
      <td className="py-1.5 px-2 text-right font-bold text-white">{my}</td>
      <td className="py-1.5 px-3 text-center text-gray-400 text-xs">{label}</td>
      <td className="py-1.5 px-2 text-left font-bold text-white">{opp}</td>
    </tr>
  );
}

function getWinMessage(isMe: boolean, winReason: string | null, opponentName: string): string {
  switch (winReason) {
    case 'ap':
      return isMe ? 'You reached 15 AP! Well played!' : `${opponentName} reached 15 AP!`;
    case 'deckout':
      return isMe ? 'Opponent decked out!' : 'You ran out of cards!';
    case 'concede':
      return isMe ? 'Your opponent conceded!' : 'You conceded.';
    default:
      return isMe ? 'Well played!' : 'Better luck next game!';
  }
}

const COLOR_DOT: Record<string, string> = {
  red: 'bg-spero-red',
  blue: 'bg-spero-blue',
  green: 'bg-spero-green',
  yellow: 'bg-spero-yellow',
  black: 'bg-spero-black',
  none: 'bg-spero-none',
};

function CardPerformanceTable({ cardStats }: { cardStats: Record<string, CardStats> }) {
  const sorted = Object.entries(cardStats)
    .sort((a, b) => b[1].timesPlayed - a[1].timesPlayed)
    .slice(0, 8);

  if (sorted.length === 0) return null;

  return (
    <div className="mt-4">
      <h3 className="text-xs text-gray-500 font-bold uppercase mb-2">Top Cards</h3>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-500">
            <th className="text-left pb-1">Card</th>
            <th className="text-center pb-1">Played</th>
            <th className="text-center pb-1">W-L</th>
            <th className="text-center pb-1">Tricks</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(([code, stats]) => {
            const def = getCardDef(code);
            const color = def ? COLOR_DOT[def.color] || 'bg-gray-500' : 'bg-gray-500';
            return (
              <tr key={code} className="border-t border-board-accent">
                <td className="py-1 flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${color} shrink-0`} />
                  <span className="text-white truncate max-w-[120px]">{def?.name ?? code}</span>
                </td>
                <td className="py-1 text-center text-white">{stats.timesPlayed}</td>
                <td className="py-1 text-center text-white">{stats.combatWins}-{stats.combatLosses}</td>
                <td className="py-1 text-center text-white">{stats.trickUses}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function APTimeline({ apTimeline, opponentName }: { apTimeline: [number, number][]; opponentName: string }) {
  if (apTimeline.length === 0) return null;

  const maxAP = 15;
  const barHeight = 60;

  return (
    <div className="mt-4">
      <h3 className="text-xs text-gray-500 font-bold uppercase mb-2">AP Progression</h3>
      <div className="relative flex items-end gap-1 h-[70px] px-1">
        {/* 15 AP win line */}
        <div
          className="absolute left-0 right-0 border-t border-dashed border-gray-600"
          style={{ bottom: `${(15 / maxAP) * barHeight}px` }}
        />
        <span
          className="absolute right-0 text-[9px] text-gray-600"
          style={{ bottom: `${(15 / maxAP) * barHeight}px` }}
        >
          15
        </span>

        {apTimeline.map((ap, i) => (
          <div key={i} className="flex gap-px flex-1 items-end" title={`Turn ${i + 1}: You ${ap[0]} / Opp ${ap[1]}`}>
            <div
              className="flex-1 bg-spero-blue rounded-t-sm min-w-[3px]"
              style={{ height: `${Math.min((ap[0] / maxAP) * barHeight, barHeight)}px` }}
            />
            <div
              className="flex-1 bg-spero-red rounded-t-sm min-w-[3px]"
              style={{ height: `${Math.min((ap[1] / maxAP) * barHeight, barHeight)}px` }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-center gap-4 mt-1 text-[10px] text-gray-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-spero-blue rounded-sm" />You</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-spero-red rounded-sm" />{opponentName}</span>
      </div>
    </div>
  );
}

export function GameOver({ winnerName, isMe, onPlayAgain, onRequestRematch, onDeclineRematch, gameState, rematchState }: GameOverProps) {
  const myStats: PlayerStats = gameState.playerStats[gameState.myPlayerIndex];
  const oppIdx = gameState.myPlayerIndex === 0 ? 1 : 0;
  const oppStats: PlayerStats = gameState.playerStats[oppIdx];
  const winMessage = getWinMessage(isMe, gameState.winReason, gameState.opponent.playerName);

  // For AP timeline, swap columns so index 0 = "You" perspective
  const apTimeline = gameState.apTimeline
    ? gameState.myPlayerIndex === 0
      ? gameState.apTimeline
      : gameState.apTimeline.map(([a, b]) => [b, a] as [number, number])
    : null;

  return (
    <div className={`fixed inset-0 bg-black/70 flex items-center justify-center z-50 ${!isMe ? 'animate-vignette-red' : ''}`}>
      {isMe && <ConfettiCanvas />}
      <div className={`bg-board-surface rounded-2xl p-8 shadow-2xl max-w-md w-full mx-4 text-center animate-bounce-in border border-board-accent max-h-[90vh] overflow-y-auto ${isMe ? 'ring-2 ring-spero-yellow/40' : ''}`}>
        <div className="text-6xl mb-4">{isMe ? '\u{1F3C6}' : '\u{1F480}'}</div>
        <h2 className={`text-3xl font-bold text-white mb-2 ${isMe ? 'animate-victory-title' : ''}`}>
          {isMe ? 'Victory!' : `${winnerName} Wins!`}
        </h2>
        <p className="text-gray-400 mb-4">
          {winMessage}
        </p>

        {/* Stats table */}
        <table className="w-full mb-4 text-sm">
          <thead>
            <tr className="text-gray-500 text-xs">
              <th className="pb-1 text-right pr-2">You</th>
              <th className="pb-1 text-center px-3"></th>
              <th className="pb-1 text-left pl-2">{gameState.opponent.playerName}</th>
            </tr>
          </thead>
          <tbody>
            <StatRow label="AP Earned" my={myStats.apEarned} opp={oppStats.apEarned} />
            <StatRow label="Missions" my={myStats.missionsLaunched} opp={oppStats.missionsLaunched} />
            <StatRow label="Unblocked" my={myStats.missionsUnblocked} opp={oppStats.missionsUnblocked} />
            <StatRow label="Cards Played" my={myStats.cardsPlayed} opp={oppStats.cardsPlayed} />
            <StatRow label="Tricks Used" my={myStats.combatTricksUsed} opp={oppStats.combatTricksUsed} />
            <StatRow label="Damage Dealt" my={myStats.damageDealt} opp={oppStats.damageDealt} />
            <StatRow label="Duels" my={myStats.duelsInitiated} opp={oppStats.duelsInitiated} />
            <StatRow label="Blocks (Att/Succ)" my={myStats.blocksAttempted} opp={oppStats.blocksAttempted} />
            <StatRow label="Blocks Succeeded" my={myStats.blocksSucceeded} opp={oppStats.blocksSucceeded} />
            <StatRow label="Builds Used" my={myStats.buildsUsed} opp={oppStats.buildsUsed} />
            <StatRow label="Face-Down Builds" my={myStats.buildsFaceDown} opp={oppStats.buildsFaceDown} />
            <StatRow label="Actions Played" my={myStats.actionsPlayed} opp={oppStats.actionsPlayed} />
            <StatRow label="Stacks Lost" my={myStats.stacksLost} opp={oppStats.stacksLost} />
            <StatRow label="Missions Blocked" my={myStats.missionsBlocked} opp={oppStats.missionsBlocked} />
          </tbody>
        </table>

        {/* Extra info */}
        <div className="text-xs text-gray-500 mb-4 flex justify-center gap-4">
          <span>Turns: {gameState.turnNumber}</span>
          <span>Deck: {gameState.deckCount} remaining</span>
        </div>

        {/* Card Performance */}
        {gameState.cardStats && <CardPerformanceTable cardStats={gameState.cardStats} />}

        {/* AP Timeline */}
        {apTimeline && <APTimeline apTimeline={apTimeline} opponentName={gameState.opponent.playerName} />}

        <div className="mt-6 space-y-2">
          {rematchState === 'default' && (
            <button
              onClick={onRequestRematch}
              className="w-full bg-spero-green text-white font-bold py-3 px-8 rounded-xl text-lg hover:brightness-110 active:scale-95 transition-all shadow-lg cursor-pointer"
            >
              Rematch
            </button>
          )}
          {rematchState === 'proposed' && (
            <div className="text-gray-400 text-sm py-3">
              Waiting for opponent to accept...
            </div>
          )}
          {rematchState === 'received' && (
            <div className="flex gap-3">
              <button
                onClick={onRequestRematch}
                className="flex-1 bg-spero-green text-white font-bold py-3 rounded-xl hover:brightness-110 active:scale-95 transition-all cursor-pointer"
              >
                Accept Rematch
              </button>
              <button
                onClick={onDeclineRematch}
                className="flex-1 bg-board-accent text-gray-300 font-bold py-3 rounded-xl hover:bg-board-accent/80 active:scale-95 transition-all cursor-pointer"
              >
                Decline
              </button>
            </div>
          )}
          {rematchState === 'declined' && (
            <div className="text-gray-500 text-sm py-3">Rematch declined.</div>
          )}
        </div>
      </div>
    </div>
  );
}
