import { useState, useEffect } from 'react';
import { socket } from '../socket';
import { getHistory, type MatchRecord } from '../utils/matchHistory';
import { loadHeroLevels, type HeroLevelsMap } from '../utils/heroLevels';
import type { RankTier } from '../../../shared/types';
import { CARD_BACKS, type CardBackDef } from '../../../shared/seasons';

interface ProfileProps {
  uid: string;
  displayName: string;
  onBack: () => void;
}

const RANK_COLORS: Record<string, string> = {
  BRONZE: 'text-amber-500',
  SILVER: 'text-gray-300',
  GOLD: 'text-yellow-400',
  DIAMOND: 'text-cyan-400',
  LEGEND: 'text-purple-400',
};

const RANK_BG: Record<string, string> = {
  BRONZE: 'bg-amber-900/30 border-amber-600/50',
  SILVER: 'bg-gray-700/30 border-gray-400/50',
  GOLD: 'bg-yellow-900/30 border-yellow-500/50',
  DIAMOND: 'bg-cyan-900/30 border-cyan-400/50',
  LEGEND: 'bg-purple-900/30 border-purple-400/50',
};

const RANK_BAR_COLOR: Record<string, string> = {
  BRONZE: 'bg-amber-500',
  SILVER: 'bg-gray-300',
  GOLD: 'bg-yellow-400',
  DIAMOND: 'bg-cyan-400',
  LEGEND: 'bg-purple-400',
};

const RANK_THRESHOLDS: Record<string, { min: number; max: number }> = {
  BRONZE: { min: 0, max: 1200 },
  SILVER: { min: 1200, max: 1500 },
  GOLD: { min: 1500, max: 1800 },
  DIAMOND: { min: 1800, max: 2100 },
  LEGEND: { min: 2100, max: 3000 },
};

interface RankData {
  elo: number;
  rankTier: RankTier;
  gamesPlayed: number;
  gamesWon: number;
  season?: {
    id: string;
    name: string;
    number: number;
    daysLeft: number;
    peakRankTier: string;
    peakElo: number;
  };
}

interface QuestsData {
  quests: any[];
  gold: number;
  xp: number;
  level: number;
}

type Tab = 'stats' | 'cardbacks';

export function Profile({ uid, displayName, onBack }: ProfileProps) {
  const [rank, setRank] = useState<RankData | null>(null);
  const [quests, setQuests] = useState<QuestsData | null>(null);
  const [history, setHistory] = useState<MatchRecord[]>([]);
  const [heroLevels, setHeroLevels] = useState<HeroLevelsMap>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('stats');

  // Card backs state
  const [ownedCardBacks, setOwnedCardBacks] = useState<string[]>(['default']);
  const [selectedCardBack, setSelectedCardBack] = useState('default');

  useEffect(() => {
    socket.emit('get-rank');
    socket.emit('get-quests');
    socket.emit('get-card-backs');
    loadHeroLevels(uid).then(setHeroLevels);

    const onRank = (data: RankData) => setRank(data);
    const onQuests = (data: QuestsData) => setQuests(data);
    const onCardBacks = (data: { owned: string[]; selected: string }) => {
      setOwnedCardBacks(data.owned);
      setSelectedCardBack(data.selected);
    };
    socket.on('rank-update', onRank);
    socket.on('quests-update', onQuests);
    socket.on('card-backs-update', onCardBacks);

    getHistory(uid).then(h => {
      setHistory(h);
      setLoading(false);
    });

    return () => {
      socket.off('rank-update', onRank);
      socket.off('quests-update', onQuests);
      socket.off('card-backs-update', onCardBacks);
    };
  }, [uid]);

  const gamesPlayed = rank?.gamesPlayed ?? 0;
  const gamesWon = rank?.gamesWon ?? 0;
  const gamesLost = gamesPlayed - gamesWon;
  const winRate = gamesPlayed > 0 ? ((gamesWon / gamesPlayed) * 100).toFixed(1) : '0.0';
  const tier = rank?.rankTier ?? 'BRONZE';
  const elo = rank?.elo ?? 1000;
  const threshold = RANK_THRESHOLDS[tier];
  const eloInTier = elo - threshold.min;
  const tierRange = threshold.max - threshold.min;

  // Calculate current streak from recent match history
  let streak = 0;
  if (history.length > 0) {
    const streakType = history[0].isWin;
    for (const m of history) {
      if (m.isWin === streakType) streak++;
      else break;
    }
    if (!streakType) streak = -streak;
  }

  const handleSelectCardBack = (id: string) => {
    setSelectedCardBack(id);
    socket.emit('select-card-back', { cardBackId: id });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="bg-slate-800 rounded-2xl p-6 shadow-xl max-w-lg w-full border border-slate-700 animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Profile</h2>
          <button onClick={onBack} className="text-gray-400 hover:text-white text-sm underline cursor-pointer">Back</button>
        </div>

        {/* Player Identity */}
        <div className="text-center mb-4">
          <h3 className="text-2xl font-bold text-white mb-1 animate-bounce-in">{displayName}</h3>
          <div className="flex items-center justify-center gap-2">
            <span className={`text-lg font-bold ${RANK_COLORS[tier]}`}>{tier}</span>
            <span className="text-gray-400 text-sm">({elo} ELO)</span>
          </div>
          {quests && <span className="text-xs text-gray-500">Level {quests.level}</span>}
        </div>

        {/* Season Info */}
        {rank?.season && (
          <div className="bg-stone-900/60 border border-amber-700/20 rounded-lg p-3 mb-4 text-center">
            <div className="text-xs text-amber-300/80 font-bold mb-1">{rank.season.name}</div>
            <div className="flex items-center justify-center gap-4 text-[11px]">
              <span className="text-gray-400">{rank.season.daysLeft} days left</span>
              <span className={`font-bold ${RANK_COLORS[rank.season.peakRankTier] ?? 'text-gray-400'}`}>
                Peak: {rank.season.peakRankTier} ({rank.season.peakElo})
              </span>
            </div>
          </div>
        )}

        {/* Tab Buttons */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setTab('stats')}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer ${
              tab === 'stats' ? 'bg-amber-700/80 text-amber-100' : 'bg-slate-700/50 text-gray-400 hover:bg-slate-700'
            }`}
          >
            Stats
          </button>
          <button
            onClick={() => setTab('cardbacks')}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer ${
              tab === 'cardbacks' ? 'bg-amber-700/80 text-amber-100' : 'bg-slate-700/50 text-gray-400 hover:bg-slate-700'
            }`}
          >
            Card Backs
          </button>
        </div>

        {tab === 'stats' && (
          <>
            {/* Rank Progress */}
            <div className={`rounded-xl p-3 border mb-4 ${RANK_BG[tier]}`}>
              <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                <span>{tier}</span>
                <span>{elo}/{threshold.max}</span>
              </div>
              <div className="bg-slate-900 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${RANK_BAR_COLOR[tier]}`}
                  style={{ width: `${Math.min(100, (eloInTier / tierRange) * 100)}%` }}
                />
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <StatCard label="Games Played" value={gamesPlayed} />
              <StatCard label="Win Rate" value={`${winRate}%`} />
              <StatCard label="Wins" value={gamesWon} color="text-green-400" />
              <StatCard label="Losses" value={gamesLost} color="text-red-400" />
              <StatCard
                label="Current Streak"
                value={streak > 0 ? `${streak}W` : streak < 0 ? `${Math.abs(streak)}L` : '-'}
                color={streak > 0 ? 'text-green-400' : streak < 0 ? 'text-red-400' : 'text-gray-400'}
              />
              {quests && <StatCard label="Gold" value={quests.gold} color="text-yellow-400" />}
            </div>

            {/* Hero Levels */}
            <div className="mb-4">
              <h4 className="font-bold text-sm text-gray-300 mb-2">Hero Levels</h4>
              <div className="grid grid-cols-3 gap-2">
                {(['JIMMY','TALA','DEREK','ANDERS','DES','ASTRID','AVA','LUCAS','IZZY'] as const).map(hero => {
                  const hl = heroLevels[hero];
                  const level = hl?.level ?? 1;
                  const wins = hl?.wins ?? 0;
                  const isGolden = wins >= 500;
                  const heroColor: Record<string, string> = {
                    JIMMY: 'border-red-600 bg-red-900/20', TALA: 'border-green-600 bg-green-900/20',
                    DEREK: 'border-yellow-500 bg-yellow-900/20', ANDERS: 'border-blue-500 bg-blue-900/20',
                    DES: 'border-purple-600 bg-purple-900/20', ASTRID: 'border-amber-400 bg-amber-900/20',
                    AVA: 'border-pink-500 bg-pink-900/20', LUCAS: 'border-teal-500 bg-teal-900/20',
                    IZZY: 'border-orange-500 bg-orange-900/20',
                  };
                  const label: Record<string, string> = {
                    JIMMY: 'Jimmy', TALA: 'Tala', DEREK: 'Derek', ANDERS: 'Anders',
                    DES: 'Des', ASTRID: 'Astrid', AVA: 'Ava', LUCAS: 'Lucas', IZZY: 'Izzy',
                  };
                  return (
                    <div key={hero} className={`rounded-lg border p-2 text-center ${heroColor[hero]} ${isGolden ? 'shadow-md shadow-yellow-400/30' : ''}`}>
                      <div className="text-[10px] text-gray-400 font-bold">{label[hero]}</div>
                      <div className={`text-lg font-extrabold ${isGolden ? 'text-yellow-400' : 'text-white'}`}>{level}</div>
                      <div className="text-[9px] text-gray-500">{wins} wins</div>
                      {isGolden && <div className="text-[8px] text-yellow-400 font-bold">GOLDEN</div>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent Matches */}
            <div>
              <h4 className="font-bold text-sm text-gray-300 mb-2">Recent Matches</h4>
              {loading ? (
                <p className="text-gray-500 text-center py-4 text-sm">Loading...</p>
              ) : history.length === 0 ? (
                <p className="text-gray-500 text-center py-4 text-sm">No matches played yet.</p>
              ) : (
                <div className="space-y-1.5 max-h-[30vh] overflow-y-auto">
                  {history.slice(0, 20).map(m => {
                    const date = new Date(m.date);
                    const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
                    return (
                      <div
                        key={m.id}
                        className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                          m.isWin ? 'bg-green-900/15 border border-green-700/20' : 'bg-red-900/15 border border-red-700/20'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${m.isWin ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                            {m.isWin ? 'W' : 'L'}
                          </span>
                          <span className="text-white text-sm">vs {m.opponentName}</span>
                        </div>
                        <span className="text-xs text-gray-500">{dateStr}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {tab === 'cardbacks' && (
          <div>
            <h4 className="font-bold text-sm text-gray-300 mb-3">Select Card Back</h4>
            <div className="grid grid-cols-3 gap-3">
              {CARD_BACKS.map(cb => {
                const owned = ownedCardBacks.includes(cb.id);
                const active = selectedCardBack === cb.id;
                return (
                  <CardBackTile
                    key={cb.id}
                    cardBack={cb}
                    owned={owned}
                    active={active}
                    onSelect={() => owned && handleSelectCardBack(cb.id)}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-slate-700/50 rounded-lg p-3 text-center">
      <div className={`text-xl font-bold ${color ?? 'text-white'}`}>{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}

function CardBackTile({ cardBack, owned, active, onSelect }: { cardBack: CardBackDef; owned: boolean; active: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      disabled={!owned}
      className={`
        relative rounded-xl overflow-hidden border-2 transition-all
        ${active ? 'border-amber-400 shadow-lg shadow-amber-400/30 scale-105' : owned ? 'border-slate-600 hover:border-slate-400 cursor-pointer' : 'border-slate-800 opacity-40 cursor-not-allowed'}
      `}
    >
      <div className="w-full aspect-[7/10] relative">
        {cardBack.style.type === 'image' ? (
          <img src={cardBack.style.value} alt={cardBack.name} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div
            className="absolute inset-0 w-full h-full"
            style={{ background: cardBack.style.value }}
          >
            {/* Decorative center element */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full border-2 border-white/20 bg-white/5" />
            </div>
          </div>
        )}
        {!owned && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="text-gray-400 text-xs">🔒</span>
          </div>
        )}
        {active && (
          <div className="absolute top-1 right-1 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center">
            <span className="text-[8px] text-black font-bold">✓</span>
          </div>
        )}
      </div>
      <div className="bg-slate-900/80 px-1.5 py-1">
        <div className="text-[10px] font-bold text-white truncate">{cardBack.name}</div>
        <div className="text-[8px] text-gray-500 truncate">{cardBack.description}</div>
      </div>
    </button>
  );
}
