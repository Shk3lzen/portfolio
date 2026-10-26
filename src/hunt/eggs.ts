// Site-wide easter eggs for the treasure hunt: a note for whoever opens the console, the
// Konami code (which also flips the page into retro mode) and the blinking Morse favicon.
// Returns a cleanup function.

import { find, fragmentsIn } from './hunt';
import { installMorse } from './morse';

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

const BANNER = String.raw`
  .XX....XX.
  XXXXXXXXXX     Hey, you opened the console.
  XX.XXXX.XX     There are ${fragmentsIn(1).length} fragments hidden on this site.
  XXXXXXXXXX     Type hello() to collect your first one.
  XX.X..X.XX
`;

export const toggleRetro = () => {
  const root = document.documentElement;
  if (root.hasAttribute('data-retro')) root.removeAttribute('data-retro');
  else root.setAttribute('data-retro', '');
};

export const installEggs = () => {
  // eslint-disable-next-line no-console
  console.log(`%c${BANNER}`, 'color:#64ffda;font-family:monospace');
  const w = window as unknown as Record<string, unknown>;
  w.hello = () => {
    const fresh = find('console');
    return fresh
      ? 'Hi! Fragment collected. Keep looking: the rest are on the page, not in here. Progress: /#/vault'
      : 'Hi again. You already have this one.';
  };

  let progress = 0;
  const onKey = (e: KeyboardEvent) => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    progress = key === KONAMI[progress] ? progress + 1 : key === KONAMI[0] ? 1 : 0;
    if (progress < KONAMI.length) return;
    progress = 0;
    toggleRetro();
    find('konami');
  };
  window.addEventListener('keydown', onKey);
  const stopMorse = installMorse();
  return () => {
    stopMorse();
    window.removeEventListener('keydown', onKey);
    delete w.hello;
  };
};
