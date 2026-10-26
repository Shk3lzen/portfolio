// The treasure hunt: fragments hidden around the site. Finding one stores it on this device
// and tells the rest of the page (the toolbar counter, the toast, the vault page).
//
// Everything here runs in the browser, so anyone who reads the bundle can find every
// fragment without playing. That's fine: reading the source is one of the ways to play.
// Typed answers are stored as SHA-256 hashes, so they at least take some digging to get.
//
// Two seasons: season 2's fragments only count once season 1 is complete, so finishers get
// a second, harder round (and the site keeps a reason to come back).

import { useEffect, useState } from 'react';
import { INVADERS_ENABLED } from '../features';

export type FragmentId =
  | 'console'
  | 'konami'
  | 'bots'
  | 'theme'
  | 'coins'
  | '404'
  | 'sudo'
  | 'vault'
  | 'boss'
  | 'terminal'
  | 'matrix'
  | 'hire'
  | 'morse'
  | 'flip'
  | 'image'
  | 'invaders';

export type Season = 1 | 2;

export interface Fragment {
  id: FragmentId;
  season: Season;
  title: string; // shown once found
  hint: string; // shown on the vault page until found
}

const ALL_FRAGMENTS: Fragment[] = [
  { id: 'console', season: 1, title: 'Said hello to the console', hint: 'Developers talk to the console. Say hello back.' },
  { id: 'konami', season: 1, title: 'Entered the Konami code', hint: '↑ ↑ ↓ ↓ … you know the rest.' },
  { id: 'bots', season: 1, title: 'Poked a background invader', hint: "The things in the background don't like being poked. Five times." },
  { id: 'theme', season: 1, title: "Couldn't pick a theme", hint: 'Light or dark? Really, really can’t decide.' },
  { id: 'coins', season: 1, title: 'Grabbed 10 coins in one run', hint: 'Gold floats above danger. Get greedy in a single run.' },
  { id: '404', season: 1, title: 'Ended a run on 404', hint: 'Some scores cannot be found. End a run on one.' },
  { id: 'sudo', season: 1, title: 'Ran a command as root', hint: 'The ⌘K palette obeys admins.' },
  { id: 'vault', season: 1, title: 'Cracked the secret word', hint: 'Robots have rules. Read them.' },
  { id: 'boss', season: 2, title: 'Beat the boss', hint: 'Something big waits past 1500. Outlast it.' },
  { id: 'terminal', season: 2, title: 'Read a hidden file', hint: "There's a shell in the ⌘K palette. Some files don't show up in a plain ls." },
  { id: 'matrix', season: 2, title: 'Followed the white rabbit', hint: 'A hidden file points to a hidden page.' },
  { id: 'hire', season: 2, title: 'Typed the magic word', hint: 'No input needed: just type what a recruiter would want to do.' },
  { id: 'morse', season: 2, title: 'Decoded the blinking tab', hint: "Watch this tab's icon for a while. It's spelling something." },
  { id: 'flip', season: 2, title: 'Flipped a project card', hint: 'Projects have a back side. Hold Shift and click one.' },
  { id: 'invaders', season: 2, title: 'Reached wave 5 in Invaders', hint: 'There are two games here. In the other one, reach the fifth wave.' },
  { id: 'image', season: 2, title: 'Zoomed into the preview', hint: 'The picture shown when this site is shared keeps a secret in a corner.' },
];

// The invaders fragment only exists while that game is switched on.
export const FRAGMENTS = ALL_FRAGMENTS.filter((f) => INVADERS_ENABLED || f.id !== 'invaders');

export const fragmentsIn = (season: Season) => FRAGMENTS.filter((f) => f.season === season);

export const COINS_FOR_FRAGMENT = 10;

const FOUND_KEY = 'hunt-found';
const FOUND_EVENT = 'hunt:found';
const VALID = new Set<string>(FRAGMENTS.map((f) => f.id));

export const readFound = (): FragmentId[] => {
  try {
    const saved = JSON.parse(localStorage.getItem(FOUND_KEY) ?? '[]');
    return Array.isArray(saved) ? (saved.filter((id) => VALID.has(id)) as FragmentId[]) : [];
  } catch {
    return [];
  }
};

export const isComplete = (found = readFound(), season: Season = 1) =>
  fragmentsIn(season).every((f) => found.includes(f.id));

const seasonOf = (id: FragmentId) => FRAGMENTS.find((f) => f.id === id)?.season ?? 1;

// The season someone is playing: 2 once they've finished season 1.
export const activeSeason = (found = readFound()): Season => (isComplete(found, 1) ? 2 : 1);

// Records a fragment; returns true the first time it's found. Season 2 fragments only count
// after season 1 is done.
export const find = (id: FragmentId): boolean => {
  const found = readFound();
  if (found.includes(id)) return false;
  if (seasonOf(id) === 2 && !isComplete(found, 1)) return false;
  const next = [...found, id];
  try {
    localStorage.setItem(FOUND_KEY, JSON.stringify(next));
  } catch {
    /* private mode: it still counts for this visit */
  }
  window.dispatchEvent(new CustomEvent(FOUND_EVENT, { detail: { id, found: next } }));
  return true;
};

// The found list, kept current as fragments turn up (in this tab or another).
export const useFound = () => {
  const [found, setFound] = useState(readFound);
  useEffect(() => {
    const update = () => setFound(readFound());
    const onStorage = (e: StorageEvent) => e.key === FOUND_KEY && update();
    window.addEventListener(FOUND_EVENT, update);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(FOUND_EVENT, update);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  return found;
};

// Listens for new finds, e.g. to show a toast.
export const onFound = (handler: (id: FragmentId, found: FragmentId[]) => void) => {
  const listener = (e: Event) => {
    const { id, found } = (e as CustomEvent).detail;
    handler(id, found);
  };
  window.addEventListener(FOUND_EVENT, listener);
  return () => window.removeEventListener(FOUND_EVENT, listener);
};

const sha256 = async (text: string) => {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
};

// sha256 of each secret word (lowercase letters and digits only), and the fragment it opens:
//   vault  base64 in a <meta> tag on the main page; /secret-vault/ points there
//   morse  blinked by the favicon (see hunt/morse.ts)
//   image  faint text in a corner of og-image.jpg
const ANSWERS: [string, FragmentId][] = [
  ['6e22b891a1306b78b27575958785e94aadb8aa1682d5e5020c1162a683e48066', 'vault'],
  ['18d63be10ad544a04a22c944dee01d6d864ec69b797a58edae92e6a44ad8fdbf', 'morse'],
  ['81142b243eba0196576e505f9d69060c1242aaa29caaf80613793bdc8f80268d', 'image'],
];

export const normalizeAnswer = (raw: string) => raw.toLowerCase().replace(/[^a-z0-9]/g, '');

// The fragment a typed word opens, if any.
export const checkWord = async (raw: string): Promise<FragmentId | null> => {
  const word = normalizeAnswer(raw);
  if (!word || !crypto?.subtle) return null;
  const hash = await sha256(word);
  return ANSWERS.find(([h]) => h === hash)?.[1] ?? null;
};

// The code finishers send to claim a prize: stable per device, so it can't be shared around
// as easily (it's still computed in the browser, so treat it as an honour system).
export const claimCode = async (deviceId: string, season: Season = 1) => {
  const hash = await sha256(`shkelzzen-hunt${season === 2 ? '-s2' : ''}:${deviceId}`);
  return `SHK${season === 2 ? '2' : ''}-${hash.slice(0, 4)}-${hash.slice(4, 8)}`.toUpperCase();
};
