import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { FiAward, FiCrosshair } from 'react-icons/fi';
import {
  BLOCK,
  BULLET_H,
  BULLET_W,
  H,
  INVADER_H,
  INVADER_PIXEL,
  INVADER_W,
  SHIP_PIXEL,
  SHIP_Y,
  Shooter,
  UFO_H,
  UFO_W,
  W,
  invaderPos,
  newShooter,
  step,
} from './invaders/engine';
import { colorFor, getDeviceId, loadName, todayKey } from './runner/net';
import { BoardState, Leaderboard, openLeaderboard, TOP_N } from './runner/leaderboard';
import { seedForDay } from './runner/tape';
import { BOTS, BotSprite, botFor } from './runner/sprite';
import { HATS, addCoins, loadCosmetics } from './runner/cosmetics';
import { find, isComplete } from '../hunt/hunt';

// Space Invaders with the site's pixel bots: your bot is the ship, the others march down at
// you. Arrows / A-D to move, Space to shoot (hold for auto-fire); on touch, drag to move and
// it fires on its own. Same enemy fire for everyone each day, and a daily top 10 like the
// runner's. Mystery ships pay out coins for the runner's shop.

const HIGH_SCORE_KEY = 'invaders-high-score';
const FONT = '"SF Mono", ui-monospace, Menlo, monospace';
const GOLD = 'hsl(45, 80%, 58%)';
const COINS_PER_UFO = 3;
const HUNT_WAVE = 5; // reaching this wave finds the hunt fragment
const BANNER_S = 1.6;
const BOOM_S = 0.25;
const ROW_HUES = [330, 280, 200, 160, 45];

type Phase = 'idle' | 'running' | 'over';

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

const pad = (n: number) => String(Math.min(n, 99999)).padStart(4, '0');

const InvaderGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const colorsRef = useRef({ text: '#888', heading: '#ccc', border: '136, 146, 176', accent: '#64ffda' });
  const drawRef = useRef<() => void>(() => {});
  const leaderboardRef = useRef<Leaderboard | null>(null);
  const [board, setBoard] = useState<BoardState | null>(null);
  const [lastScore, setLastScore] = useState<{ score: number; wave: number; coins: number } | null>(null);
  const [me] = useState(() => {
    const deviceId = getDeviceId();
    return { deviceId, color: isComplete() ? GOLD : colorFor(deviceId), bot: botFor(deviceId), name: loadName(deviceId) };
  });

  // Theme colours, re-read when data-theme flips (as in the runner).
  useEffect(() => {
    const readColors = () => {
      const css = getComputedStyle(document.documentElement);
      colorsRef.current = {
        text: css.getPropertyValue('--text').trim() || '#888',
        heading: css.getPropertyValue('--heading').trim() || '#ccc',
        border: css.getPropertyValue('--border-rgb').trim() || '136, 146, 176',
        accent: css.getPropertyValue('--accent').trim() || '#64ffda',
      };
      drawRef.current();
    };
    readColors();
    const observer = new MutationObserver(readColors);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-retro'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let game: Shooter = newShooter(seedForDay(todayKey()));
    let phase: Phase = 'idle';
    let highScore = readHighScore();
    let width = 0;
    let scale = 1;
    let frame = 0;
    let last = 0;
    let visible = true;
    let banner: { text: string; until: number } | null = null;
    let booms: { x: number; y: number; t: number }[] = [];
    let aliveBefore: boolean[] = [];
    let huntFound = false;
    const keys = { left: false, right: false, fire: false };
    let touchX: number | null = null;
    let elapsed = 0;

    const hat = () => loadCosmetics().hat;
    let currentHat = hat();

    // ---- drawing ----------------------------------------------------------------------

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      width = stage.clientWidth;
      scale = width / W;
      canvas.width = width * dpr;
      canvas.height = H * scale * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${H * scale}px`;
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
      draw();
    };

    const drawBot = (bot: BotSprite, x: number, y: number, pixel: number, color: string, frameIndex: number) => {
      ctx.fillStyle = color;
      bot.frames[frameIndex].forEach((row, r) => {
        for (let c = 0; c < row.length; c++) if (row[c] === 'X') ctx.fillRect(x + c * pixel, y + r * pixel, pixel, pixel);
      });
    };

    const text = (msg: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'center', weight = '') => {
      ctx.font = `${weight} ${size}px ${FONT}`;
      ctx.textAlign = align;
      ctx.textBaseline = 'middle';
      ctx.fillStyle = color;
      ctx.fillText(msg, x, y);
    };

    const draw = () => {
      const { text: textColor, heading, border, accent } = colorsRef.current;
      ctx.clearRect(0, 0, W, H);

      // Ground line
      ctx.fillStyle = `rgba(${border}, 0.45)`;
      ctx.fillRect(0, H - 10, W, 1);

      // Bunkers
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.55;
      for (const b of game.blocks) ctx.fillRect(b.x, b.y, BLOCK, BLOCK);
      ctx.globalAlpha = 1;

      // Invaders (each row is a different bot), two-frame shuffle as they march
      const legs = Math.floor(game.marched / 12) % 2;
      for (const inv of game.invaders) {
        if (!inv.alive) continue;
        const p = invaderPos(game, inv);
        drawBot(BOTS[(inv.row + 1) % BOTS.length], p.x, p.y, INVADER_PIXEL, `hsl(${ROW_HUES[inv.row]}, 75%, 62%)`, legs);
      }

      // Explosions
      for (const b of booms) {
        const k = 1 - (elapsed - b.t) / BOOM_S;
        ctx.globalAlpha = Math.max(0, k);
        ctx.fillStyle = heading;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const r = (1 - k) * 12 + 2;
          ctx.fillRect(b.x + Math.cos(a) * r - 1, b.y + Math.sin(a) * r - 1, 2, 2);
        }
        ctx.globalAlpha = 1;
      }

      // Mystery ship
      if (game.ufo) {
        const x = game.ufo.x;
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.ellipse(x + UFO_W / 2, 14 + UFO_H * 0.65, UFO_W / 2, UFO_H * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fca5a5';
        ctx.beginPath();
        ctx.ellipse(x + UFO_W / 2, 14 + UFO_H * 0.35, UFO_W / 4, UFO_H * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Shots
      ctx.fillStyle = accent;
      for (const b of game.bullets) ctx.fillRect(b.x, b.y, BULLET_W, BULLET_H);
      ctx.fillStyle = '#f87171';
      for (const b of game.bombs) {
        // A little zig-zag so bombs read differently from your shots.
        const wiggle = Math.floor(b.y / 4) % 2 ? 1 : -1;
        ctx.fillRect(b.x + wiggle, b.y, BULLET_W, BULLET_H / 2);
        ctx.fillRect(b.x - wiggle, b.y + BULLET_H / 2, BULLET_W, BULLET_H / 2);
      }

      // Ship (blinks while invulnerable), with your hat from the runner's shop
      const blink = game.invulnerable > 0 && Math.floor(elapsed * 10) % 2 === 0;
      if (phase !== 'over' && !blink) {
        drawBot(me.bot, game.shipX, SHIP_Y, SHIP_PIXEL, me.color, 0);
        if (currentHat) {
          const h = HATS[currentHat];
          const top = SHIP_Y - h.rows.length * SHIP_PIXEL;
          h.rows.forEach((row, r) => {
            for (let c = 0; c < row.length; c++) {
              const color = h.palette[row[c]];
              if (!color) continue;
              ctx.fillStyle = color;
              ctx.fillRect(game.shipX + c * SHIP_PIXEL, top + r * SHIP_PIXEL, SHIP_PIXEL, SHIP_PIXEL);
            }
          });
        }
      }

      // HUD
      text(`Score ${pad(game.score)}`, 10, 10, 11, heading, 'left', '600');
      text(`Wave ${game.wave}`, W / 2, 10, 11, textColor);
      for (let i = 0; i < game.lives; i++) {
        drawBot(me.bot, W - 16 - i * 18, 5, 1.2, me.color, 0);
      }
      if (highScore > 0) text(`HI ${pad(highScore)}`, W - 10, 24, 9, textColor, 'right');

      // Overlays
      if (phase === 'idle') {
        text('Press Space or tap to play', W / 2, 158, 12, textColor);
        text('←/→ move · Space shoot · on touch: drag, it fires itself', W / 2, 173, 9, textColor);
      } else if (phase === 'over') {
        text('Game over', W / 2, 156, 16, heading, 'center', '700');
        text(`Wave ${game.wave} · ${pad(game.score)} · Space or tap to retry`, W / 2, 174, 10, textColor);
      } else if (banner && elapsed < banner.until) {
        text(banner.text, W / 2, 165, 16, heading, 'center', '700');
      }
    };
    drawRef.current = draw;

    // ---- game flow --------------------------------------------------------------------

    const finish = () => {
      phase = 'over';
      const coins = game.ufosHit * COINS_PER_UFO;
      if (coins > 0) addCoins(coins);
      if (game.score > highScore) {
        highScore = game.score;
        saveHighScore(highScore);
      }
      leaderboardRef.current?.report(game.score);
      setLastScore({ score: game.score, wave: game.wave, coins });
    };

    const tick = (dt: number) => {
      elapsed += dt;
      step(game, dt, { ...keys, targetX: touchX });

      // Bursts where invaders just fell
      game.invaders.forEach((inv, i) => {
        if (aliveBefore[i] && !inv.alive) {
          const p = invaderPos(game, inv);
          booms.push({ x: p.x + INVADER_W / 2, y: p.y + INVADER_H / 2, t: elapsed });
        }
      });
      aliveBefore = game.invaders.map((inv) => inv.alive);
      booms = booms.filter((b) => elapsed - b.t < BOOM_S);

      if (game.waveCleared) {
        banner = { text: `WAVE ${game.wave}`, until: elapsed + BANNER_S };
        aliveBefore = game.invaders.map(() => true);
        if (!huntFound && game.wave >= HUNT_WAVE) {
          huntFound = true;
          find('invaders');
        }
      }
      if (!game.alive) finish();
    };

    const loop = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 0;
      last = now;
      if (visible && phase === 'running') {
        tick(dt);
        draw();
        frame = requestAnimationFrame(loop);
      } else {
        draw();
        frame = 0;
        last = 0;
      }
    };
    const startLoop = () => {
      if (!frame) frame = requestAnimationFrame(loop);
    };

    const start = () => {
      game = newShooter(seedForDay(todayKey()));
      aliveBefore = game.invaders.map(() => true);
      booms = [];
      elapsed = 0;
      currentHat = hat();
      banner = { text: 'WAVE 1', until: BANNER_S };
      phase = 'running';
      setLastScore(null);
      startLoop();
    };

    // ---- input ------------------------------------------------------------------------

    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a') keys.left = true;
      else if (k === 'arrowright' || k === 'd') keys.right = true;
      else if (k === ' ' || k === 'arrowup' || k === 'w') {
        if (phase !== 'running' && !e.repeat) start();
        keys.fire = true;
      } else return;
      e.preventDefault();
      touchX = null;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a') keys.left = false;
      else if (k === 'arrowright' || k === 'd') keys.right = false;
      else if (k === ' ' || k === 'arrowup' || k === 'w') keys.fire = false;
    };
    const toWorldX = (e: PointerEvent) => (e.clientX - stage.getBoundingClientRect().left) / scale;
    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      stage.focus();
      if (phase !== 'running') {
        start();
        return;
      }
      if (e.pointerType !== 'mouse') {
        touchX = toWorldX(e);
        keys.fire = true;
      } else {
        keys.fire = true; // click to shoot
      }
    };
    const onPointerMove = (e: PointerEvent) => {
      if (touchX !== null) touchX = toWorldX(e);
    };
    const onPointerUp = () => {
      touchX = null;
      keys.fire = false;
    };
    const onBlur = () => {
      keys.left = keys.right = keys.fire = false;
    };

    // Join the board and start drawing only once the game scrolls into view.
    let joined = false;
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && !document.hidden;
      if (entry.isIntersecting && !joined) {
        joined = true;
        leaderboardRef.current = openLeaderboard({ deviceId: me.deviceId, name: me.name, color: me.color }, setBoard, 'invaders');
      }
      if (visible) startLoop();
    });
    observer.observe(stage);
    const onVisibility = () => {
      visible = !document.hidden;
      if (visible) startLoop();
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(stage);
    stage.addEventListener('keydown', onKeyDown);
    stage.addEventListener('keyup', onKeyUp);
    stage.addEventListener('blur', onBlur);
    stage.addEventListener('pointerdown', onPointerDown);
    stage.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    document.addEventListener('visibilitychange', onVisibility);
    resize();

    return () => {
      leaderboardRef.current?.close();
      leaderboardRef.current = null;
      cancelAnimationFrame(frame);
      observer.disconnect();
      resizeObserver.disconnect();
      stage.removeEventListener('keydown', onKeyDown);
      stage.removeEventListener('keyup', onKeyUp);
      stage.removeEventListener('blur', onBlur);
      stage.removeEventListener('pointerdown', onPointerDown);
      stage.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [me]);

  return (
    <Wrapper>
      <Heading>
        <FiCrosshair />
        Invaders
      </Heading>
      <Stage
        ref={stageRef}
        tabIndex={0}
        role="application"
        aria-label="Invader shooter. Arrow keys or A and D to move, Space to shoot. On touch, drag to move; it fires on its own."
      >
        <canvas ref={canvasRef} aria-hidden="true" />
      </Stage>
      <Note>
        Playing as <strong>{me.name}</strong> (your name from the runner). Mystery ships drop ◆{COINS_PER_UFO} for the
        runner&apos;s shop.
      </Note>
      {lastScore && (
        <Note>
          Score {pad(lastScore.score)} · reached wave {lastScore.wave}
          {lastScore.coins > 0 && ` · +◆${lastScore.coins}`}
        </Note>
      )}
      <Board aria-labelledby="invaders-board-title">
        <BoardHeader>
          <BoardTitle id="invaders-board-title">
            <FiAward aria-hidden="true" />
            Today&apos;s top {TOP_N}
          </BoardTitle>
          <BoardNote>resets 00:00 UTC</BoardNote>
        </BoardHeader>
        {board === null ? (
          <BoardNote as="p">Scroll here to load the board.</BoardNote>
        ) : board.entries.length === 0 ? (
          <BoardNote as="p">No scores yet today. Set the first one!</BoardNote>
        ) : (
          <BoardList>
            {board.entries.map((entry, i) => (
              <BoardRow key={entry.deviceId} $mine={entry.deviceId === me.deviceId}>
                <span>{i + 1}</span>
                <Dot style={{ background: entry.color }} aria-hidden="true" />
                <BoardName>{entry.name}</BoardName>
                <span>{pad(entry.score)}</span>
              </BoardRow>
            ))}
          </BoardList>
        )}
        {board && !board.shared && (
          <BoardNote as="p">Couldn&apos;t reach the shared board, so this shows this device only.</BoardNote>
        )}
      </Board>
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
  cursor: crosshair;
  touch-action: none;
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

const Note = styled.p`
  margin-top: 12px;
  font-family: 'SF Mono', monospace;
  font-size: 12px;
  color: var(--text);

  strong {
    color: var(--heading);
  }
`;

const Board = styled.section`
  margin-top: 24px;
  font-family: 'SF Mono', monospace;
  font-size: 12px;
  color: var(--text);
`;

const BoardHeader = styled.div`
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
`;

const BoardTitle = styled.h4`
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--heading);

  svg {
    align-self: center;
    color: var(--accent);
  }
`;

const BoardNote = styled.span`
  font-size: 11px;
  color: var(--text);
  margin-top: 6px;
`;

const BoardList = styled.ol`
  list-style: none;
  margin: 0;
  padding: 0;
`;

const BoardRow = styled.li<{ $mine: boolean }>`
  display: grid;
  grid-template-columns: 2.5ch 10px 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 5px 8px;
  border-radius: 4px;
  color: ${({ $mine }) => ($mine ? 'var(--heading)' : 'var(--text)')};
  font-weight: ${({ $mine }) => ($mine ? 600 : 400)};
  background: ${({ $mine }) => ($mine ? 'rgba(var(--accent-rgb), 0.08)' : 'transparent')};

  &:nth-child(-n + 3) > span:first-child {
    color: var(--accent);
  }
`;

const Dot = styled.span`
  width: 10px;
  height: 10px;
  border-radius: 2px;
`;

const BoardName = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export default InvaderGame;
