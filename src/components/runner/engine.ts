// Pure game simulation for the runner: no DOM, no drawing. Everything about the course is
// derived from a seed and the distance travelled, so two players racing with the same seed
// see exactly the same obstacles regardless of screen width or frame rate.

export const HEIGHT = 160;
export const GROUND_OFFSET = 26; // distance from canvas bottom to the ground line
export const GROUND_Y = HEIGHT - GROUND_OFFSET;
export const PLAYER_X = 48;
export const PIXEL = 4;
export const PLAYER_W = 10 * PIXEL;
export const PLAYER_H = 7 * PIXEL;

const GRAVITY = 2200; // px/s²
const JUMP_VELOCITY = -560; // full jump apex ≈ 71px
const DOUBLE_JUMP_VELOCITY = -400; // adds ≈ 36px on top of wherever you are
const RELEASE_VELOCITY = -260; // letting go early caps upward speed → short hop (apex ≈ 18px)
const START_SPEED = 260; // px/s
const MAX_SPEED = 640;
const ACCELERATION = 7; // px/s gained per second
const SPAWN_LOOKAHEAD = 1200; // generate obstacles this far ahead (wider than any screen)
const HITBOX_INSET = 4;

export type ObstacleKind = 'post' | 'wide' | 'tall' | 'drone-low' | 'drone-high';

export interface Obstacle {
  kind: ObstacleKind;
  at: number; // course position (distance units) of the obstacle's left edge
  w: number;
  bottom: number; // height above ground
  top: number;
}

export interface Runner {
  y: number; // height of the player's feet above the ground
  vy: number;
  airJumps: number; // double jumps left while airborne
  distance: number;
  alive: boolean;
  obstacles: Obstacle[];
  nextAt: number;
  rng: () => number;
}

// Small, fast, seedable PRNG (mulberry32).
const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Constant acceleration over time, expressed as a function of distance so it is deterministic.
export const speedAt = (distance: number) =>
  Math.min(MAX_SPEED, Math.sqrt(START_SPEED * START_SPEED + 2 * ACCELERATION * distance));

export const scoreOf = (distance: number) => Math.floor(distance / 12);

export const newRunner = (seed: number): Runner => ({
  y: 0,
  vy: 0,
  airJumps: 0,
  distance: 0,
  alive: true,
  obstacles: [],
  nextAt: 520,
  rng: mulberry32(seed),
});

// Harder obstacle types unlock as the score climbs.
const pickObstacle = (rng: () => number, at: number): Obstacle => {
  const score = scoreOf(at);
  const pool: ObstacleKind[] = ['post', 'post'];
  if (score >= 60) pool.push('wide');
  if (score >= 140) pool.push('drone-low');
  if (score >= 220) pool.push('drone-high', 'drone-high');
  if (score >= 300) pool.push('tall');
  const kind = pool[Math.floor(rng() * pool.length)];

  switch (kind) {
    case 'wide':
      return { kind, at, w: 44, bottom: 0, top: 30 };
    case 'tall':
      return { kind, at, w: 18, bottom: 0, top: 58 };
    case 'drone-low':
      // Hovers just off the ground: jump over it.
      return { kind, at, w: 30, bottom: 12, top: 26 };
    case 'drone-high':
      // Hovers at head height: stay down or short-hop — a full jump hits it.
      return { kind, at, w: 30, bottom: 50, top: 62 };
    default:
      return { kind, at, w: 18, bottom: 0, top: [26, 32, 40][Math.floor(rng() * 3)] };
  }
};

// Generates the course ahead of `from` and drops obstacles behind it. `from` is normally the
// runner's own distance, but spectators pass the camera position to keep watching the leader.
export const ensureCourse = (r: Runner, from: number) => {
  while (r.nextAt < from + SPAWN_LOOKAHEAD) {
    const obstacle = pickObstacle(r.rng, r.nextAt);
    r.obstacles.push(obstacle);
    // Gap scales with speed so jumps stay possible as things speed up.
    r.nextAt += obstacle.w + speedAt(r.nextAt) * (0.7 + r.rng() * 0.9);
  }
  r.obstacles = r.obstacles.filter((o) => o.at + o.w > from - PLAYER_X);
};

export const pressJump = (r: Runner) => {
  if (!r.alive) return;
  if (r.y === 0) {
    r.vy = JUMP_VELOCITY;
    r.y = 0.01;
    r.airJumps = 1;
  } else if (r.airJumps > 0) {
    r.vy = DOUBLE_JUMP_VELOCITY;
    r.airJumps -= 1;
  }
};

export const releaseJump = (r: Runner) => {
  if (r.vy < RELEASE_VELOCITY) r.vy = RELEASE_VELOCITY;
};

export const step = (r: Runner, dt: number) => {
  if (!r.alive) return;
  r.distance += speedAt(r.distance) * dt;

  r.vy += GRAVITY * dt;
  r.y = Math.max(0, r.y - r.vy * dt);
  if (r.y === 0) r.vy = 0;

  ensureCourse(r, r.distance);

  const px1 = r.distance + HITBOX_INSET;
  const px2 = r.distance + PLAYER_W - HITBOX_INSET;
  const py1 = r.y + HITBOX_INSET;
  const py2 = r.y + PLAYER_H - HITBOX_INSET;
  for (const o of r.obstacles) {
    if (o.at < px2 && o.at + o.w > px1 && o.bottom < py2 && o.top > py1) {
      r.alive = false;
      break;
    }
  }
};
