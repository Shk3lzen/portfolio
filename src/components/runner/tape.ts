// A run recorded as a "tape" so a score can be checked by replaying it, and replayed as a ghost.
// The engine is deterministic for a given seed, frame times and inputs, so replaying the tape
// through the same code gives exactly the same score — on another device or on the server.
//
// Encoding (compact JSON): each entry is
//   n >= 0  one simulation step of n tenths of a millisecond (frame times are rounded to this
//           before stepping, so the recording is exact);
//   PRESS   jump pressed;
//   RELEASE jump released.

import { Modifier, Runner, newRunner, pressJump, releaseJump, scoreOf, step } from './engine';

export const PRESS = -1;
export const RELEASE = -2;
export const MAX_STEP_UNITS = 334; // the game caps frames at 1/30 s
export const MAX_TAPE_LENGTH = 200_000; // ~30 minutes at 120 fps

const UNITS_PER_SECOND = 10_000;

// Rounds a frame time to the tape's resolution; the game steps with the rounded value.
export const quantizeDt = (dt: number) => Math.round(dt * UNITS_PER_SECOND) / UNITS_PER_SECOND;
export const dtToUnits = (dt: number) => Math.round(dt * UNITS_PER_SECOND);

// One course per UTC day ('YYYY-MM-DD'), shared by every visitor.
export const seedForDay = (day: string) => {
  let hash = 0;
  for (let i = 0; i < day.length; i++) hash = (hash * 31 + day.charCodeAt(i)) | 0;
  return hash >>> 0;
};

export const isTape = (v: unknown): v is number[] =>
  Array.isArray(v) &&
  v.length > 0 &&
  v.length <= MAX_TAPE_LENGTH &&
  v.every((n) => Number.isInteger(n) && n >= RELEASE && n <= MAX_STEP_UNITS);

// Applies one tape entry to a runner and returns the simulated time it took (seconds).
export const applyEntry = (r: Runner, entry: number): number => {
  if (entry === PRESS) pressJump(r);
  else if (entry === RELEASE) releaseJump(r);
  else {
    const dt = entry / UNITS_PER_SECOND;
    step(r, dt);
    return dt;
  }
  return 0;
};

export interface ReplayResult {
  score: number;
  alive: boolean; // a finished run ends with the runner out
  seconds: number;
}

export const replay = (seed: number, tape: number[], mod: Modifier = 'classic'): ReplayResult => {
  const r = newRunner(seed, mod);
  let seconds = 0;
  for (const entry of tape) {
    if (!r.alive) break;
    seconds += applyEntry(r, entry);
  }
  return { score: scoreOf(r.distance), alive: r.alive, seconds };
};

// Plays a tape back in step with a clock, e.g. to draw someone's run as a ghost beside yours.
export const createTapePlayer = (seed: number, tape: number[], mod: Modifier = 'classic') => {
  const runner = newRunner(seed, mod);
  let index = 0;
  let seconds = 0;
  return {
    runner,
    // Advances the ghost until its simulated time catches up with `until` seconds.
    advanceTo(until: number) {
      while (index < tape.length && runner.alive && seconds < until) {
        seconds += applyEntry(runner, tape[index++]);
      }
    },
  };
};
