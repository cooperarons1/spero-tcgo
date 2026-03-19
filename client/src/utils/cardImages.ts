/** Get the image path for a card by its cardCode */
export function getCardImagePath(cardCode: string): string {
  return `/cards/${cardCode}.png`;
}

/** Get the frame image path for a card color */
export function getFramePath(color: string): string {
  const map: Record<string, string> = {
    red: '/frames/red.png',
    blue: '/frames/blue.png',
    green: '/frames/green.png',
    yellow: '/frames/yellow.png',
    black: '/frames/none.png', // using colorless frame for black
    none: '/frames/none.png',
  };
  return map[color] || map.none;
}

/** Color class for card borders/accents */
export function getColorClass(color: string): string {
  const map: Record<string, string> = {
    red: 'border-spero-red',
    blue: 'border-spero-blue',
    green: 'border-spero-green',
    yellow: 'border-spero-yellow',
    black: 'border-spero-black',
    none: 'border-spero-none',
  };
  return map[color] || map.none;
}

export function getColorBg(color: string): string {
  const map: Record<string, string> = {
    red: 'bg-spero-red/20',
    blue: 'bg-spero-blue/20',
    green: 'bg-spero-green/20',
    yellow: 'bg-spero-yellow/20',
    black: 'bg-spero-black/20',
    none: 'bg-spero-none/20',
  };
  return map[color] || map.none;
}
