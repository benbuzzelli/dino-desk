import { getDifficulty, setDifficulty } from './difficulty';

export function isEasyMode(): boolean {
  return getDifficulty() === 'easy';
}

export function toggleEasyMode(): boolean {
  const current = getDifficulty();
  const next = current === 'easy' ? 'medium' : 'easy';
  setDifficulty(next);
  return next === 'easy';
}
