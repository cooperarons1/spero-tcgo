const EMOTES = ['GG', 'Nice!', 'Thinking...', 'Wow!', 'Oops', 'GL HF', 'Thanks', 'No way!'] as const;

export type EmoteId = typeof EMOTES[number];

interface EmotePanelProps {
  onEmote: (emote: EmoteId) => void;
  onClose: () => void;
}

export function EmotePanel({ onEmote, onClose }: EmotePanelProps) {
  return (
    <div className="z-30">
      <div className="bg-board-surface border border-board-accent rounded-xl p-2 shadow-xl grid grid-cols-4 gap-1 animate-bounce-in">
        {EMOTES.map(e => (
          <button
            key={e}
            onClick={() => { onEmote(e); onClose(); }}
            className="px-3 py-2 text-sm font-bold text-white bg-board-accent rounded-lg hover:bg-spero-blue/30 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}
