import type { CardDef, CardInstance, Stack, PlayerZone, GameState } from '../shared/types.js';
import { getCardDef } from './cards.js';

/** Get the CardDef for an instance */
export function defOf(inst: CardInstance): CardDef {
  return getCardDef(inst.cardCode);
}

/** Top face-up character on a stack (for stat calculations) */
export function topCharacter(stack: Stack): CardInstance | null {
  for (let i = stack.cards.length - 1; i >= 0; i--) {
    const c = stack.cards[i];
    if (!c.faceUp) continue;
    const def = defOf(c);
    if (def.typeA === 'CHARACTER') return c;
  }
  return null;
}

/** Calculate the total Power of a stack (all face-up characters + equipment + optional bonus) */
export function stackPower(stack: Stack, extraBonus?: number): number {
  let total = 0;
  for (const c of stack.cards) {
    if (!c.faceUp) continue;
    const def = defOf(c);
    if (def.typeA === 'CHARACTER' || def.typeA === 'EQUIPMENT') {
      total += def.power;
    }
  }
  if (extraBonus) total += extraBonus;
  return total;
}

/** Calculate the total Smarts of a stack */
export function stackSmarts(stack: Stack, extraBonus?: number): number {
  let total = 0;
  for (const c of stack.cards) {
    if (!c.faceUp) continue;
    const def = defOf(c);
    if (def.typeA === 'CHARACTER' || def.typeA === 'EQUIPMENT') {
      total += def.smarts;
    }
  }
  if (extraBonus) total += extraBonus;
  return total;
}

/** Stack size = total number of cards (face-up and face-down) */
export function stackSize(stack: Stack): number {
  return stack.cards.length;
}

/** Color of a stack = color of bottom character (base) */
export function stackColor(stack: Stack): string {
  for (const c of stack.cards) {
    const def = defOf(c);
    if (def.typeA === 'CHARACTER') return def.color;
  }
  return 'none';
}

/** Can a card be played onto a target stack? */
export function canBuildOnStack(
  cardDef: CardDef,
  targetStack: Stack | null,
  _player: PlayerZone
): { ok: boolean; reason?: string } {
  // Starting a new stack
  if (!targetStack) {
    if (cardDef.typeA === 'CHARACTER') {
      if (cardDef.cost === 0) return { ok: true };
      return { ok: false, reason: 'Only 0-cost characters can start a new stack' };
    }
    return { ok: false, reason: 'Only characters can start a new stack' };
  }

  // Playing on existing stack
  const size = stackSize(targetStack);

  // Cost check: stack must be large enough
  if (size < cardDef.cost) {
    return { ok: false, reason: `Stack size ${size} < card cost ${cardDef.cost}` };
  }

  // No duplicate names in same stack
  for (const c of targetStack.cards) {
    if (c.faceUp && defOf(c).name === cardDef.name) {
      return { ok: false, reason: 'Duplicate card name in stack' };
    }
  }

  if (cardDef.typeA === 'CHARACTER') {
    // Companion check: must belong to same stack group
    const baseGroup = getStackGroup(targetStack);
    if (baseGroup && cardDef.stackGroup && cardDef.stackGroup !== baseGroup) {
      return { ok: false, reason: 'Character does not belong to this stack group' };
    }
    return { ok: true };
  }

  if (cardDef.typeA === 'EQUIPMENT') {
    // Must have a character in the stack
    if (!topCharacter(targetStack)) {
      return { ok: false, reason: 'No character in stack for equipment' };
    }
    // Color match (colorless always matches)
    if (cardDef.color !== 'none') {
      const sColor = stackColor(targetStack);
      if (sColor !== 'none' && sColor !== cardDef.color) {
        return { ok: false, reason: `Equipment color ${cardDef.color} doesn't match stack color ${sColor}` };
      }
    }
    return { ok: true };
  }

  return { ok: false, reason: 'Cannot build this card type onto a stack' };
}

/** Get the stack group of a stack (from its characters) */
export function getStackGroup(stack: Stack): string {
  for (const c of stack.cards) {
    if (!c.faceUp) continue;
    const def = defOf(c);
    if (def.typeA === 'CHARACTER' && def.stackGroup) {
      return def.stackGroup;
    }
  }
  return '';
}

/** Can a stack perform a power mission? */
export function canPowerMission(stack: Stack): boolean {
  if (stack.tapped) return false;
  if (!topCharacter(stack)) return false;
  return stackPower(stack) > 0;
}

/** Can a stack perform a smarts mission? */
export function canSmartsMission(stack: Stack): boolean {
  if (stack.tapped) return false;
  if (!topCharacter(stack)) return false;
  return stackSmarts(stack) > 0;
}

/** Can an opponent stack block a mission? */
export function canBlock(
  defenderStack: Stack,
  missionType: 'POWER' | 'SMARTS',
  attackerStatValue: number
): boolean {
  if (defenderStack.tapped) return false;
  if (!topCharacter(defenderStack)) return false;
  const defStat = missionType === 'POWER' ? stackPower(defenderStack) : stackSmarts(defenderStack);
  return defStat >= Math.ceil(attackerStatValue / 2);
}

/** Can a card be played as an action from hand? */
export function canPlayAction(
  cardDef: CardDef,
  actingStack: Stack
): { ok: boolean; reason?: string } {
  if (cardDef.typeA !== 'ACTION') {
    return { ok: false, reason: 'Not an action card' };
  }
  if (actingStack.tapped) {
    return { ok: false, reason: 'Stack is tapped' };
  }
  if (!topCharacter(actingStack)) {
    return { ok: false, reason: 'No character in stack' };
  }
  if (stackSize(actingStack) < cardDef.cost) {
    return { ok: false, reason: `Stack size ${stackSize(actingStack)} < action cost ${cardDef.cost}` };
  }
  // Color match
  if (cardDef.color !== 'none') {
    const sColor = stackColor(actingStack);
    if (sColor !== 'none' && sColor !== cardDef.color) {
      return { ok: false, reason: 'Action color doesn\'t match stack color' };
    }
  }
  return { ok: true };
}

/** Can a card be played as a combat trick? */
export function canPlayCombatTrick(
  cardDef: CardDef,
  _stack: Stack
): boolean {
  return cardDef.typeA === 'COMBAT TRICK';
}

/** Parse keywords from rules text */
export function parseKeywords(rulesText: string): {
  vicious: number;
  powerStrategy: number;
  smartsStrategy: number;
} {
  let vicious = 0;
  let powerStrategy = 0;
  let smartsStrategy = 0;

  const viciousMatch = rulesText.match(/Vicious[:\s]*\+?(\d+)/i);
  if (viciousMatch) vicious = parseInt(viciousMatch[1]);

  const psMatch = rulesText.match(/Power Strategy[:\s]*\+?(\d+)/i);
  if (psMatch) powerStrategy = parseInt(psMatch[1]);

  const ssMatch = rulesText.match(/Smarts Strategy[:\s]*\+?(\d+)/i);
  if (ssMatch) smartsStrategy = parseInt(ssMatch[1]);

  return { vicious, powerStrategy, smartsStrategy };
}

/** Get combined keywords for all face-up cards in a stack */
export function getStackKeywords(
  stack: Stack,
  extraKeywords?: { vicious?: number; powerStrategy?: number; smartsStrategy?: number }
) {
  let vicious = 0;
  let powerStrategy = 0;
  let smartsStrategy = 0;

  for (const c of stack.cards) {
    if (!c.faceUp) continue;
    const def = defOf(c);
    const kw = parseKeywords(def.rulesText);
    vicious += kw.vicious;
    powerStrategy += kw.powerStrategy;
    smartsStrategy += kw.smartsStrategy;
  }

  if (extraKeywords) {
    vicious += extraKeywords.vicious ?? 0;
    powerStrategy += extraKeywords.powerStrategy ?? 0;
    smartsStrategy += extraKeywords.smartsStrategy ?? 0;
  }

  return { vicious, powerStrategy, smartsStrategy };
}
