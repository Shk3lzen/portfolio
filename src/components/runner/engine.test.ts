import { Obstacle, Runner, ensureCourse, newRunner, pressJump, releaseJump, step } from './engine';

const DT = 1 / 120;

const run = (r: Runner, seconds: number, onTick?: (t: number) => void) => {
  for (let t = 0; t < seconds; t += DT) {
    onTick?.(t);
    step(r, DT);
  }
};

// A runner whose course is replaced by a single obstacle 200px ahead.
const withOnly = (obstacle: Omit<Obstacle, 'at'>) => {
  const r = newRunner(1);
  r.nextAt = Infinity; // no random obstacles
  r.obstacles = [{ ...obstacle, at: 200 }];
  return r;
};
const highDrone = { kind: 'drone-high' as const, w: 30, bottom: 50, top: 62 };

test('the same seed always produces the same course', () => {
  const a = newRunner(42);
  const b = newRunner(42);
  ensureCourse(a, 0);
  ensureCourse(b, 0);
  expect(a.obstacles).toEqual(b.obstacles);
  expect(a.obstacles.length).toBeGreaterThan(0);
});

test('harder obstacles unlock further along the course', () => {
  const r = newRunner(7);
  const kinds = new Set<string>();
  for (let d = 0; d < 20000; d += 500) {
    ensureCourse(r, d);
    r.obstacles.forEach((o) => kinds.add(o.kind));
  }
  expect(kinds).toEqual(new Set(['post', 'wide', 'tall', 'drone-low', 'drone-high']));
});

test('staying on the ground passes under a high drone', () => {
  const r = withOnly(highDrone);
  run(r, 2);
  expect(r.alive).toBe(true);
});

test('a full jump into a high drone is a crash, a short hop is not', () => {
  // Jump timed to be at the apex while passing under the drone.
  const timed = withOnly(highDrone);
  let jumped = false;
  run(timed, 2, () => {
    if (!jumped && timed.distance > 120) {
      pressJump(timed);
      jumped = true;
    }
  });
  expect(timed.alive).toBe(false);

  const hop = withOnly(highDrone);
  let hopped = false;
  run(hop, 2, () => {
    if (!hopped && hop.distance > 160) {
      pressJump(hop);
      releaseJump(hop);
      hopped = true;
    }
  });
  expect(hop.alive).toBe(true);
});

test('double jump only works once per jump', () => {
  const r = withOnly({ kind: 'post', w: 18, bottom: 0, top: 0 });
  pressJump(r);
  step(r, DT);
  const afterFirst = r.airJumps;
  pressJump(r);
  pressJump(r);
  expect(afterFirst).toBe(1);
  expect(r.airJumps).toBe(0);
});
