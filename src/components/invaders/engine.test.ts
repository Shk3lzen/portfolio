import { COLS, Controls, H, ROWS, SHIP_W, SHIP_Y, W, aliveCount, invaderPos, marchSpeed, newShooter, step } from './engine';

const DT = 1 / 60;
const idle: Controls = { left: false, right: false, fire: false };

test('a new game starts with a full grid, three lives and three bunkers', () => {
  const s = newShooter(1);
  expect(aliveCount(s)).toBe(ROWS * COLS);
  expect(s.lives).toBe(3);
  expect(s.blocks.length).toBeGreaterThan(30);
});

test('the same seed gives the same enemy fire', () => {
  const a = newShooter(7);
  const b = newShooter(7);
  for (let i = 0; i < 600; i++) {
    step(a, DT, idle);
    step(b, DT, idle);
  }
  expect(a.bombs).toEqual(b.bombs);
  expect(a.lives).toBe(b.lives);
});

test('the ship moves and stays on screen', () => {
  const s = newShooter(1);
  for (let i = 0; i < 300; i++) step(s, DT, { ...idle, right: true });
  expect(s.shipX).toBe(W - SHIP_W);
  for (let i = 0; i < 300; i++) step(s, DT, { ...idle, left: true });
  expect(s.shipX).toBe(0);
});

test('shooting an invader scores and removes it', () => {
  const s = newShooter(1);
  s.blocks = [];
  s.fireTimer = Infinity; // no return fire
  const target = s.invaders.find((i) => i.row === ROWS - 1 && i.col === 3)!;
  s.shipX = invaderPos(s, target).x - 5;
  step(s, DT, { ...idle, fire: true });
  for (let i = 0; i < 60; i++) step(s, DT, idle);
  expect(aliveCount(s)).toBe(ROWS * COLS - 1);
  expect(s.score).toBeGreaterThan(0);
});

test('bunkers stop bullets and wear away', () => {
  const s = newShooter(1);
  s.fireTimer = Infinity;
  const blocks = s.blocks.length;
  s.shipX = s.blocks[0].x - SHIP_W / 2 + 3;
  step(s, DT, { ...idle, fire: true });
  for (let i = 0; i < 30; i++) step(s, DT, idle);
  expect(s.blocks.length).toBe(blocks - 1);
  expect(aliveCount(s)).toBe(ROWS * COLS);
});

test('getting hit costs a life, then a moment of safety', () => {
  const s = newShooter(1);
  s.fireTimer = Infinity;
  s.bombs = [{ x: s.shipX + SHIP_W / 2, y: SHIP_Y - 4, vy: 200 }];
  for (let i = 0; i < 10; i++) step(s, DT, idle);
  expect(s.lives).toBe(2);
  expect(s.invulnerable).toBeGreaterThan(0);
});

test('clearing a wave starts a faster one', () => {
  const s = newShooter(1);
  const firstSpeed = marchSpeed(s);
  s.invaders.forEach((i) => (i.alive = false));
  step(s, DT, idle);
  expect(s.wave).toBe(2);
  expect(s.waveCleared).toBe(true);
  expect(aliveCount(s)).toBe(ROWS * COLS);
  expect(marchSpeed(s)).toBeGreaterThan(firstSpeed);
});

test('invaders reaching the ship end the game', () => {
  const s = newShooter(1);
  s.gridY = SHIP_Y;
  step(s, DT, idle);
  expect(s.alive).toBe(false);
  expect(H).toBeGreaterThan(SHIP_Y);
});

test('the grid marches down over time', () => {
  const s = newShooter(1);
  s.fireTimer = Infinity;
  const startY = s.gridY;
  for (let i = 0; i < 60 * 20; i++) step(s, DT, idle);
  expect(s.gridY).toBeGreaterThan(startY);
});
