import { useState, useEffect } from 'react';
import { getHistory, type MatchRecord } from '../utils/matchHistory';

interface MatchHistoryProps {
  uid: string;
  onBack: () => void;
}

function MatchRow({ match }: { match: MatchRecord }) {
  const [expanded, setExpanded] = useState(false);
  const date = new Date(match.date);
  const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;

  return (
    <div
      className={`border rounded-xl p-3 cursor-pointer transition-all ${
        match.isWin ? 'border-spero-green/40 bg-spero-green/5' : 'border-spero-red/40 bg-spero-red/5'
      }`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${match.isWin ? 'bg-spero-green text-white' : 'bg-spero-red text-white'}`}>
            {match.isWin ? 'W' : 'L'}
          </span>
          <span className="text-sm text-white font-medium">vs {match.opponentName}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>{match.myAP}-{match.opponentAP} AP</span>
          <span>{dateStr}</span>
        </div>
      </div>
      {expanded && (
        <div className="mt-2 pt-2 border-t border-slate-700 grid grid-cols-3 gap-2 text-xs text-gray-400">
          <span>Turns: {match.turns}</span>
          <span>Missions: {match.myMissions} vs {match.opponentMissions}</span>
          <span>Damage: {match.myDamage} vs {match.opponentDamage}</span>
          <span className="col-span-3 text-gray-600">
            {match.winReason === 'ap' ? 'Won by AP' : match.winReason === 'deckout' ? 'Deck out' : match.winReason === 'concede' ? 'Concession' : ''}
          </span>
        </div>
      )}
    </div>
  );
}

export function MatchHistory({ uid, onBack }: MatchHistoryProps) {
  const [history, setHistory] = useState<MatchRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getHistory(uid).then(h => { setHistory(h); setLoading(false); });
  }, [uid]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="bg-slate-800 rounded-2xl p-6 shadow-xl max-w-lg w-full border border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Match History</h2>
          <button onClick={onBack} className="text-gray-400 hover:text-white text-sm underline cursor-pointer">Back</button>
        </div>

        {loading ? (
          <p className="text-gray-500 text-center py-8">Loading...</p>
        ) : history.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No matches played yet.</p>
        ) : (
          <>
            <div className="text-xs text-gray-500 mb-3">
              <span>{history.filter(m => m.isWin).length}W - {history.filter(m => !m.isWin).length}L</span>
            </div>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {history.map(m => <MatchRow key={m.id} match={m} />)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
