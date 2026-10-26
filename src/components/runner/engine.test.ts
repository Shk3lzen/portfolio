import {
  BOSS_FROM,
  BOSS_TO,
  MAGNET_LENGTH,
  Obstacle,
  Runner,
  ensureCourse,
  modifierForDay,
  newRunner,
  pressJump,
  releaseJump,
  scoreOf,
  step,
} from './engine';

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
  expect(kinds).toEqual(new Set(['post', 'wide', 'tall', 'drone-low', 'drone-high', 'pit', 'bomb']));
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

const pit = { kind: 'pit' as const, w: 72, bottom: -26, top: 0 };

test('running onto a pit is a fall, jumping over it is not', () => {
  const ground = withOnly(pit);
  run(ground, 2);
  expect(ground.alive).toBe(false);

  const jumper = withOnly(pit);
  let jumped = false;
  run(jumper, 2, () => {
    if (!jumped && jumper.distance > 150) {
      pressJump(jumper);
      jumped = true;
    }
  });
  expect(jumper.alive).toBe(true);
});

test('coins are part of the seeded course and get collected on contact', () => {
  const a = newRunner(42);
  const b = newRunner(42);
  ensureCourse(a, 0);
  ensureCourse(b, 0);
  expect(a.coins).toEqual(b.coins);

  const r = newRunner(1);
  r.nextAt = Infinity;
  r.coins = [{ at: 200, h: 14, taken: false }];
  run(r, 1);
  expect(r.collected).toBe(1);
});


test('each weekday has its modifier', () => {
  expect(modifierForDay('2026-10-25')).toBe('classic'); // Sunday
  expect(modifierForDay('2026-10-26')).toBe('low-gravity');
  expect(modifierForDay('2026-10-27')).toBe('mirror');
  expect(modifierForDay('2026-10-28')).toBe('tiny');
  expect(modifierForDay('2026-10-29')).toBe('gold-rush');
  expect(modifierForDay('2026-10-30')).toBe('turbo');
  expect(modifierForDay('2026-10-31')).toBe('fog');
});

const apex = (r: Runner) => {
  pressJump(r);
  let top = 0;
  run(r, 1, () => (top = Math.max(top, r.y)));
  return top;
};

test('low gravity jumps higher, a tiny bot is smaller, turbo starts faster', () => {
  expect(apex(newRunner(1, 'low-gravity'))).toBeGreaterThan(apex(newRunner(1, 'classic')) + 10);
  expect(newRunner(1, 'tiny').w).toBeLessThan(newRunner(1).w);
  const turbo = newRunner(1, 'turbo');
  const classic = newRunner(1);
  step(turbo, 0.1);
  step(classic, 0.1);
  expect(turbo.distance).toBeGreaterThan(classic.distance);
});

test('gold rush puts out more coins on the same course', () => {
  const count = (mod: 'classic' | 'gold-rush') => {
    const r = newRunner(5, mod);
    let n = 0;
    for (let d = 0; d < 20000; d += 1000) {
      ensureCourse(r, d);
      n = r.coins.length + n;
    }
    return n;
  };
  expect(count('gold-rush')).toBeGreaterThan(count('classic'));
});

test('a shield takes one hit, then you are back to normal', () => {
  const r = withOnly({ kind: 'post', w: 18, bottom: 0, top: 40 });
  r.shield = true;
  r.obstacles.push({ kind: 'post', at: 600, w: 18, bottom: 0, top: 40 });
  run(r, 1);
  expect(r.alive).toBe(true);
  expect(r.shield).toBe(false);
  run(r, 2);
  expect(r.alive).toBe(false);
});

test('a shield bounces you out of a pit', () => {
  const r = withOnly(pit);
  r.shield = true;
  run(r, 2);
  expect(r.alive).toBe(true);
});

test('a magnet pulls in coins you would have missed', () => {
  const plain = newRunner(1);
  plain.nextAt = Infinity;
  plain.coins = [{ at: 200, h: 80, taken: false }];
  run(plain, 1);
  expect(plain.collected).toBe(0);

  const magnet = newRunner(1);
  magnet.nextAt = Infinity;
  magnet.magnetUntil = MAGNET_LENGTH;
  magnet.coins = [{ at: 200, h: 80, taken: false }];
  run(magnet, 1);
  expect(magnet.collected).toBe(1);
});

test('slow-mo slows you down while it lasts', () => {
  const slow = newRunner(1);
  slow.nextAt = Infinity;
  slow.slowUntil = 10_000;
  const normal = newRunner(1);
  normal.nextAt = Infinity;
  run(slow, 0.5);
  run(normal, 0.5);
  expect(slow.distance).toBeLessThan(normal.distance * 0.75);
});

test('the boss stretch is all bombs, and passing it beats the boss', () => {
  const r = newRunner(3);
  ensureCourse(r, BOSS_FROM * 12 + 100);
  const inBoss = r.obstacles.filter((o) => scoreOf(o.at) >= BOSS_FROM && scoreOf(o.at) < BOSS_TO);
  expect(inBoss.length).toBeGreaterThan(0);
  expect(inBoss.every((o) => o.kind === 'bomb')).toBe(true);

  const runner = newRunner(3);
  runner.nextAt = Infinity;
  runner.distance = BOSS_TO * 12 - 5;
  step(runner, 0.05);
  expect(runner.bossBeaten).toBe(true);
});
