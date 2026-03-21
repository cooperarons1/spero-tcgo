import type { ClientGameState } from '../../../shared/types';

export interface HintConfig {
  id: string;
  target: string;
  text: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

export function useOnboardingHints(_gameState: ClientGameState) {
  return { activeHint: null as HintConfig | null, dismissHint: () => {} };
}
