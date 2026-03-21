import { useEffect, useState } from 'react';

interface EmoteBubbleProps {
  text: string;
  position: 'top' | 'bottom'; // top = opponent, bottom = me
}

export function EmoteBubble({ text, position }: EmoteBubbleProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`absolute ${position === 'top' ? 'top-2' : 'bottom-2'} left-1/2 -translate-x-1/2 z-30
        bg-spero-yellow text-black font-bold text-sm px-4 py-2 rounded-full shadow-lg
        animate-emote-float pointer-events-none`}
    >
      {text}
    </div>
  );
}
