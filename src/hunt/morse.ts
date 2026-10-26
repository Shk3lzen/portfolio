// Season 2: the tab's icon blinks a word in Morse code. It only starts once season 1 is done,
// so everyday visitors never see a flickering tab. Returns a cleanup function.

import { activeSeason, onFound } from './hunt';

const WORD = 'ROBOT';
const CODE: Record<string, string> = { R: '.-.', O: '---', B: '-...', T: '-' };
const UNIT_MS = 300;

// Lit: the normal icon with its colours swapped.
const LIT_ICON =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32" rx="6" fill="#64ffda"/><text x="16" y="22" font-family="Inter, system-ui, sans-serif" font-size="14" font-weight="600" text-anchor="middle" fill="#0a192f">SB</text></svg>'
  );

// The word as on/off durations in units: dot 1, dash 3, 1 between signals, 3 between
// letters, and a long pause before it repeats.
export const morseTimeline = (word: string): { on: boolean; units: number }[] => {
  const steps: { on: boolean; units: number }[] = [];
  word.split('').forEach((letter, li) => {
    if (li > 0) steps.push({ on: false, units: 3 });
    CODE[letter].split('').forEach((signal, si) => {
      if (si > 0) steps.push({ on: false, units: 1 });
      steps.push({ on: true, units: signal === '.' ? 1 : 3 });
    });
  });
  steps.push({ on: false, units: 10 });
  return steps;
};

export const installMorse = () => {
  const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!icon) return () => {};
  const normal = icon.href;
  const steps = morseTimeline(WORD);
  let timer = 0;
  let running = false;

  const play = (i: number) => {
    const s = steps[i % steps.length];
    icon.href = s.on ? LIT_ICON : normal;
    timer = window.setTimeout(() => play(i + 1), s.units * UNIT_MS);
  };
  const start = () => {
    if (running || activeSeason() !== 2) return;
    running = true;
    play(0);
  };

  start();
  const off = onFound(start);
  return () => {
    off();
    window.clearTimeout(timer);
    icon.href = normal;
  };
};
