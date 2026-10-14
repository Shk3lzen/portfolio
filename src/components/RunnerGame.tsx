import React, { useEffect, useRef } from 'react';
import styled from 'styled-components';
import { FiPlay } from 'react-icons/fi';

// A tiny endless runner: a pixel invader hops over posts. Space / ↑ / click / tap to jump.

const HEIGHT = 140;
const GROUND_OFFSET = 26; // distance from canvas bottom to the ground line
const PIXEL = 4;
const PLAYER_X = 48;
const GRAVITY = 2200; // px/s²
const JUMP_VELOCITY = -560; // px/s — apex ≈ 71px, clears the tallest post
const START_SPEED = 260; // px/s
const MAX_SPEED = 620;
const ACCELERATION = 6; // px/s gained per second
const POST_WIDTH = 18;
const POST_HEIGHTS = [26, 32, 40];
const PLAYER_COLOR = '#f0773a';
const HIGH_SCORE_KEY = 'runner-high-score';

// Two frames so the legs shuffle while running.
const SPRITE_FRAMES = [
  ['.XX....XX.', 'XXXXXXXXXX', 'XX.XXXX.XX', 'XXXXXXXXXX', 'XXXXXXXXXX', 'XX.X..X.XX', 'X........X'],
  ['.XX....XX.', 'XXXXXXXXXX', 'XX.XXXX.XX', 'XXXXXXXXXX', 'XXXXXXXXXX', 'XX.X..X.XX', '.X......X.'],
];
const PLAYER_W = SPRITE_FRAMES[0][0].length * PIXEL;
const PLAYER_H = SPRITE_FRAMES[0].length * PIXEL;

type Status = 'idle' | 'running' | 'over';

interface Post {
  x: number;
  h: number;
}

interface GameState {
  status: Status;
  y: number; // player's top offset above the ground (0 = standing)
  vy: number;
  speed: number;
  distance: number;
  posts: Post[];
  nextPostIn: number;
  highScore: number;
}

const readHighScore = () => {
  try {
    return Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0;
  } catch {
    return 0;
  }
};

const saveHighScore = (score: number) => {
  try {
    localStorage.setItem(HIGH_SCORE_KEY, String(score));
  } catch {
    /* ignore */
  }
};

const freshState = (highScore: number): GameState => ({
  status: 'idle',
  y: 0,
  vy: 0,
  speed: START_SPEED,
  distance: 0,
  posts: [],
  nextPostIn: 420,
  highScore,
});

const scoreOf = (s: GameState) => Math.floor(s.distance / 12);
const pad = (n: number) => String(Math.min(n, 99999)).padStart(4, '0');

const RunnerGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<GameState>(freshState(readHighScore()));
  const colorsRef = useRef({ text: '#888', heading: '#ccc', border: '136, 146, 176' });
  const drawRef = useRef<() => void>(() => {});

  // Re-read theme colours whenever data-theme flips, then repaint. Observing the attribute
  // (rather than the theme context) guarantees the new CSS variables are already applied.
  useEffect(() => {
    const readColors = () => {
      const css = getComputedStyle(document.documentElement);
      colorsRef.current = {
        text: css.getPropertyValue('--text').trim() || '#888',
        heading: css.getPropertyValue('--heading').trim() || '#ccc',
        border: css.getPropertyValue('--border-rgb').trim() || '136, 146, 176',
      };
      drawRef.current();
    };
    readColors();
    const observer = new MutationObserver(readColors);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let frame = 0;
    let last = 0;
    let visible = true;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      width = stage.clientWidth;
      canvas.width = width * dpr;
      canvas.height = HEIGHT * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${HEIGHT}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    };

    const draw = () => {
      const s = stateRef.current;
      const { text, heading, border } = colorsRef.current;
      const ground = HEIGHT - GROUND_OFFSET;
      ctx.clearRect(0, 0, width, HEIGHT);

      // Ground
      ctx.fillStyle = `rgba(${border}, 0.45)`;
      ctx.fillRect(0, ground, width, 2);

      // Posts
      ctx.fillStyle = heading;
      for (const p of s.posts) {
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(p.x, ground - p.h, POST_WIDTH, p.h, [6, 6, 0, 0]);
        else ctx.rect(p.x, ground - p.h, POST_WIDTH, p.h);
        ctx.fill();
      }

      // Player
      const legFrame = s.status === 'running' && s.y === 0 ? Math.floor(s.distance / 40) % 2 : 0;
      const top = ground - PLAYER_H - s.y;
      ctx.fillStyle = PLAYER_COLOR;
      SPRITE_FRAMES[legFrame].forEach((row, r) => {
        for (let c = 0; c < row.length; c++) {
          if (row[c] === 'X') ctx.fillRect(PLAYER_X + c * PIXEL, top + r * PIXEL, PIXEL, PIXEL);
        }
      });

      // Score
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.font = '600 15px "SF Mono", ui-monospace, Menlo, monospace';
      const scoreText = pad(scoreOf(s));
      ctx.fillStyle = heading;
      ctx.fillText(scoreText, width - 16, 16);
      const scoreW = ctx.measureText(scoreText).width;
      ctx.font = '15px "SF Mono", ui-monospace, Menlo, monospace';
      ctx.fillStyle = text;
      ctx.fillText('Score ', width - 16 - scoreW, 16);
      if (s.highScore > 0) {
        ctx.font = '12px "SF Mono", ui-monospace, Menlo, monospace';
        ctx.fillText(`HI ${pad(s.highScore)}`, width - 16, 38);
      }

      // Overlay messages
      if (s.status !== 'running') {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '13px "SF Mono", ui-monospace, Menlo, monospace';
        ctx.fillStyle = text;
        const msg = s.status === 'over' ? 'Game over · press Space or tap to retry' : 'Press Space or tap to play';
        ctx.fillText(msg, width / 2, HEIGHT / 2 - 6);
      }
    };
    drawRef.current = draw;

    const update = (dt: number) => {
      const s = stateRef.current;
      s.speed = Math.min(MAX_SPEED, s.speed + ACCELERATION * dt);
      const dx = s.speed * dt;
      s.distance += dx;

      // Vertical motion (y is height above ground, so gravity pulls it down)
      s.vy += GRAVITY * dt;
      s.y = Math.max(0, s.y - s.vy * dt);
      if (s.y === 0) s.vy = 0;

      // Move, spawn and cull posts
      for (const p of s.posts) p.x -= dx;
      s.posts = s.posts.filter((p) => p.x + POST_WIDTH > 0);
      s.nextPostIn -= dx;
      if (s.nextPostIn <= 0) {
        s.posts.push({ x: width + 10, h: POST_HEIGHTS[Math.floor(Math.random() * POST_HEIGHTS.length)] });
        // Gap scales with speed so jumps stay possible as things speed up.
        s.nextPostIn = s.speed * (0.75 + Math.random() * 0.9);
      }

      // Collision (slightly forgiving hitbox)
      const inset = 4;
      const px1 = PLAYER_X + inset;
      const px2 = PLAYER_X + PLAYER_W - inset;
      for (const p of s.posts) {
        if (p.x < px2 && p.x + POST_WIDTH > px1 && s.y < p.h - inset) {
          s.status = 'over';
          const score = scoreOf(s);
          if (score > s.highScore) {
            s.highScore = score;
            saveHighScore(score);
          }
          break;
        }
      }
    };

    const loop = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 0;
      last = now;
      if (visible && stateRef.current.status === 'running') {
        update(dt);
        draw();
        frame = requestAnimationFrame(loop);
      } else {
        frame = 0;
        last = 0;
      }
    };

    const startLoop = () => {
      if (!frame) frame = requestAnimationFrame(loop);
    };

    const jump = () => {
      const s = stateRef.current;
      if (s.status !== 'running') {
        stateRef.current = { ...freshState(s.highScore), status: 'running' };
        startLoop();
        return;
      }
      if (s.y === 0) {
        s.vy = JUMP_VELOCITY;
        s.y = 0.01;
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        jump();
      }
    };
    const onPointer = (e: PointerEvent) => {
      e.preventDefault();
      stage.focus();
      jump();
    };

    // Pause when scrolled out of view or the tab is hidden; resume on return.
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && !document.hidden;
      if (visible) startLoop();
    });
    observer.observe(stage);
    const onVisibility = () => {
      visible = !document.hidden;
      if (visible) startLoop();
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(stage);
    stage.addEventListener('keydown', onKey);
    stage.addEventListener('pointerdown', onPointer);
    document.addEventListener('visibilitychange', onVisibility);
    resize();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      resizeObserver.disconnect();
      stage.removeEventListener('keydown', onKey);
      stage.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <Wrapper>
      <Heading>
        <FiPlay />
        Take a break
      </Heading>
      <Stage
        ref={stageRef}
        tabIndex={0}
        role="application"
        aria-label="Runner game. Press Space or tap to jump over the posts."
      >
        <canvas ref={canvasRef} aria-hidden="true" />
      </Stage>
    </Wrapper>
  );
};

const Wrapper = styled.div`
  margin-top: 60px;
`;

const Heading = styled.h3`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-family: 'SF Mono', monospace;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 20px;
`;

const Stage = styled.div`
  border-radius: 12px;
  border: 1px solid rgba(var(--border-rgb), 0.18);
  background: rgba(var(--border-rgb), 0.05);
  overflow: hidden;
  cursor: pointer;
  touch-action: manipulation;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  transition: border-color 0.2s;

  &:hover,
  &:focus-visible {
    border-color: rgba(var(--accent-rgb), 0.4);
    outline: none;
  }

  canvas {
    display: block;
  }
`;

export default RunnerGame;
