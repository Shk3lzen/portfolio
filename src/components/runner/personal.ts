// Things the runner remembers about you on this device only: your best run of the day (its
// tape, replayed as a ghost on your next solo run) and how many days in a row you've played.

import { isTape } from './tape';

const BEST_RUN_KEY = 'runner-best-run';
const STREAK_KEY = 'runner-streak';

export interface BestRun {
  day: string;
  score: number;
  tape: number[];
}

export const loadBestRun = (day: string): BestRun | null => {
  try {
    const v = JSON.parse(localStorage.getItem(BEST_RUN_KEY) ?? 'null');
    if (v && v.day === day && Number.isFinite(v.score) && isTape(v.tape)) return v;
  } catch {
    /* ignore */
  }
  return null;
};

// Keeps the tape only when it beats today's best (yesterday's is replaced on the first run).
export const saveBestRun = (day: string, score: number, tape: number[]) => {
  const best = loadBestRun(day);
  if (best && best.score >= score) return;
  try {
    localStorage.setItem(BEST_RUN_KEY, JSON.stringify({ day, score, tape }));
  } catch {
    /* quota or private mode: no ghost, no harm */
  }
};

export interface Streak {
  count: number; // consecutive UTC days with at least one run
  last: string; // the last day played
}

const previousDay = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

export const loadStreak = (): Streak => {
  try {
    const v = JSON.parse(localStorage.getItem(STREAK_KEY) ?? 'null');
    if (v && Number.isInteger(v.count) && v.count > 0 && typeof v.last === 'string') return v;
  } catch {
    /* ignore */
  }
  return { count: 0, last: '' };
};

// A streak only counts while it's alive: last played today or yesterday.
export const currentStreak = (s: Streak, today: string) => (s.last === today || s.last === previousDay(today) ? s.count : 0);

export const recordPlay = (day: string): Streak => {
  const s = loadStreak();
  if (s.last === day) return s;
  const next = { count: s.last === previousDay(day) ? s.count + 1 : 1, last: day };
  try {
    localStorage.setItem(STREAK_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
};
