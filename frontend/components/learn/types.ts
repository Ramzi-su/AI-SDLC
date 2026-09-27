import type { LearnSource } from '@/lib/api';

// Shared settings every learning view needs.
export interface LearnContext {
  source: LearnSource;
  level: string;
  model: string;
  // Called after anything that may change points, so progress displays refresh.
  onProgress: () => void;
}

export const LEVELS = ['Beginner', 'Intermediate', 'Expert'] as const;

/** Maps the project form's coding-level choice to a level the tutor understands. */
export function learnerLevel(codingLevelPref: string): string {
  if (codingLevelPref.startsWith('Beginner')) return 'Beginner';
  if (codingLevelPref.startsWith('Expert')) return 'Expert';
  return 'Intermediate';
}

export const errorMessage = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback;
