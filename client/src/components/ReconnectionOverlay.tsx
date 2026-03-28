import { useState, useEffect } from 'react';

interface ReconnectionOverlayProps {
  status: 'disconnected' | 'opponent-disconnected';
  onReturnToLobby?: () => void;
}

const RECONNECT_TIMEOUT_MS = 120_000;

export function ReconnectionOverlay({ status, onReturnToLobby }: ReconnectionOverlayProps) {
  const [timedOut, setTimedOut] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(Math.ceil(RECONNECT_TIMEOUT_MS / 1000));

  useEffect(() => {
    setTimedOut(false);
    setSecondsRemaining(Math.ceil(
      (status === 'disconnected' ? RECONNECT_TIMEOUT_MS : 120_000) / 1000
    ));

    if (status === 'disconnected') {
      const timer = setTimeout(() => setTimedOut(true), RECONNECT_TIMEOUT_MS);
      const interval = setInterval(() => {
        setSecondsRemaining(prev => Math.max(0, prev - 1));
      }, 1000);
      return () => { clearTimeout(timer); clearInterval(interval); };
    }

    // opponent-disconnected: countdown only (no timeout action)
    const interval = setInterval(() => {
      setSecondsRemaining(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
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
              <p className="text-gray-500 text-xs mt-2">{secondsRemaining}s remaining</p>
            </>
          )
        ) : (
          <>
            <div className="w-10 h-10 border-4 border-spero-yellow border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h2 className="text-white font-bold text-lg mb-2">Opponent Disconnected</h2>
            <p className="text-gray-400 text-sm">Waiting for opponent to reconnect... ({secondsRemaining}s)</p>
          </>
        )}
      </div>
    </div>
  );
}
