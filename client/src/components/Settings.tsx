import { useState, useRef, useEffect } from 'react';
import { soundManager } from '../utils/soundManager';

interface SettingsProps {
  onConcede: () => void;
  onClose: () => void;
}

export function Settings({ onConcede, onClose }: SettingsProps) {
  const [confirming, setConfirming] = useState(false);
  const [volume, setVolume] = useState(soundManager.volume);
  const [muted, setMuted] = useState(soundManager.muted);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleVolumeChange = (v: number) => {
    setVolume(v);
    soundManager.volume = v;
  };

  const handleMuteToggle = () => {
    const next = !muted;
    setMuted(next);
    soundManager.muted = next;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40">
      <div
        ref={panelRef}
        className="bg-slate-800 rounded-2xl p-6 shadow-2xl max-w-sm w-full mx-4 border border-slate-700 animate-bounce-in"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none cursor-pointer"
          >
            ×
          </button>
        </div>

        {/* Sound settings */}
        <div className="mb-6 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-300">Sound Effects</span>
            <button
              onClick={handleMuteToggle}
              className={`px-3 py-1 text-xs font-bold rounded-full cursor-pointer transition-all ${
                muted ? 'bg-gray-600 text-gray-400' : 'bg-spero-green text-white'
              }`}
            >
              {muted ? 'Muted' : 'On'}
            </button>
          </div>
          <div className={`flex items-center gap-3 ${muted ? 'opacity-40' : ''}`}>
            <span className="text-xs text-gray-500">Volume</span>
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(volume * 100)}
              onChange={e => handleVolumeChange(Number(e.target.value) / 100)}
              className="flex-1 accent-spero-yellow"
              disabled={muted}
            />
            <span className="text-xs text-gray-500 w-8 text-right">{Math.round(volume * 100)}%</span>
          </div>
        </div>

        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="w-full bg-red-600 text-white font-bold py-3 px-6 rounded-xl hover:bg-red-500 active:scale-95 transition-all cursor-pointer"
          >
            Concede Game
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-300 text-center">
              Are you sure? This gives your opponent the win.
            </p>
            <div className="flex gap-3">
              <button
                onClick={onConcede}
                className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-500 active:scale-95 transition-all cursor-pointer"
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="flex-1 bg-slate-700 text-gray-300 font-bold py-3 rounded-xl hover:bg-slate-700/80 active:scale-95 transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
