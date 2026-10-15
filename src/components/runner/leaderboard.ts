// Leaderboards for the runner. With the score server configured (REACT_APP_RUNNER_API), scores
// come from it: every run is replayed there before it counts, and there's an all-time board too.
// Otherwise (below), a daily board kept on the public MQTT broker with no account.
//
// Daily leaderboard for the runner, stored on the public MQTT broker with no account.
// Each device keeps its best score of the day as a *retained* message on its own topic
// (…/scores/<day>/<deviceId>); subscribing to …/scores/<day>/+ returns every stored entry,
// then live updates. If no broker is reachable, it falls back to this device's best only.
// The broker is public, so entries are validated and can't break the page — but someone
// determined could still post a fake score or clear an entry.

import { acquireBroker, releaseBroker, isColor, isId, isName, isNum, todayKey, TOPIC_BASE } from './net';
import { BoardScope, fetchBoard } from './api';

export interface ScoreEntry {
  deviceId: string;
  name: string;
  color: string;
  score: number;
}

export interface BoardState {
  entries: ScoreEntry[]; // best first, at most TOP_N
  shared: boolean; // false when showing only this device's score (offline fallback)
  mine: number; // this device's best for the board's scope (0 if none)
  scope: BoardScope;
}

export interface Leaderboard {
  report(score: number): void;
  setIdentity(name: string, color: string): void;
  close(): void;
  // Score-server boards only: reload now (e.g. after submitting a run), or switch boards.
  refresh?(): void;
  setScope?(scope: BoardScope): void;
}

export const TOP_N = 10;
const MAX_SCORE = 99999;
const BEST_KEY = 'runner-best-today';

const scoresTopic = (day: string) => `${TOPIC_BASE}/scores/${day}`;

const readBest = (day: string): number => {
  try {
    const saved = JSON.parse(localStorage.getItem(BEST_KEY) ?? 'null');
    return saved && saved.day === day && isNum(saved.score, MAX_SCORE) ? saved.score : 0;
  } catch {
    return 0;
  }
};

const writeBest = (day: string, score: number) => {
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify({ day, score }));
  } catch {
    /* ignore */
  }
};

export const rank = (entries: Iterable<ScoreEntry>): ScoreEntry[] =>
  Array.from(entries)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, TOP_N);

// Validates a stored entry; returns null for anything malformed (including cleared entries).
export const parseEntry = (deviceId: string, raw: string, day: string): ScoreEntry | null => {
  if (!isId(deviceId) || !raw || raw.length > 300) return null;
  try {
    const v = JSON.parse(raw);
    if (v && v.day === day && isName(v.name) && isColor(v.color) && isNum(v.score, MAX_SCORE) && v.score > 0) {
      return { deviceId, name: v.name, color: v.color, score: Math.floor(v.score) };
    }
  } catch {
    /* ignore junk */
  }
  return null;
};

export const openLeaderboard = (
  me: { deviceId: string; name: string; color: string },
  onChange: (state: BoardState) => void
): Leaderboard => {
  let day = todayKey();
  let identity = { name: me.name, color: me.color };
  const entries = new Map<string, ScoreEntry>();
  let client: Awaited<ReturnType<typeof acquireBroker>> = null;
  let closed = false;

  const myEntry = (): ScoreEntry | null => {
    const score = readBest(day);
    return score > 0 ? { deviceId: me.deviceId, ...identity, score } : null;
  };

  const emit = () => {
    const mine = myEntry();
    if (client) {
      onChange({ entries: rank(entries.values()), shared: true, mine: mine?.score ?? 0, scope: 'today' });
    } else {
      onChange({ entries: mine ? [mine] : [], shared: false, mine: mine?.score ?? 0, scope: 'today' });
    }
  };

  const onMessage = (topic: string, payload: Uint8Array) => {
    const prefix = `${scoresTopic(day)}/`;
    if (!topic.startsWith(prefix)) return;
    const deviceId = topic.slice(prefix.length);
    const entry = parseEntry(deviceId, new TextDecoder().decode(payload), day);
    if (entry) entries.set(deviceId, entry);
    else entries.delete(deviceId);
    emit();
  };

  const publishMine = () => {
    const mine = myEntry();
    if (!mine) return;
    entries.set(me.deviceId, mine);
    client?.publish(
      `${scoresTopic(day)}/${me.deviceId}`,
      JSON.stringify({ day, name: mine.name, color: mine.color, score: mine.score }),
      { qos: 1, retain: true }
    );
  };

  const watch = () => {
    if (!client) return;
    entries.clear();
    client.subscribe(`${scoresTopic(day)}/+`, { qos: 1 });
    // Re-publish our stored best in case the broker lost it.
    publishMine();
  };

  // Midnight UTC: start a fresh board.
  const rollover = () => {
    const today = todayKey();
    if (today === day) return;
    client?.unsubscribe(`${scoresTopic(day)}/+`);
    day = today;
    watch();
    emit();
  };
  const dayTimer = window.setInterval(rollover, 60_000);

  emit();
  acquireBroker().then((c) => {
    if (closed) {
      releaseBroker();
      return;
    }
    client = c;
    if (!client) {
      releaseBroker();
      emit();
      return;
    }
    client.on('message', onMessage);
    watch();
    emit();
  });

  return {
    report(score) {
      rollover();
      const s = Math.min(MAX_SCORE, Math.floor(score));
      if (s <= readBest(day)) return;
      writeBest(day, s);
      publishMine();
      emit();
    },
    setIdentity(name, color) {
      identity = { name, color };
      publishMine();
      emit();
    },
    close() {
      closed = true;
      window.clearInterval(dayTimer);
      if (client) {
        client.off('message', onMessage);
        client.unsubscribe(`${scoresTopic(day)}/+`);
        client = null;
        releaseBroker();
      }
    },
  };
};

const API_POLL_MS = 30_000;

// Board backed by the score server. Runs are submitted with their tape by the game itself
// (see api.submitRun); this only reads, polling now and then and after each submission.
export const openApiLeaderboard = (me: { deviceId: string }, onChange: (state: BoardState) => void): Leaderboard => {
  let scope: BoardScope = 'today';
  let closed = false;
  let request = 0;

  const load = async () => {
    const id = ++request;
    const forScope = scope;
    try {
      const { entries, mine } = await fetchBoard(forScope, me.deviceId);
      if (!closed && id === request) onChange({ entries, shared: true, mine, scope: forScope });
    } catch {
      if (!closed && id === request) onChange({ entries: [], shared: false, mine: readBest(todayKey()), scope: forScope });
    }
  };

  load();
  const timer = window.setInterval(load, API_POLL_MS);

  return {
    report(score) {
      // Kept locally too, so the offline fallback still shows your best.
      const day = todayKey();
      const s = Math.min(MAX_SCORE, Math.floor(score));
      if (s > readBest(day)) writeBest(day, s);
    },
    setIdentity() {
      // Names travel with each submitted run.
    },
    close() {
      closed = true;
      window.clearInterval(timer);
    },
    refresh: load,
    setScope(next) {
      scope = next;
      load();
    },
  };
};
