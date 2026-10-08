import { profileKey } from './profile';

export type Difficulty = 'easy' | 'medium' | 'hard';

const DIFF_KEY = 'difficulty';
const OLD_EASY_KEY = 'easyMode';

export const AGE_LABELS: Record<Difficulty, string> = {
  easy: 'Ages 2–3',
  medium: 'Ages 3–4',
  hard: 'Ages 4+',
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

export const DIFFICULTY_ORDER: Difficulty[] = ['easy', 'medium', 'hard'];

export function getDifficulty(): Difficulty {
  try {
    const raw = localStorage.getItem(profileKey(DIFF_KEY));
    if (raw === 'easy' || raw === 'medium' || raw === 'hard') return raw;
    // migrate legacy easyMode flag
    const legacy = localStorage.getItem(profileKey(OLD_EASY_KEY));
    if (legacy === '1') return 'easy';
  } catch {}
  return 'medium';
}

export function setDifficulty(d: Difficulty) {
  try {
    localStorage.setItem(profileKey(DIFF_KEY), d);
  } catch {}
}
