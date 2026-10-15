// Client for the runner's score server (worker/ — a Cloudflare Worker). Set REACT_APP_RUNNER_API
// to its URL at build time to turn it on; without it the game keeps the peer-to-peer daily board
// and shares a plain link to the site.

import { isColor, isName, isNum } from './rules';
import { isTape } from './tape';

export const RUNNER_API = (process.env.REACT_APP_RUNNER_API ?? '').replace(/\/$/, '');
export const apiEnabled = RUNNER_API !== '';

const SITE_URL = 'https://shkelzzen.xyz/';
const MAX_SCORE = 99999;

export type BoardScope = 'today' | 'all';

export interface ApiEntry {
  runId: string;
  deviceId: string;
  name: string;
  color: string;
  score: number;
}

export interface SubmittedRun {
  id: string;
  score: number;
  best: number;
  rank: number;
}

export interface ChallengeRun {
  id: string;
  day: string;
  name: string;
  color: string;
  score: number;
  tape: number[] | null;
}

const getJson = async (path: string, init?: RequestInit) => {
  const res = await fetch(`${RUNNER_API}${path}`, init);
  if (!res.ok) throw new Error(`runner api ${res.status}`);
  return res.json();
};

export const submitRun = async (run: { day: string; deviceId: string; name: string; color: string; tape: number[] }) => {
  const data = await getJson('/runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(run),
  });
  return data as SubmittedRun;
};

export const fetchBoard = async (scope: BoardScope, deviceId: string) => {
  const data = await getJson(`/board?scope=${scope}&device=${encodeURIComponent(deviceId)}`);
  const entries: ApiEntry[] = (Array.isArray(data?.entries) ? data.entries : []).filter(
    (e: any) => e && typeof e.runId === 'string' && isName(e.name) && isColor(e.color) && isNum(e.score, MAX_SCORE)
  );
  return { entries, mine: isNum(data?.mine, MAX_SCORE) ? data.mine : 0 };
};

export const fetchRun = async (id: string): Promise<ChallengeRun | null> => {
  if (!/^[a-z0-9]{10}$/.test(id)) return null;
  const v = await getJson(`/runs/${id}`);
  if (!v || !isName(v.name) || !isColor(v.color) || !isNum(v.score, MAX_SCORE) || typeof v.day !== 'string') return null;
  return { id, day: v.day, name: v.name, color: v.color, score: v.score, tape: isTape(v.tape) ? v.tape : null };
};

// The link people share: the server's share page (with a preview image of this score) when
// there's a recorded run, otherwise the site itself.
export const shareUrlFor = (runId: string | null) => (apiEnabled && runId ? `${RUNNER_API}/s/${runId}` : SITE_URL);

// ?run=<id> from a share link, if present.
export const challengeIdFromUrl = () => {
  try {
    return new URLSearchParams(window.location.search).get('run');
  } catch {
    return null;
  }
};
