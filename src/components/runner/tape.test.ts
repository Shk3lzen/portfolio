import { newRunner, pressJump, releaseJump, scoreOf, step } from './engine';
import { PRESS, RELEASE, createTapePlayer, dtToUnits, isTape, quantizeDt, replay, seedForDay } from './tape';

// Plays a run the way the game does (rounded frame times, jumps between frames) and records it.
const playAndRecord = (seed: number, frames: number) => {
  const r = newRunner(seed);
  const tape: number[] = [];
  let jumpHeld = false;
  for (let i = 0; i < frames && r.alive; i++) {
    // Jittery frame times, like a real browser.
    const dt = quantizeDt(1 / 60 + Math.sin(i) * 0.004);
    // Jump on a fixed rhythm so the run lasts a while and uses both inputs.
    if (i % 23 === 0 && !jumpHeld) {
      pressJump(r);
      tape.push(PRESS);
      jumpHeld = true;
    } else if (i % 23 === 9 && jumpHeld) {
      releaseJump(r);
      tape.push(RELEASE);
      jumpHeld = false;
    }
    step(r, dt);
    tape.push(dtToUnits(dt));
  }
  return { r, tape };
};

test('replaying a recorded run reproduces its score exactly', () => {
  const seed = seedForDay('2026-10-15');
  const { r, tape } = playAndRecord(seed, 5000);
  const result = replay(seed, tape);
  expect(result.score).toBe(scoreOf(r.distance));
  expect(result.alive).toBe(r.alive);
  expect(result.score).toBeGreaterThan(0);
});

test("a tape does not reproduce its score on another day's course", () => {
  const { r, tape } = playAndRecord(seedForDay('2026-10-15'), 5000);
  const other = replay(seedForDay('2026-10-16'), tape);
  // Same inputs on another course: the claimed score can't be trusted for that day.
  expect(other.score === scoreOf(r.distance) && other.alive === r.alive).toBe(false);
});

test('the tape player keeps a ghost in step with a clock', () => {
  const seed = seedForDay('2026-10-15');
  const { r, tape } = playAndRecord(seed, 5000);
  const ghost = createTapePlayer(seed, tape);
  ghost.advanceTo(1);
  const early = ghost.runner.distance;
  expect(early).toBeGreaterThan(0);
  ghost.advanceTo(10_000);
  expect(ghost.runner.distance).toBe(r.distance);
});

test('only well-formed tapes are accepted', () => {
  expect(isTape([1, 2, PRESS, RELEASE, 167])).toBe(true);
  expect(isTape([])).toBe(false);
  expect(isTape([1.5])).toBe(false);
  expect(isTape([-3])).toBe(false);
  expect(isTape([100000])).toBe(false);
  expect(isTape('1,2,3')).toBe(false);
});
