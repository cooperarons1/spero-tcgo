import type { ClientCardInstance } from '../../../shared/types';
import { Card } from './Card';

interface SideplayZoneProps {
  cards: ClientCardInstance[];
}

export function SideplayZone({ cards }: SideplayZoneProps) {
  if (cards.length === 0) return null;

  return (
    <div className="bg-board-surface rounded-xl p-3 border border-board-accent">
      <div className="text-xs uppercase tracking-wider text-gray-600 mb-1">Sideplay</div>
      <div className="flex flex-col gap-1">
        {cards.map((card) => (
          <Card key={card.instanceId} card={card} size="sm" />
        ))}
      </div>
    </div>
  );
}
