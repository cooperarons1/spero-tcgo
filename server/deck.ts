import type { CardInstance, CardDef } from '../shared/types.js';
import { getAllCardDefs } from './cards.js';

let nextInstanceId = 1;

export function makeInstance(cardCode: string): CardInstance {
  return {
    instanceId: `ci-${nextInstanceId++}`,
    cardCode,
    faceUp: true,
  };
}

export function resetInstanceCounter(): void {
  nextInstanceId = 1;
}

export function createDeck(): CardInstance[] {
  const allDefs = getAllCardDefs();
  return allDefs.map((def: CardDef) => makeInstance(def.cardCode));
}

/** Create two color-themed 60-card starter decks: Red Blaze vs Green Guardian */
export function createTwoDecks(): [CardInstance[], CardInstance[]] {
  const allDefs = getAllCardDefs();

  const red = allDefs.filter(d => d.color === 'red');
  const green = allDefs.filter(d => d.color === 'green');
  const colorless = allDefs.filter(d => d.color === 'none');

  const redNeeds = 60 - red.length;   // 19
  const greenNeeds = 60 - green.length; // 25

  // Split colorless by type for balanced distribution
  const byType = (defs: CardDef[], type: string) => shuffle(defs.filter(d => d.typeA === type));
  const clChars = byType(colorless, 'CHARACTER');
  const clEquip = byType(colorless, 'EQUIPMENT');
  const clActions = byType(colorless, 'ACTION');
  const clTricks = byType(colorless, 'COMBAT TRICK');

  // Split each type proportionally (red ~43%, green ~57%)
  const split = <T>(arr: T[]): [T[], T[]] => {
    const redShare = Math.round(arr.length * (redNeeds / (redNeeds + greenNeeds)));
    return [arr.slice(0, redShare), arr.slice(redShare)];
  };

  const [rc, gc] = split(clChars);
  const [re, ge] = split(clEquip);
  const [ra, ga] = split(clActions);
  const [rt, gt] = split(clTricks);

  let redColorless = [...rc, ...re, ...ra, ...rt];
  let greenColorless = [...gc, ...ge, ...ga, ...gt];

  // Fix rounding: move cards between pools to hit exact counts
  while (redColorless.length < redNeeds && greenColorless.length > greenNeeds) {
    redColorless.push(greenColorless.pop()!);
  }
  while (greenColorless.length < greenNeeds && redColorless.length > redNeeds) {
    greenColorless.push(redColorless.pop()!);
  }

  const deck1Defs = [...red, ...redColorless.slice(0, redNeeds)];
  const deck2Defs = [...green, ...greenColorless.slice(0, greenNeeds)];

  return [
    shuffle(deck1Defs.map(d => makeInstance(d.cardCode))),
    shuffle(deck2Defs.map(d => makeInstance(d.cardCode))),
  ];
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
