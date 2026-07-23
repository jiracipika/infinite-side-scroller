export type PauseConfirmationAction = 'restart' | 'quit';

export interface PauseConfirmationCopy {
  title: string;
  description: string;
  confirmLabel: string;
}

const CONFIRMATION_COPY: Record<PauseConfirmationAction, PauseConfirmationCopy> = {
  restart: {
    title: 'Restart this run?',
    description: 'Your current score, coins, and distance for this run will be reset.',
    confirmLabel: 'Restart Run',
  },
  quit: {
    title: 'Return to the main menu?',
    description: 'Your current run will end. Banked progression and completed-run history stay safe.',
    confirmLabel: 'End Run',
  },
};

export function getPauseConfirmationCopy(action: PauseConfirmationAction): PauseConfirmationCopy {
  return CONFIRMATION_COPY[action];
}
