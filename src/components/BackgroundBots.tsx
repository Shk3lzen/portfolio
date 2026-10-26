import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { SPRITE_FRAMES } from './runner/sprite';
import { find } from '../hunt/hunt';

// A few faint pixel invaders wandering across the page background: they walk at their own
// pace, hop now and then, and hop when the cursor comes close. Behind the content and paused
// in hidden tabs, off for reduced-motion users. The canvas never takes clicks, but a click on
// the page background right on a bot pokes it: five pokes pops it (a treasure hunt fragment).

const GRAVITY = 900; // px/s²
const HOP_VELOCITY = -230;
const NUDGE_RADIUS = 90; // cursor distance that makes a bot hop
const POKES_TO_POP = 5;
const POKE_SLOP = 8; // px of leeway around a bot for a poke to count
const INTERACTIVE = 'a, button, input, textarea, select, label, canvas, [role="application"], [role="dialog"]';
const SPRITE_W = SPRITE_FRAMES[0][0].length;
const SPRITE_H = SPRITE_FRAMES[0].length;

interface Bot {
  x: number;
  baseY: number;
  hop: number; // height above its walking line
  vy: number;
  dir: 1 | -1;
  speed: number;
  pixel: number;
  color: string;
  nextHop: number; // seconds until the next idle hop
  cooldown: number; // seconds before the cursor can make it hop again
  pokes: number;
  flash: number; // seconds left of the brighter "ouch" colour
}

interface Debris {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);

const spawn = (width: number, height: number, anywhere: boolean): Bot => {
  const dir = Math.random() < 0.5 ? 1 : -1;
  const pixel = Math.round(rand(3, 4));
  const w = SPRITE_W * pixel;
  return {
    // New bots walk in from the edge they're heading away from; the first batch is scattered.
    x: anywhere ? rand(0, width - w) : dir === 1 ? -w - rand(0, 200) : width + rand(0, 200),
    baseY: rand(height * 0.12, height * 0.95),
    hop: 0,
    vy: 0,
    dir,
    speed: rand(16, 42),
    pixel,
    color: `hsla(${Math.floor(rand(0, 360))}, 75%, 60%, ${rand(0.04, 0.08).toFixed(3)})`,
    nextHop: rand(2, 8),
    cooldown: 0,
    pokes: 0,
    flash: 0,
  };
};

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const BackgroundBots: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [enabled] = useState(() => !prefersReducedMotion());

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let width = 0;
    let height = 0;
    let bots: Bot[] = [];
    let debris: Debris[] = [];
    let frame = 0;
    let last = 0;
    const pointer = { x: -9999, y: -9999 };

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Roughly one bot per 300px of width, 3–6 in total.
      const count = Math.max(3, Math.min(6, Math.round(width / 300)));
      while (bots.length < count) bots.push(spawn(width, height, true));
      bots = bots.slice(0, count);
      bots.forEach((b) => (b.baseY = Math.min(b.baseY, height * 0.95)));
    };

    const update = (bot: Bot, dt: number) => {
      bot.x += bot.dir * bot.speed * dt;
      bot.nextHop -= dt;
      bot.cooldown -= dt;
      bot.flash = Math.max(0, bot.flash - dt);

      const w = SPRITE_W * bot.pixel;
      const h = SPRITE_H * bot.pixel;
      const near = Math.hypot(pointer.x - (bot.x + w / 2), pointer.y - (bot.baseY - h / 2 - bot.hop)) < NUDGE_RADIUS;
      if (bot.hop === 0 && (bot.nextHop <= 0 || (near && bot.cooldown <= 0))) {
        bot.vy = HOP_VELOCITY * (near ? 1.3 : rand(0.6, 1));
        bot.hop = 0.01;
        bot.nextHop = rand(3, 9);
        bot.cooldown = 1.2;
      }
      if (bot.hop > 0) {
        bot.vy += GRAVITY * dt;
        bot.hop = Math.max(0, bot.hop - bot.vy * dt);
      }

      // Walked off screen: a fresh bot comes in from a side.
      if ((bot.dir === 1 && bot.x > width + 20) || (bot.dir === -1 && bot.x < -w - 20)) {
        Object.assign(bot, spawn(width, height, false));
      }
    };

    const draw = (bot: Bot) => {
      const legs = bot.hop > 0 ? 0 : Math.floor(Math.abs(bot.x) / 6) % 2;
      const top = bot.baseY - SPRITE_H * bot.pixel - bot.hop;
      // A poked bot briefly shows at full strength.
      ctx.fillStyle = bot.flash > 0 ? bot.color.replace(/, [\d.]+\)$/, ', 0.6)') : bot.color;
      SPRITE_FRAMES[legs].forEach((row, r) => {
        for (let c = 0; c < row.length; c++) {
          if (row[c] === 'X') ctx.fillRect(bot.x + c * bot.pixel, top + r * bot.pixel, bot.pixel, bot.pixel);
        }
      });
    };

    const loop = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      ctx.clearRect(0, 0, width, height);
      for (const bot of bots) {
        update(bot, dt);
        draw(bot);
      }
      debris = debris.filter((d) => (d.life -= dt) > 0);
      for (const d of debris) {
        d.vy += GRAVITY * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        ctx.globalAlpha = Math.min(1, d.life * 2);
        ctx.fillStyle = d.color;
        ctx.fillRect(d.x, d.y, d.size, d.size);
      }
      ctx.globalAlpha = 1;
      frame = requestAnimationFrame(loop);
    };

    const start = () => {
      if (!frame && !document.hidden) frame = requestAnimationFrame(loop);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    const onPointer = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
    };

    // Bursts a bot into its pixels, then sends a fresh one in.
    const pop = (bot: Bot) => {
      const top = bot.baseY - SPRITE_H * bot.pixel - bot.hop;
      const solid = bot.color.replace(/, [\d.]+\)$/, ', 0.7)');
      SPRITE_FRAMES[0].forEach((row, r) => {
        for (let c = 0; c < row.length; c++) {
          if (row[c] !== 'X') continue;
          debris.push({
            x: bot.x + c * bot.pixel,
            y: top + r * bot.pixel,
            vx: rand(-160, 160),
            vy: rand(-320, -80),
            size: bot.pixel,
            color: solid,
            life: rand(0.8, 1.4),
          });
        }
      });
      Object.assign(bot, spawn(width, height, false));
    };

    const onPoke = (e: PointerEvent) => {
      if (e.target instanceof Element && e.target.closest(INTERACTIVE)) return;
      const bot = bots.find((b) => {
        const w = SPRITE_W * b.pixel;
        const h = SPRITE_H * b.pixel;
        const top = b.baseY - h - b.hop;
        return (
          e.clientX > b.x - POKE_SLOP &&
          e.clientX < b.x + w + POKE_SLOP &&
          e.clientY > top - POKE_SLOP &&
          e.clientY < top + h + POKE_SLOP
        );
      });
      if (!bot) return;
      bot.pokes += 1;
      bot.flash = 0.25;
      if (bot.hop === 0) {
        bot.vy = HOP_VELOCITY;
        bot.hop = 0.01;
      }
      if (bot.pokes >= POKES_TO_POP) {
        pop(bot);
        find('bots');
      }
    };

    resize();
    start();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('pointerdown', onPoke);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('pointerdown', onPoke);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled]);

  if (!enabled) return null;
  return <Canvas ref={canvasRef} aria-hidden="true" />;
};

// Behind everything: painted over <body>'s background colour, under all page content.
const Canvas = styled.canvas`
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  z-index: -1;
  pointer-events: none;
`;

export default BackgroundBots;
