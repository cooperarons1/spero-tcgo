import cardData from '../../../data/cards.json';

const cardMap = new Map(cardData.map((c: any) => [c.cardCode, c]));

export function getCardDef(cardCode: string) {
  return cardMap.get(cardCode);
}
