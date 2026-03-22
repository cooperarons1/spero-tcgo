interface ReconnectionOverlayProps {
  status: 'disconnected' | 'opponent-disconnected';
}

export function ReconnectionOverlay({ status }: ReconnectionOverlayProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-board-surface border border-board-accent rounded-2xl p-8 shadow-2xl max-w-sm w-full mx-4 text-center">
        {status === 'disconnected' ? (
          <>
            <div className="w-10 h-10 border-4 border-spero-blue border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h2 className="text-white font-bold text-lg mb-2">Reconnecting...</h2>
            <p className="text-gray-400 text-sm">Lost connection to server. Attempting to reconnect.</p>
          </>
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
