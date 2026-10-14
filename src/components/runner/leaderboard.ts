// Daily leaderboard for the runner, stored on the public MQTT broker with no account.
// Each device keeps its best score of the day as a *retained* message on its own topic
// (…/scores/<day>/<deviceId>); subscribing to …/scores/<day>/+ returns every stored entry,
// then live updates. If no broker is reachable, it falls back to this device's best only.
// The broker is public, so entries are validated and can't break the page — but someone
// determined could still post a fake score or clear an entry.

import { acquireBroker, releaseBroker, isColor, isId, isName, isNum, todayKey, TOPIC_BASE } from './net';

export interface ScoreEntry {
  deviceId: string;
  name: string;
  color: string;
  score: number;
}

export interface BoardState {
  entries: ScoreEntry[]; // best first, at most TOP_N
  shared: boolean; // false when showing only this device's score (offline fallback)
  mine: number; // this device's best today (0 if none)
}

export interface Leaderboard {
  report(score: number): void;
  setIdentity(name: string, color: string): void;
  close(): void;
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
      onChange({ entries: rank(entries.values()), shared: true, mine: mine?.score ?? 0 });
    } else {
      onChange({ entries: mine ? [mine] : [], shared: false, mine: mine?.score ?? 0 });
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
