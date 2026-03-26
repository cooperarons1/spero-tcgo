import { useState, useEffect } from 'react';

interface ReconnectionOverlayProps {
  status: 'disconnected' | 'opponent-disconnected';
  onReturnToLobby?: () => void;
}

const RECONNECT_TIMEOUT_MS = 30_000;

export function ReconnectionOverlay({ status, onReturnToLobby }: ReconnectionOverlayProps) {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (status !== 'disconnected') {
      setTimedOut(false);
      return;
    }
    setTimedOut(false);
    const timer = setTimeout(() => setTimedOut(true), RECONNECT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [status]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 shadow-2xl max-w-sm w-full mx-4 text-center">
        {status === 'disconnected' ? (
          timedOut ? (
            <>
              <div className="w-10 h-10 text-red-400 mx-auto mb-4 text-3xl">!</div>
              <h2 className="text-white font-bold text-lg mb-2">Connection Failed</h2>
              <p className="text-gray-400 text-sm mb-4">Unable to reconnect to the server.</p>
              {onReturnToLobby && (
                <button
                  onClick={onReturnToLobby}
                  className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-6 py-2 rounded-lg transition-colors"
                >
                  Return to Lobby
                </button>
              )}
            </>
          ) : (
            <>
              <div className="w-10 h-10 border-4 border-spero-blue border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <h2 className="text-white font-bold text-lg mb-2">Reconnecting...</h2>
              <p className="text-gray-400 text-sm">Lost connection to server. Attempting to reconnect.</p>
            </>
          )
        ) : (
          <>
            <div className="w-10 h-10 border-4 border-spero-yellow border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h2 className="text-white font-bold text-lg mb-2">Opponent Disconnected</h2>
            <p className="text-gray-400 text-sm">Waiting up to 2 minutes for opponent to reconnect...</p>
          </>
        )}
      </div>
    </div>
  );
}
