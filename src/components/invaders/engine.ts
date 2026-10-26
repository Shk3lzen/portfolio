// Pure simulation for the invader shooter: no DOM, no drawing. The world is a fixed 480×270
// field (scaled to fit the screen), so the game plays the same on any device. Enemy fire and
// the mystery ship come from a PRNG seeded by the day, so everyone faces the same patterns.

export const W = 480;
export const H = 270;

export const SHIP_PIXEL = 3;
export const SHIP_W = 10 * SHIP_PIXEL;
export const SHIP_H = 7 * SHIP_PIXEL;
export const SHIP_Y = H - 18 - SHIP_H; // top of the ship
const SHIP_SPEED = 230; // px/s

export const INVADER_PIXEL = 2;
export const INVADER_W = 10 * INVADER_PIXEL;
export const INVADER_H = 7 * INVADER_PIXEL;
export const COLS = 8;
export const ROWS = 5;
const CELL_W = 36;
const CELL_H = 24;
const GRID_TOP = 36;
const MARGIN = 12;
const STEP_DOWN = 10;

export const BULLET_W = 2;
export const BULLET_H = 8;
const PLAYER_BULLET_SPEED = 430;
const MAX_PLAYER_BULLETS = 2;
const FIRE_COOLDOWN = 0.32; // s

export const BLOCK = 6;
const BUNKER_COLS = 7;
const BUNKER_ROWS = 4;
const BUNKER_Y = SHIP_Y - 46;

export const UFO_W = 32;
export const UFO_H = 12;
const UFO_Y = 14;
const UFO_SPEED = 90;

export const LIVES = 3;
const INVULNERABLE_S = 1.5;
const ROW_POINTS = [30, 20, 20, 10, 10];

export interface Invader {
  row: number;
  col: number;
  alive: boolean;
}

export interface Bullet {
  x: number; // left edge
  y: number; // top edge
  vy: number;
}

export interface Ufo {
  x: number;
  dir: 1 | -1;
}

export interface Shooter {
  rng: () => number;
  wave: number;
  score: number;
  lives: number;
  alive: boolean; // false once out of lives (or invaded)
  shipX: number; // left edge
  invulnerable: number; // seconds left
  cooldown: number;
  bullets: Bullet[]; // the player's
  bombs: Bullet[]; // the invaders'
  invaders: Invader[];
  gridX: number; // offset of the grid's left edge
  gridY: number;
  dir: 1 | -1;
  marched: number; // distance marched, drives the two-frame animation
  fireTimer: number;
  blocks: { x: number; y: number }[]; // bunker blocks still standing
  ufo: Ufo | null;
  ufoTimer: number;
  ufosHit: number; // mystery ships shot this game (they pay out coins)
  waveCleared: boolean; // set for one step when a wave falls, for the UI
}

export interface Controls {
  left: boolean;
  right: boolean;
  fire: boolean;
  targetX?: number | null; // touch: centre the ship under the finger
}

// Small, fast, seedable PRNG (mulberry32), the same one the runner uses.
const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const gridWidth = () => (COLS - 1) * CELL_W + INVADER_W;

export const invaderPos = (s: Shooter, inv: Invader) => ({
  x: s.gridX + inv.col * CELL_W,
  y: s.gridY + inv.row * CELL_H,
});

const bunkers = () => {
  const blocks: { x: number; y: number }[] = [];
  const width = BUNKER_COLS * BLOCK;
  const gap = (W - 3 * width) / 4;
  for (let b = 0; b < 3; b++) {
    const left = gap + b * (width + gap);
    for (let r = 0; r < BUNKER_ROWS; r++) {
      for (let c = 0; c < BUNKER_COLS; c++) {
        // An arch: the middle of the bottom row is open.
        if (r === BUNKER_ROWS - 1 && c >= 2 && c <= 4) continue;
        if (r === 0 && (c === 0 || c === BUNKER_COLS - 1)) continue;
        blocks.push({ x: left + c * BLOCK, y: BUNKER_Y + r * BLOCK });
      }
    }
  }
  return blocks;
};

// Each wave starts a little lower (up to a point) and marches and fires faster.
const startWave = (s: Shooter) => {
  s.invaders = [];
  for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) s.invaders.push({ row, col, alive: true });
  s.gridX = (W - gridWidth()) / 2;
  s.gridY = GRID_TOP + Math.min(s.wave - 1, 4) * 8;
  s.dir = 1;
  s.bombs = [];
  s.bullets = [];
  s.blocks = bunkers();
  s.fireTimer = fireInterval(s);
};

export const newShooter = (seed: number): Shooter => {
  const s: Shooter = {
    rng: mulberry32(seed),
    wave: 1,
    score: 0,
    lives: LIVES,
    alive: true,
    shipX: (W - SHIP_W) / 2,
    invulnerable: 0,
    cooldown: 0,
    bullets: [],
    bombs: [],
    invaders: [],
    gridX: 0,
    gridY: 0,
    dir: 1,
    marched: 0,
    fireTimer: 0,
    blocks: [],
    ufo: null,
    ufoTimer: 0,
    ufosHit: 0,
    waveCleared: false,
  };
  s.ufoTimer = 15 + s.rng() * 10;
  startWave(s);
  return s;
};

export const aliveCount = (s: Shooter) => s.invaders.filter((i) => i.alive).length;

// Marching speed: faster each wave, and much faster as the grid thins out.
export const marchSpeed = (s: Shooter) => {
  const left = aliveCount(s) / (ROWS * COLS);
  return (18 + s.wave * 6) * (1 + 3 * (1 - left));
};

const fireInterval = (s: Shooter) => Math.max(0.3, 1.25 - s.wave * 0.1) * (0.6 + s.rng() * 0.8);

const overlaps = (ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) =>
  ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

// Removes the first bunker block a rectangle touches; true if one was hit.
const chipBunker = (s: Shooter, x: number, y: number, w: number, h: number) => {
  const i = s.blocks.findIndex((b) => overlaps(x, y, w, h, b.x, b.y, BLOCK, BLOCK));
  if (i < 0) return false;
  s.blocks.splice(i, 1);
  return true;
};

export const step = (s: Shooter, dt: number, input: Controls) => {
  s.waveCleared = false;
  if (!s.alive) return;

  // Ship
  if (input.targetX != null) {
    const want = Math.min(W - SHIP_W, Math.max(0, input.targetX - SHIP_W / 2));
    const move = SHIP_SPEED * 1.4 * dt;
    s.shipX += Math.max(-move, Math.min(move, want - s.shipX));
  } else {
    const dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    s.shipX = Math.min(W - SHIP_W, Math.max(0, s.shipX + dx * SHIP_SPEED * dt));
  }
  s.invulnerable = Math.max(0, s.invulnerable - dt);
  s.cooldown = Math.max(0, s.cooldown - dt);
  if (input.fire && s.cooldown === 0 && s.bullets.length < MAX_PLAYER_BULLETS) {
    s.bullets.push({ x: s.shipX + SHIP_W / 2 - BULLET_W / 2, y: SHIP_Y - BULLET_H, vy: -PLAYER_BULLET_SPEED });
    s.cooldown = FIRE_COOLDOWN;
  }

  // Grid march: sideways, then down a step and back at the edges.
  const living = s.invaders.filter((i) => i.alive);
  const dx = s.dir * marchSpeed(s) * dt;
  s.gridX += dx;
  s.marched += Math.abs(dx);
  const xs = living.map((i) => s.gridX + i.col * CELL_W);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs) + INVADER_W;
  if ((s.dir === 1 && maxX > W - MARGIN) || (s.dir === -1 && minX < MARGIN)) {
    s.gridX -= dx;
    s.dir = s.dir === 1 ? -1 : 1;
    s.gridY += STEP_DOWN;
  }

  // Invaders flatten bunkers they reach, and reaching the ship's row ends the game.
  for (const inv of living) {
    const p = invaderPos(s, inv);
    while (chipBunker(s, p.x, p.y, INVADER_W, INVADER_H)) {
      /* keep clearing */
    }
    if (p.y + INVADER_H >= SHIP_Y) {
      s.alive = false;
      s.lives = 0;
      return;
    }
  }

  // Invader fire: the lowest invader in a random column drops a bomb.
  s.fireTimer -= dt;
  if (s.fireTimer <= 0 && living.length) {
    const cols = Array.from(new Set(living.map((i) => i.col)));
    const col = cols[Math.floor(s.rng() * cols.length)];
    const shooter = living.filter((i) => i.col === col).reduce((a, b) => (b.row > a.row ? b : a));
    const p = invaderPos(s, shooter);
    s.bombs.push({ x: p.x + INVADER_W / 2 - BULLET_W / 2, y: p.y + INVADER_H, vy: 150 + s.wave * 15 });
    s.fireTimer = fireInterval(s);
  }

  // Mystery ship
  s.ufoTimer -= dt;
  if (!s.ufo && s.ufoTimer <= 0) {
    const dir = s.rng() < 0.5 ? 1 : -1;
    s.ufo = { x: dir === 1 ? -UFO_W : W, dir };
  }
  if (s.ufo) {
    s.ufo.x += s.ufo.dir * UFO_SPEED * dt;
    if (s.ufo.x > W + UFO_W || s.ufo.x < -UFO_W * 2) {
      s.ufo = null;
      s.ufoTimer = 18 + s.rng() * 12;
    }
  }

  // Player bullets
  for (const b of s.bullets) b.y += b.vy * dt;
  s.bullets = s.bullets.filter((b) => {
    if (b.y + BULLET_H < 0) return false;
    if (chipBunker(s, b.x, b.y, BULLET_W, BULLET_H)) return false;
    if (s.ufo && overlaps(b.x, b.y, BULLET_W, BULLET_H, s.ufo.x, UFO_Y, UFO_W, UFO_H)) {
      s.score += [100, 150, 200, 300][Math.floor(s.rng() * 4)];
      s.ufosHit += 1;
      s.ufo = null;
      s.ufoTimer = 18 + s.rng() * 12;
      return false;
    }
    const hit = s.invaders.find((inv) => {
      if (!inv.alive) return false;
      const p = invaderPos(s, inv);
      return overlaps(b.x, b.y, BULLET_W, BULLET_H, p.x, p.y, INVADER_W, INVADER_H);
    });
    if (!hit) return true;
    hit.alive = false;
    s.score += ROW_POINTS[hit.row];
    return false;
  });

  // Invader bombs
  for (const b of s.bombs) b.y += b.vy * dt;
  s.bombs = s.bombs.filter((b) => {
    if (b.y > H) return false;
    if (chipBunker(s, b.x, b.y, BULLET_W, BULLET_H)) return false;
    if (s.invulnerable === 0 && overlaps(b.x, b.y, BULLET_W, BULLET_H, s.shipX + 3, SHIP_Y + 3, SHIP_W - 6, SHIP_H - 3)) {
      s.lives -= 1;
      s.invulnerable = INVULNERABLE_S;
      if (s.lives <= 0) s.alive = false;
      return false;
    }
    return true;
  });
  if (s.invulnerable === INVULNERABLE_S) s.bombs = []; // a fresh start after a hit

  // Wave cleared: bonus, then the next one.
  if (aliveCount(s) === 0) {
    s.score += 50 * s.wave;
    s.wave += 1;
    s.waveCleared = true;
    startWave(s);
  }
};
