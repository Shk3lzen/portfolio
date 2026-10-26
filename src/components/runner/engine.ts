// Pure game simulation for the runner: no DOM, no drawing. Everything about the course is
// derived from a seed and the distance travelled, so two players racing with the same seed
// see exactly the same obstacles regardless of screen width or frame rate.
//
// Each UTC day also has a modifier (low gravity on Mondays, a tiny bot on Wednesdays, …) that
// tweaks the physics for everyone, so it is part of the simulation and of replays too.

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
const TURBO_START_SPEED = 360;
const MAX_SPEED = 640;
const ACCELERATION = 7; // px/s gained per second
const SPAWN_LOOKAHEAD = 1200; // generate obstacles this far ahead (wider than any screen)
const HITBOX_INSET = 4;

export type ObstacleKind = 'post' | 'wide' | 'tall' | 'drone-low' | 'drone-high' | 'pit' | 'bomb';

// ---- daily modifiers --------------------------------------------------------------------

export type Modifier = 'classic' | 'low-gravity' | 'mirror' | 'tiny' | 'gold-rush' | 'turbo' | 'fog';

export const MODIFIER_LABELS: Record<Modifier, string> = {
  classic: 'Classic Sunday',
  'low-gravity': 'Low-gravity Monday',
  mirror: 'Mirror Tuesday',
  tiny: 'Tiny-bot Wednesday',
  'gold-rush': 'Gold-rush Thursday',
  turbo: 'Turbo Friday',
  fog: 'Foggy Saturday',
};

// Indexed by UTC weekday, Sunday first.
const WEEK: Modifier[] = ['classic', 'low-gravity', 'mirror', 'tiny', 'gold-rush', 'turbo', 'fog'];

export const modifierForDay = (day: string): Modifier => {
  const [y, m, d] = day.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, (m || 1) - 1, d || 1)).getUTCDay();
  return WEEK[Number.isNaN(weekday) ? 0 : weekday];
};

// Mirror and fog only change how the course is drawn; the rest change the physics.
interface Physics {
  gravity: number;
  jump: number;
  doubleJump: number;
  release: number;
  startSpeed: number;
  pixel: number;
  coinChance: number;
}

export const physicsFor = (mod: Modifier): Physics => {
  const base: Physics = {
    gravity: GRAVITY,
    jump: JUMP_VELOCITY,
    doubleJump: DOUBLE_JUMP_VELOCITY,
    release: RELEASE_VELOCITY,
    startSpeed: START_SPEED,
    pixel: PIXEL,
    coinChance: 0.35,
  };
  switch (mod) {
    case 'low-gravity':
      // Floatier: higher, longer jumps (apex ≈ 85px, about 40% more air time).
      return { ...base, gravity: GRAVITY * 0.6, jump: JUMP_VELOCITY * 0.85, doubleJump: DOUBLE_JUMP_VELOCITY * 0.85, release: RELEASE_VELOCITY * 0.85 };
    case 'tiny':
      return { ...base, pixel: 3 };
    case 'gold-rush':
      return { ...base, coinChance: 0.75 };
    case 'turbo':
      return { ...base, startSpeed: TURBO_START_SPEED };
    default:
      return base;
  }
};

// ---- power-ups --------------------------------------------------------------------------

export type PowerKind = 'shield' | 'magnet' | 'slow';

// Sits in a gap between obstacles at running or hopping height.
export interface PowerUp {
  kind: PowerKind;
  at: number;
  h: number;
  taken: boolean;
}

export const POWER_SIZE = 14;
const SHIELD_BOUNCE = -620;
export const MAGNET_LENGTH = 2400; // distance units a magnet lasts
export const SLOW_LENGTH = 900;
const MAGNET_REACH = 70;
const SLOW_FACTOR = 0.65;
const POWER_CHANCE = 0.06;
const POWERS_FROM = 150; // score

// ---- boss -------------------------------------------------------------------------------

// Between these scores a big drone takes over the sky and drops bombs instead of the usual course.
export const BOSS_FROM = 1500;
export const BOSS_TO = 1620;
// A bomb starts falling this far ahead of the player and lands before it arrives.
export const BOMB_DROP_AHEAD = 260;

export interface Obstacle {
  kind: ObstacleKind;
  at: number; // course position (distance units) of the obstacle's left edge
  w: number;
  bottom: number; // height above ground
  top: number;
}

// A coin floats above an obstacle, often right where a full jump would hit something.
// Coins don't change the score; they're there for the bold (and the treasure hunt).
export interface Coin {
  at: number; // course position of the coin's centre
  h: number; // height of its centre above the ground
  taken: boolean;
}

export const COIN_SIZE = 12;

export interface Runner {
  y: number; // height of the player's feet above the ground
  vy: number;
  airJumps: number; // double jumps left while airborne
  distance: number;
  alive: boolean;
  obstacles: Obstacle[];
  nextAt: number;
  rng: () => number;
  coins: Coin[];
  collected: number; // coins picked up this run
  coinRng: () => number; // separate stream, so coins never change where obstacles go
  mod: Modifier;
  physics: Physics;
  w: number; // hitbox size (a tiny bot is smaller)
  h: number;
  powerUps: PowerUp[];
  powerRng: () => number;
  shield: boolean;
  magnetUntil: number; // distance the magnet wears off at
  slowUntil: number;
  bossBeaten: boolean;
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
export const speedAt = (distance: number, startSpeed = START_SPEED) =>
  Math.min(MAX_SPEED, Math.sqrt(startSpeed * startSpeed + 2 * ACCELERATION * distance));

// The runner's actual speed right now: the course speed, slowed while slow-mo lasts.
export const runnerSpeed = (r: Runner) =>
  speedAt(r.distance, r.physics.startSpeed) * (r.distance < r.slowUntil ? SLOW_FACTOR : 1);

export const scoreOf = (distance: number) => Math.floor(distance / 12);

export const newRunner = (seed: number, mod: Modifier = 'classic'): Runner => {
  const physics = physicsFor(mod);
  return {
    y: 0,
    vy: 0,
    airJumps: 0,
    distance: 0,
    alive: true,
    obstacles: [],
    nextAt: 520,
    rng: mulberry32(seed),
    coins: [],
    collected: 0,
    coinRng: mulberry32(seed ^ 0x5bd1e995),
    mod,
    physics,
    w: 10 * physics.pixel,
    h: 7 * physics.pixel,
    powerUps: [],
    powerRng: mulberry32(seed ^ 0x27d4eb2f),
    shield: false,
    magnetUntil: 0,
    slowUntil: 0,
    bossBeaten: false,
  };
};

// Harder obstacle types unlock as the score climbs.
const pickObstacle = (rng: () => number, at: number): Obstacle => {
  const score = scoreOf(at);
  if (score >= BOSS_FROM && score < BOSS_TO) {
    rng(); // keep the stream in step with a normal pick
    return { kind: 'bomb', at, w: 16, bottom: 0, top: 22 };
  }
  const pool: ObstacleKind[] = ['post', 'post'];
  if (score >= 60) pool.push('wide');
  if (score >= 140) pool.push('drone-low');
  if (score >= 220) pool.push('drone-high', 'drone-high');
  if (score >= 300) pool.push('tall');
  if (score >= 400) pool.push('pit', 'pit');
  const kind = pool[Math.floor(rng() * pool.length)];

  switch (kind) {
    case 'wide':
      return { kind, at, w: 44, bottom: 0, top: 30 };
    case 'pit':
      // A gap in the ground: anything on the ground over it falls in. Short hops won't clear the wide ones.
      return { kind, at, w: [56, 72, 88][Math.floor(rng() * 3)], bottom: -GROUND_OFFSET, top: 0 };
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

// Maybe puts a coin above an obstacle: low ones are easy, high ones need a double jump.
const placeCoin = (r: Runner, o: Obstacle) => {
  if (r.coinRng() > r.physics.coinChance) return;
  const lift = 18 + r.coinRng() * 50;
  // Capped so even the highest coin is within reach of a jump plus a double jump.
  r.coins.push({ at: o.at + o.w / 2, h: Math.min(112, Math.max(o.top, 20) + lift), taken: false });
};

// Now and then a power-up in the middle of the gap after an obstacle.
const placePowerUp = (r: Runner, o: Obstacle, gap: number) => {
  const roll = r.powerRng();
  const kindRoll = r.powerRng();
  const high = r.powerRng() < 0.5;
  const score = scoreOf(o.at);
  if (score < POWERS_FROM || (score >= BOSS_FROM && score < BOSS_TO) || roll > POWER_CHANCE) return;
  const kind: PowerKind = kindRoll < 0.4 ? 'shield' : kindRoll < 0.7 ? 'magnet' : 'slow';
  r.powerUps.push({ kind, at: o.at + o.w + gap / 2, h: high ? 44 : 14, taken: false });
};

// Generates the course ahead of `from` and drops obstacles behind it. `from` is normally the
// runner's own distance, but spectators pass the camera position to keep watching the leader.
export const ensureCourse = (r: Runner, from: number) => {
  while (r.nextAt < from + SPAWN_LOOKAHEAD) {
    const obstacle = pickObstacle(r.rng, r.nextAt);
    r.obstacles.push(obstacle);
    placeCoin(r, obstacle);
    // Gap scales with speed so jumps stay possible as things speed up.
    const gap = speedAt(r.nextAt, r.physics.startSpeed) * (0.7 + r.rng() * 0.9);
    placePowerUp(r, obstacle, gap);
    r.nextAt += obstacle.w + gap;
  }
  r.obstacles = r.obstacles.filter((o) => o.at + o.w > from - PLAYER_X);
  r.coins = r.coins.filter((c) => c.at + COIN_SIZE > from - PLAYER_X);
  r.powerUps = r.powerUps.filter((p) => p.at + POWER_SIZE > from - PLAYER_X);
};

export const pressJump = (r: Runner) => {
  if (!r.alive) return;
  if (r.y === 0) {
    r.vy = r.physics.jump;
    r.y = 0.01;
    r.airJumps = 1;
  } else if (r.airJumps > 0) {
    r.vy = r.physics.doubleJump;
    r.airJumps -= 1;
  }
};

export const releaseJump = (r: Runner) => {
  if (r.vy < r.physics.release) r.vy = r.physics.release;
};

// Where a bomb is at a given runner distance: high up when far ahead, on the ground by the
// time the runner reaches it. Collisions treat it as landed; this is for drawing.
export const bombHeight = (o: Obstacle, distance: number) => Math.max(0, (o.at - distance - 60) * 0.7);

export const step = (r: Runner, dt: number) => {
  if (!r.alive) return;
  r.distance += runnerSpeed(r) * dt;

  r.vy += r.physics.gravity * dt;
  r.y = Math.max(0, r.y - r.vy * dt);
  if (r.y === 0) r.vy = 0;

  ensureCourse(r, r.distance);

  const px1 = r.distance + HITBOX_INSET;
  const px2 = r.distance + r.w - HITBOX_INSET;
  const py1 = r.y + HITBOX_INSET;
  const py2 = r.y + r.h - HITBOX_INSET;
  const centre = r.distance + r.w / 2;
  for (const o of r.obstacles) {
    const hit =
      o.kind === 'pit'
        ? r.y === 0 && centre > o.at && centre < o.at + o.w
        : o.at < px2 && o.at + o.w > px1 && o.bottom < py2 && o.top > py1;
    if (!hit) continue;
    if (r.shield) {
      // The shield takes the hit: the obstacle is gone, and a pit bounces you back out.
      r.shield = false;
      if (o.kind === 'pit') {
        r.vy = SHIELD_BOUNCE;
        r.y = 0.01;
        r.airJumps = 1;
      } else {
        r.obstacles = r.obstacles.filter((other) => other !== o);
      }
      break;
    }
    r.alive = false;
    break;
  }
  if (!r.alive) return;

  if (!r.bossBeaten && scoreOf(r.distance) >= BOSS_TO) r.bossBeaten = true;

  const half = COIN_SIZE / 2;
  const magnet = r.distance < r.magnetUntil;
  const midY = r.y + r.h / 2;
  for (const c of r.coins) {
    if (c.taken) continue;
    const touching = c.at - half < px2 && c.at + half > px1 && c.h - half < py2 && c.h + half > py1;
    const pulled = magnet && Math.abs(c.at - centre) < MAGNET_REACH && Math.abs(c.h - midY) < MAGNET_REACH * 1.5;
    if (touching || pulled) {
      c.taken = true;
      r.collected += 1;
    }
  }

  const ph = POWER_SIZE / 2;
  for (const p of r.powerUps) {
    if (p.taken || !(p.at - ph < px2 && p.at + ph > px1 && p.h - ph < py2 && p.h + ph > py1)) continue;
    p.taken = true;
    if (p.kind === 'shield') r.shield = true;
    else if (p.kind === 'magnet') r.magnetUntil = r.distance + MAGNET_LENGTH;
    else r.slowUntil = r.distance + SLOW_LENGTH;
  }
};
