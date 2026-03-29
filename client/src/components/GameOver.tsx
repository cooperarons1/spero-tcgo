import { useState, useEffect } from 'react';
import type { ClientGameState, PostGameRewards, RankTier } from '../../../shared/types';
import { getRankTier } from '../../../shared/types';
import { ConfettiCanvas } from './ConfettiCanvas';
import { soundManager } from '../utils/soundManager';

interface GameOverProps {
  winnerName: string;
  isMe: boolean;
  onPlayAgain: () => void;
  gameState: ClientGameState;
  onLeaveGame?: () => void;
  rewards: PostGameRewards | null;
}

const RANK_COLORS: Record<RankTier, string> = {
  BRONZE: 'text-amber-500',
  SILVER: 'text-gray-300',
  GOLD: 'text-yellow-400',
  DIAMOND: 'text-cyan-400',
  LEGEND: 'text-purple-400',
};

const RANK_BG: Record<RankTier, string> = {
  BRONZE: 'bg-amber-900/30 border-amber-600/50',
  SILVER: 'bg-gray-700/30 border-gray-400/50',
  GOLD: 'bg-yellow-900/30 border-yellow-500/50',
  DIAMOND: 'bg-cyan-900/30 border-cyan-400/50',
  LEGEND: 'bg-purple-900/30 border-purple-400/50',
};

const RANK_THRESHOLDS: Record<RankTier, { min: number; max: number }> = {
  BRONZE: { min: 0, max: 1200 },
  SILVER: { min: 1200, max: 1500 },
  GOLD: { min: 1500, max: 1800 },
  DIAMOND: { min: 1800, max: 2100 },
  LEGEND: { min: 2100, max: 3000 },
};

function getWinMessage(isMe: boolean): string {
  return isMe ? 'Well played!' : 'Better luck next game!';
}

function XpBar({ xpGain, newXp, newLevel }: { xpGain: number; newXp: number; newLevel: number }) {
  const xpPerLevel = 100; // XP needed per level
  const xpInLevel = newXp % xpPerLevel;
  const prevXp = Math.max(0, xpInLevel - xpGain);
  const [width, setWidth] = useState(prevXp);

  useEffect(() => {
    const timer = setTimeout(() => setWidth(xpInLevel), 300);
    return () => clearTimeout(timer);
  }, [xpInLevel]);

  const isLevelUp = xpGain > 0 && prevXp > xpInLevel; // wrapped around

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-400 w-8">Lvl {newLevel}</span>
      <div className="flex-1 bg-slate-900 rounded-full h-3 overflow-hidden relative">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-1000 ease-out"
          style={{ width: `${isLevelUp ? 100 : (width / xpPerLevel) * 100}%` }}
        />
      </div>
      <span className="text-xs text-blue-400 font-bold w-16 text-right">+{xpGain} XP</span>
      {isLevelUp && (
        <span className="text-xs font-bold text-yellow-400 animate-pulse">LEVEL UP!</span>
      )}
    </div>
  );
}

function RewardsPanel({ rewards, isMe }: { rewards: PostGameRewards; isMe: boolean }) {
  const [visible, setVisible] = useState(false);
  const prevElo = rewards.newElo - rewards.eloChange;
  const prevTier = getRankTier(prevElo);
  const tierChanged = prevTier !== rewards.rankTier;
  const eloPositive = rewards.eloChange >= 0;

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (visible && tierChanged && rewards.eloChange > 0) {
      soundManager.play('RANK_UP');
    }
  }, [visible, tierChanged, rewards.eloChange]);

  if (!visible) return null;

  const tier = rewards.rankTier;
  const threshold = RANK_THRESHOLDS[tier];
  const eloInTier = rewards.newElo - threshold.min;
  const tierRange = threshold.max - threshold.min;

  return (
    <div className="animate-slide-up mt-4 space-y-3">
      {/* ELO Change */}
      <div className={`rounded-xl p-3 border ${RANK_BG[tier]}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`text-lg font-bold ${RANK_COLORS[tier]}`}>{tier}</span>
            {tierChanged && rewards.eloChange > 0 && (
              <span className="text-xs font-bold text-yellow-400 animate-pulse">RANK UP!</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xl font-bold ${eloPositive ? 'text-green-400' : 'text-red-400'}`}>
              {eloPositive ? '+' : ''}{rewards.eloChange}
            </span>
            <span className="text-xs text-gray-500">{rewards.newElo} ELO</span>
          </div>
        </div>
        {/* Rank progress bar */}
        <div className="mt-2 bg-slate-900 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${
              tier === 'BRONZE' ? 'bg-amber-500' :
              tier === 'SILVER' ? 'bg-gray-300' :
              tier === 'GOLD' ? 'bg-yellow-400' :
              tier === 'DIAMOND' ? 'bg-cyan-400' :
              'bg-purple-400'
            }`}
            style={{ width: `${Math.min(100, (eloInTier / tierRange) * 100)}%` }}
          />
        </div>
        <div className="text-right text-[10px] text-gray-600 mt-0.5">
          {rewards.newElo}/{threshold.max}
        </div>
      </div>

      {/* XP Bar */}
      <XpBar xpGain={rewards.xpGain} newXp={rewards.newXp} newLevel={rewards.newLevel} />

      {/* Gold */}
      {rewards.goldEarned > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-yellow-400">&#x1FA99;</span>
          <span className="text-yellow-400 font-bold">+{rewards.goldEarned} Gold</span>
        </div>
      )}

      {/* Hero Level */}
      {(rewards as any).heroLevel && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-amber-400 font-bold text-xs">Hero Level {(rewards as any).heroLevel}</span>
          <span className="text-gray-500 text-[10px]">+{(rewards as any).heroXPGain} XP</span>
          <span className="text-gray-600 text-[10px]">({(rewards as any).heroWins} wins)</span>
        </div>
      )}

      {/* Achievements Unlocked */}
      {(rewards as any).achievementsUnlocked?.length > 0 && (
        <div className="space-y-1">
          {(rewards as any).achievementsUnlocked.map((a: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-sm bg-amber-900/20 border border-amber-700/30 rounded-lg px-3 py-1.5">
              <span className="text-amber-400">🏆</span>
              <div className="flex-1">
                <span className="text-amber-200 font-bold text-xs">{a.name}</span>
                <span className="text-gray-400 text-[10px] ml-2">{a.description}</span>
              </div>
              <span className="text-yellow-400 font-bold text-[10px]">+{a.reward}</span>
            </div>
          ))}
        </div>
      )}

      {/* Quests Completed */}
      {rewards.questsCompleted.length > 0 && (
        <div className="space-y-1">
          {rewards.questsCompleted.map((q, i) => (
            <div key={i} className="flex items-center gap-2 text-sm bg-green-900/20 border border-green-700/30 rounded-lg px-3 py-1.5">
              <span className="text-green-400">&#10003;</span>
              <span className="text-green-300 flex-1">{q.description}</span>
              <span className="text-yellow-400 font-bold text-xs">+{q.reward}g</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function GameOver({ winnerName, isMe, onPlayAgain, gameState, onLeaveGame, rewards }: GameOverProps) {
  const winMessage = getWinMessage(isMe);

  return (
    <div className={`fixed inset-0 bg-black/70 flex items-center justify-center z-50 ${!isMe ? 'animate-vignette-red' : ''}`}>
      {isMe && <ConfettiCanvas />}
      <div className={`bg-slate-800 rounded-2xl p-8 shadow-2xl max-w-sm w-full mx-4 text-center animate-bounce-in border border-slate-700 ${isMe ? 'ring-2 ring-spero-yellow/40' : ''} max-h-[90vh] overflow-y-auto`}>
        <h2 className={`text-3xl font-bold text-white mb-2 ${isMe ? 'animate-victory-title' : ''}`}>
          {isMe ? 'Victory!' : `${winnerName} Wins!`}
        </h2>
        <p className="text-gray-400 mb-2">
          {winMessage}
        </p>

        {/* Rewards Panel */}
        {rewards && <RewardsPanel rewards={rewards} isMe={isMe} />}

        {/* Game Stats */}
        {gameState.playerStats && (
          <div className="mt-3 bg-slate-700/30 rounded-xl p-3">
            <h4 className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Game Stats</h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div className="flex justify-between"><span className="text-gray-400">Damage to Hero</span><span className="text-white font-bold">{gameState.playerStats[gameState.myPlayerIndex].damageDealtToHeroes}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Minions Killed</span><span className="text-white font-bold">{gameState.playerStats[gameState.myPlayerIndex].minionsKilled}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Minions Played</span><span className="text-white font-bold">{gameState.playerStats[gameState.myPlayerIndex].minionsPlayed}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Spells Cast</span><span className="text-white font-bold">{gameState.playerStats[gameState.myPlayerIndex].spellsCast}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Cards Drawn</span><span className="text-white font-bold">{gameState.playerStats[gameState.myPlayerIndex].cardsDrawn}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Healing Done</span><span className="text-white font-bold">{gameState.playerStats[gameState.myPlayerIndex].healingDone}</span></div>
            </div>
          </div>
        )}

        <div className="space-y-2 mt-4">
          {onLeaveGame && (
            <button
              onClick={onLeaveGame}
              className="w-full bg-slate-700 text-gray-300 font-bold py-3 px-8 rounded-xl text-base hover:bg-slate-700/80 active:scale-95 transition-all cursor-pointer"
            >
              Leave
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
