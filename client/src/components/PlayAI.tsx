import { useState } from 'react';
import { socket } from '../socket';
import { DeckSelector } from './DeckSelector';

interface PlayAIProps {
  uid: string;
  onBack: () => void;
}

export function PlayAI({ uid, onBack }: PlayAIProps) {
  const [selectedDeckCards, setSelectedDeckCards] = useState<string[] | null>(null);
  const [starting, setStarting] = useState(false);

  const handleStart = () => {
    if (!selectedDeckCards || selectedDeckCards.length !== 60) return;
    setStarting(true);
    socket.emit('start-ai-game', { deckCards: selectedDeckCards });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="bg-board-surface rounded-2xl p-8 shadow-xl max-w-md w-full text-center border border-board-accent">
        <h2 className="text-3xl font-extrabold text-white mb-1">Play vs AI</h2>
        <p className="text-gray-400 text-sm mb-6">Practice against a computer opponent</p>

        <div className="mb-6">
          <DeckSelector uid={uid} onSelectDeck={setSelectedDeckCards} />
        </div>

        <button
          onClick={handleStart}
          disabled={!selectedDeckCards || selectedDeckCards.length !== 60 || starting}
          className="w-full bg-spero-green text-white font-bold py-3 px-6 rounded-xl text-lg hover:brightness-110 active:scale-95 transition-all shadow-lg disabled:opacity-50 disabled:scale-100 cursor-pointer disabled:cursor-not-allowed mb-3"
        >
          {starting ? 'Starting...' : 'Start Game'}
        </button>

        <button
          onClick={onBack}
          className="text-gray-400 underline cursor-pointer"
        >
          Back
        </button>
      </div>
    </div>
  );
}
