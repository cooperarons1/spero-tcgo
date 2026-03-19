import type { ClientCardInstance } from '../../../shared/types';
import { Card } from './Card';

interface SideplayZoneProps {
  cards: ClientCardInstance[];
}

export function SideplayZone({ cards }: SideplayZoneProps) {
  if (cards.length === 0) return null;

  return (
    <div className="bg-board-accent/30 rounded-lg p-2 border border-board-accent">
      <div className="text-[10px] font-bold text-gray-500 mb-1">SIDEPLAY</div>
      <div className="flex gap-1 flex-wrap">
        {cards.map((card) => (
          <Card key={card.instanceId} card={card} size="sm" />
        ))}
      </div>
    </div>
  );
}
