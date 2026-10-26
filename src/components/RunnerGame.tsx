import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { FiPlay, FiFlag, FiAward } from 'react-icons/fi';
import { FaCrown, FaGhost } from 'react-icons/fa';
import {
  HEIGHT,
  GROUND_Y,
  PLAYER_X,
  COIN_SIZE,
  Coin,
  Obstacle,
  Runner,
  BOSS_FROM,
  BOSS_TO,
  BOMB_DROP_AHEAD,
  MAGNET_LENGTH,
  MODIFIER_LABELS,
  Modifier,
  POWER_SIZE,
  PowerUp,
  SLOW_LENGTH,
  bombHeight,
  modifierForDay,
  ensureCourse,
  newRunner,
  pressJump,
  releaseJump,
  step,
  scoreOf,
  speedAt,
} from './runner/engine';
import {
  connect,
  cleanName,
  colorFor,
  defaultName,
  getDeviceId,
  loadName,
  saveName,
  MAX_NAME_LENGTH,
  NetMessage,
  PeerMeta,
  PlayerStatus,
  Transport,
  todayKey,
} from './runner/net';
import { BoardState, Leaderboard, openApiLeaderboard, openLeaderboard, TOP_N } from './runner/leaderboard';
import { BoardScope, ChallengeRun, apiEnabled, challengeIdFromUrl, fetchRun, submitRun } from './runner/api';
import { PRESS, RELEASE, createTapePlayer, dtToUnits, quantizeDt, seedForDay } from './runner/tape';
import { BotSprite, botFor, botForPlayer } from './runner/sprite';
import { COINS_FOR_FRAGMENT, find, isComplete } from '../hunt/hunt';
import { HATS, addCoins, loadCosmetics, rainbowColor } from './runner/cosmetics';
import Shop from './runner/Shop';
import { currentStreak, loadBestRun, saveBestRun, loadStreak, recordPlay } from './runner/personal';

// A tiny endless runner: a pixel invader hops over posts and dodges drones.
// Space / ↑ / click / tap to jump, hold for a higher jump, press again mid-air to double jump.
// Further along, pits open in the ground, the lights go out (500–800) and the screen starts
// to glitch (1000+). Coins float above obstacles: they don't score, but the hunt counts them.
// Everyone plays the same course each day, so other visitors' bots show up alongside yours;
// the Race button lines everyone up for a synchronised start.
// Solo runs are recorded as tapes (see runner/tape.ts): with the score server on, each finished
// run is submitted and replayed there; a share link (?run=<id>) plays that run as a ghost.

const HIGH_SCORE_KEY = 'runner-high-score';
const COUNTDOWN_MS = 3000;
const STATE_INTERVAL_MS = 100; // position updates/s to other players: 10
const STALE_MS = 3000; // a player we haven't heard from in this long is out
const FORGET_MS = 6000; // …and is removed from the screen after this long
const FONT = '"SF Mono", ui-monospace, Menlo, monospace';
const CHALLENGE_ID = 'challenge'; // ghost id for the recorded run racing alongside a solo run
const COIN_COLOR = '#f2b705';
const GOLD = 'hsl(45, 80%, 58%)'; // the finished treasure hunt turns your bot gold
const LIGHTS_OUT = { from: 500, to: 800, fade: 30 }; // scores
const GLITCH_FROM = 1000;
const BANNER_LENGTH = 30; // scores a phase announcement stays up
const LIGHT_RADIUS = 130;
const FOG = 0.8; // Foggy Saturday: how far the lights are down all run
const POWER_COLORS = { shield: '#38bdf8', magnet: '#f43f5e', slow: '#a78bfa' };
const POWER_LETTERS = { shield: 'S', magnet: 'M', slow: 'T' };
const BOSS_W = 120;
const BOSS_BANNER = 20; // scores before/after the boss its banners show

type Phase = 'idle' | 'countdown' | 'running' | 'over';

interface Ghost {
  id: string;
  color: string;
  seed: number;
  raceId: string | null;
  y: number;
  d: number;
  alive: boolean;
  go: boolean;
  heardAt: number;
}

interface Placing {
  name: string;
  color: string;
  score: number;
  you: boolean;
}

interface Game {
  phase: Phase;
  mode: 'solo' | 'race';
  runner: Runner;
  seed: number;
  raceId: string | null;
  countdownEnd: number;
  ghosts: Map<string, Ghost>;
  results: Placing[] | null;
  lastSent: number;
  highScore: number;
  day: string; // the course being played
  tape: number[] | null; // recording of the current solo run
  elapsed: number; // seconds since the solo run started (drives the challenge ghost)
  challenge: ReturnType<typeof createTapePlayer> | null;
  ghostName: string; // who the challenge ghost is: a shared run, a board entry, or your own best
  ghostColor: string;
  mod: Modifier; // today's modifier
  bossAnnounced: boolean;
}

interface FinishedRun {
  score: number;
  rank: number | null; // today's rank, once the score server has confirmed the run
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

const pad = (n: number) => String(Math.min(n, 99999)).padStart(4, '0');
// One course per UTC day, shared by every visitor.
const courseSeed = () => seedForDay(todayKey());
const courseMod = () => modifierForDay(todayKey());
const ordinal = (n: number) => ['1st', '2nd', '3rd'][n] ?? `${n + 1}th`;
const prefersReducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// How far the lights are down at a score: 0 = fully lit, 1 = only a circle around the player.
const darkness = (score: number) => {
  const { from, to, fade } = LIGHTS_OUT;
  if (score < from || score >= to) return 0;
  return Math.min(1, (score - from) / fade, (to - score) / fade);
};

const RunnerGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const colorsRef = useRef({ text: '#888', heading: '#ccc', border: '136, 146, 176' });
  const drawRef = useRef<() => void>(() => {});
  const startRaceRef = useRef<() => void>(() => {});
  const announceRef = useRef<() => void>(() => {});
  const leaderboardRef = useRef<Leaderboard | null>(null);
  const [board, setBoard] = useState<BoardState | null>(null);
  const [boardScope, setBoardScope] = useState<BoardScope>('today');
  const [lastRun, setLastRun] = useState<FinishedRun | null>(null);
  const [challenge, setChallenge] = useState<ChallengeRun | null>(null);
  const challengeRef = useRef<ChallengeRun | null>(null);
  // Colour and name are per device; the id is per tab so two tabs on one computer can still race.
  const [me] = useState(() => {
    const deviceId = getDeviceId();
    const color = isComplete() ? GOLD : colorFor(deviceId);
    return { id: `${deviceId}-${Math.random().toString(36).slice(2, 6)}`, deviceId, color, bot: botFor(deviceId) };
  });
  const [name, setName] = useState(() => loadName(me.deviceId));
  const [nameDraft, setNameDraft] = useState(name);
  const nameRef = useRef(name);
  const [peers, setPeers] = useState<PeerMeta[]>([]);
  const [cosmetics, setCosmetics] = useState(loadCosmetics);
  const cosmeticsRef = useRef(cosmetics);
  cosmeticsRef.current = cosmetics;
  const [streak, setStreak] = useState(loadStreak);
  const [shopOpen, setShopOpen] = useState(false);
  const [myStatus, setMyStatus] = useState<PlayerStatus>('idle');

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

    const game: Game = {
      phase: 'idle',
      mode: 'solo',
      runner: newRunner(courseSeed(), courseMod()),
      seed: courseSeed(),
      raceId: null,
      countdownEnd: 0,
      ghosts: new Map(),
      results: null,
      lastSent: 0,
      highScore: readHighScore(),
      day: todayKey(),
      tape: null,
      elapsed: 0,
      challenge: null,
      ghostName: '',
      ghostColor: '#888',
      mod: courseMod(),
      bossAnnounced: false,
    };
    let width = 0;
    let frame = 0;
    let last = 0;
    let visible = true;
    let transport: Transport | null = null;
    let closed = false;
    let lobby = new Map<string, PeerMeta>();
    const reducedMotion = prefersReducedMotion();
    const nameOf = (id: string) =>
      lobby.get(id)?.name ?? (id === CHALLENGE_ID ? game.ghostName : undefined) ?? 'player';

    // ---- status shared with the lobby -------------------------------------------------

    const statusOf = (): PlayerStatus => {
      if (game.mode === 'race' && (game.phase === 'countdown' || game.phase === 'running')) return 'race';
      if (game.phase === 'running') return 'solo';
      return 'idle';
    };
    const myMeta = (): PeerMeta => ({ id: me.id, name: nameRef.current, color: me.color, status: statusOf() });
    let lastStatus: PlayerStatus = 'idle';
    const syncStatus = () => {
      const status = statusOf();
      if (status === lastStatus) return;
      lastStatus = status;
      setMyStatus(status);
      transport?.update(myMeta());
    };
    announceRef.current = () => {
      transport?.update(myMeta());
      draw();
    };

    // ---- drawing ----------------------------------------------------------------------

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

    // Everyone on today's course shares its bot size (a tiny bot on Wednesdays).
    const px = () => game.runner.physics.pixel;
    const botW = () => game.runner.w;
    const botH = () => game.runner.h;
    const mirrored = () => game.mod === 'mirror';

    // Text inside the (possibly mirrored) world, kept readable: drawn un-flipped at the
    // mirrored spot, with left/right alignment swapped to match.
    const worldText = (label: string, x: number, y: number) => {
      if (!mirrored()) {
        ctx.fillText(label, x, y);
        return;
      }
      const align = ctx.textAlign;
      ctx.save();
      ctx.scale(-1, 1);
      if (align === 'left') ctx.textAlign = 'right';
      else if (align === 'right') ctx.textAlign = 'left';
      ctx.fillText(label, -x, y);
      ctx.restore();
    };

    const drawSprite = (x: number, y: number, bot: BotSprite, color: string, legFrame: number, alpha: number) => {
      const p = px();
      const top = GROUND_Y - botH() - y;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      bot.frames[legFrame].forEach((row, r) => {
        for (let c = 0; c < row.length; c++) {
          if (row[c] === 'X') ctx.fillRect(x + c * p, top + r * p, p, p);
        }
      });
      ctx.globalAlpha = 1;
    };

    // Your cosmetics (see runner/cosmetics.ts): a trail behind, a hat on top. Only you see them.
    const drawTrail = (x: number, y: number, trail: string, alpha: number) => {
      const p = px();
      const top = GROUND_Y - botH() - y;
      ctx.globalAlpha = alpha * 0.8;
      if (trail === 'rainbow') {
        for (let i = 0; i < 6; i++) {
          ctx.fillStyle = rainbowColor(i);
          ctx.fillRect(x - 36, top + p + i * (p * 0.7), 34, p * 0.7);
        }
      } else {
        const d = game.runner.distance;
        for (let i = 0; i < 6; i++) {
          const k = Math.floor(d / 30) + i;
          ctx.fillStyle = i % 2 ? '#fde68a' : '#ffffff';
          ctx.fillRect(x - 8 - i * 7, top + ((k * 37) % (botH() - 4)), 3, 3);
        }
      }
      ctx.globalAlpha = 1;
    };

    const drawHat = (x: number, y: number, hatId: keyof typeof HATS, alpha: number) => {
      const hat = HATS[hatId];
      const p = px();
      const top = GROUND_Y - botH() - y - hat.rows.length * p;
      ctx.globalAlpha = alpha;
      hat.rows.forEach((row, r) => {
        for (let c = 0; c < row.length; c++) {
          const color = hat.palette[row[c]];
          if (!color) continue;
          ctx.fillStyle = color;
          ctx.fillRect(x + c * p, top + r * p, p, p);
        }
      });
      ctx.globalAlpha = 1;
    };

    const drawPowerUp = (pu: PowerUp, x: number, t: number) => {
      const cy = GROUND_Y - pu.h + Math.sin(t / 200 + pu.at) * 2;
      const half = POWER_SIZE / 2;
      ctx.fillStyle = POWER_COLORS[pu.kind];
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x - half, cy - half, POWER_SIZE, POWER_SIZE, 4);
      else ctx.rect(x - half, cy - half, POWER_SIZE, POWER_SIZE);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 9px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      worldText(POWER_LETTERS[pu.kind], x, cy + 0.5);
    };

    // The boss: a big drone hovering ahead of you, bobbing, with an angry red eye.
    const drawBoss = (x: number, t: number, heading: string) => {
      const y = 58 + Math.sin(t / 300) * 4; // below the score, above the bombs' landing spots
      ctx.fillStyle = heading;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y + 8, BOSS_W, 22, 8);
      else ctx.rect(x, y + 8, BOSS_W, 22);
      ctx.fill();
      const spin = Math.abs(Math.sin(t / 40)) * 24 + 6;
      ctx.fillRect(x + 18 - spin / 2, y, spin, 3);
      ctx.fillRect(x + BOSS_W - 18 - spin / 2, y, spin, 3);
      ctx.fillRect(x + 16, y + 2, 4, 7);
      ctx.fillRect(x + BOSS_W - 20, y + 2, 4, 7);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(x + BOSS_W / 2 - 6, y + 14, 12, 8);
    };

    const drawBomb = (o: Obstacle, x: number, camera: number, heading: string) => {
      const lift = bombHeight(o, camera);
      const cy = GROUND_Y - o.top / 2 - lift;
      ctx.fillStyle = heading;
      ctx.beginPath();
      ctx.arc(x + o.w / 2, cy, o.w / 2 + 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x + o.w / 2 - 1, cy - o.w / 2 - 6, 2, 5);
      ctx.fillStyle = '#f97316';
      ctx.fillRect(x + o.w / 2 - 2, cy - o.w / 2 - 9, 4, 4);
    };

    // A gap in the ground line with a faint shaft below it.
    const drawPit = (o: Obstacle, x: number, heading: string, border: string) => {
      ctx.clearRect(x, GROUND_Y - 1, o.w, HEIGHT - GROUND_Y + 1);
      ctx.fillStyle = `rgba(${border}, 0.1)`;
      ctx.fillRect(x, GROUND_Y, o.w, HEIGHT - GROUND_Y);
      ctx.fillStyle = heading;
      ctx.fillRect(x, GROUND_Y, 2, 10);
      ctx.fillRect(x + o.w - 2, GROUND_Y, 2, 10);
    };

    // A spinning pixel coin: its width breathes to fake the turn.
    const drawCoin = (c: Coin, x: number, t: number) => {
      const turn = Math.abs(Math.cos(t / 180 + c.at));
      const w = Math.max(2, COIN_SIZE * turn);
      const cy = GROUND_Y - c.h;
      ctx.fillStyle = COIN_COLOR;
      ctx.fillRect(x - w / 2, cy - COIN_SIZE / 2, w, COIN_SIZE);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      if (w > 5) ctx.fillRect(x - w / 2 + 2, cy - COIN_SIZE / 2 + 2, 2, COIN_SIZE - 6);
    };

    const drawObstacle = (o: Obstacle, x: number, heading: string, t: number) => {
      ctx.fillStyle = heading;
      const top = GROUND_Y - o.top;
      const h = o.top - o.bottom;
      if (o.kind === 'drone-low' || o.kind === 'drone-high') {
        // Hovering drone: body plus two spinning rotors.
        const bob = Math.sin(t / 120 + o.at) * 1.5;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, top + 4 + bob, o.w, h - 4, 4);
        else ctx.rect(x, top + 4 + bob, o.w, h - 4);
        ctx.fill();
        const spin = Math.abs(Math.sin(t / 40)) * 7 + 2;
        ctx.fillRect(x + 5 - spin / 2, top + bob, spin, 2);
        ctx.fillRect(x + o.w - 5 - spin / 2, top + bob, spin, 2);
        ctx.fillRect(x + 4, top + 1 + bob, 2, 4);
        ctx.fillRect(x + o.w - 6, top + 1 + bob, 2, 4);
        return;
      }
      ctx.beginPath();
      if (o.kind === 'wide' && ctx.roundRect) {
        ctx.roundRect(x, top, 20, h, [6, 6, 0, 0]);
        ctx.roundRect(x + o.w - 20, top, 20, h, [6, 6, 0, 0]);
        ctx.rect(x + 18, top + 10, o.w - 36, 6);
      } else if (ctx.roundRect) {
        ctx.roundRect(x, top, o.w, h, [6, 6, 0, 0]);
      } else {
        ctx.rect(x, top, o.w, h);
      }
      ctx.fill();
    };

    // Off-screen players: an arrow at the edge just above the ground (kept clear of the score).
    const drawEdgeMarker = (side: 'left' | 'right', slot: number, color: string, label: string) => {
      const x = side === 'right' ? width - 10 : 10;
      const dir = side === 'right' ? 1 : -1;
      const cy = GROUND_Y - botH() / 2 - slot * 18;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x + dir * 6, cy);
      ctx.lineTo(x - dir * 4, cy - 7);
      ctx.lineTo(x - dir * 4, cy + 7);
      ctx.fill();
      ctx.font = `11px ${FONT}`;
      ctx.textAlign = side === 'right' ? 'right' : 'left';
      ctx.textBaseline = 'middle';
      worldText(label, x - dir * 8, cy);
    };

    // Name tag centred above a bot.
    const drawNameTag = (x: number, y: number, label: string, color: string, alpha: number) => {
      ctx.globalAlpha = alpha;
      ctx.font = `10px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = color;
      worldText(label, x + botW() / 2, GROUND_Y - botH() - y - 4);
      ctx.globalAlpha = 1;
    };

    const centerText = (msg: string, y: number, size = 13, color = colorsRef.current.text, weight = '') => {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `${weight} ${size}px ${FONT}`;
      ctx.fillStyle = color;
      ctx.fillText(msg, width / 2, y);
    };

    const racers = () => Array.from(game.ghosts.values()).filter((g) => g.raceId === game.raceId);
    // Other players on the same course as us (everyone, unless the day rolled over mid-run).
    const visibleGhosts = () => Array.from(game.ghosts.values()).filter((g) => g.seed === game.seed);

    const cameraDistance = () => {
      const r = game.runner;
      if (game.mode !== 'race' || r.alive || game.phase !== 'running') return r.distance;
      // Out of the race: follow whoever is leading.
      let lead = r.distance;
      racers().forEach((g) => {
        if (g.alive) lead = Math.max(lead, g.d);
      });
      return lead;
    };

    const draw = () => {
      const { text, heading, border } = colorsRef.current;
      const r = game.runner;
      const t = performance.now();
      const camera = cameraDistance();
      const racing = game.mode === 'race';
      if (camera !== r.distance) ensureCourse(r, camera);
      ctx.clearRect(0, 0, width, HEIGHT);

      // Mirror Tuesday: the whole world is drawn flipped, so you run right to left.
      ctx.save();
      if (mirrored()) {
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
      }

      ctx.fillStyle = `rgba(${border}, 0.45)`;
      ctx.fillRect(0, GROUND_Y, width, 2);

      const cameraScore = scoreOf(camera);
      const inRun = game.phase === 'running' || game.phase === 'over';
      if (game.phase === 'running' && cameraScore >= BOSS_FROM - BOSS_BANNER && cameraScore < BOSS_TO + BOSS_BANNER) {
        // Flies in from the right, hovers over where its bombs drop, then leaves.
        const enter = Math.min(1, (cameraScore - (BOSS_FROM - BOSS_BANNER)) / BOSS_BANNER);
        const leave = Math.max(0, (cameraScore - BOSS_TO) / BOSS_BANNER);
        const home = PLAYER_X + BOMB_DROP_AHEAD - BOSS_W / 2;
        drawBoss(home + (1 - enter) * width + leave * width, t, heading);
      }

      for (const o of r.obstacles) {
        const x = PLAYER_X + o.at - camera;
        if (x >= width || x + o.w <= 0) continue;
        if (o.kind === 'pit') drawPit(o, x, heading, border);
        else if (o.kind === 'bomb') drawBomb(o, x, camera, heading);
        else drawObstacle(o, x, heading, t);
      }
      for (const c of r.coins) {
        const x = PLAYER_X + c.at - camera;
        if (!c.taken && x > -COIN_SIZE && x < width + COIN_SIZE) drawCoin(c, x, t);
      }
      for (const pu of r.powerUps) {
        const x = PLAYER_X + pu.at - camera;
        if (!pu.taken && x > -POWER_SIZE && x < width + POWER_SIZE) drawPowerUp(pu, x, t);
      }

      const slots = { left: 0, right: 0 };
      visibleGhosts().forEach((g) => {
        const x = PLAYER_X + g.d - camera;
        const gap = scoreOf(Math.abs(g.d - r.distance));
        const label = nameOf(g.id);
        if (x > width) drawEdgeMarker('right', slots.right++, g.color, `${label} +${gap}`);
        else if (x + botW() < 0) drawEdgeMarker('left', slots.left++, g.color, `-${gap} ${label}`);
        else {
          const alpha = g.alive ? 0.55 : 0.2;
          drawSprite(x, g.y, botForPlayer(g.id), g.color, g.alive && g.go ? Math.floor(g.d / 40) % 2 : 0, alpha);
          drawNameTag(x, g.y, label, g.color, Math.min(1, alpha + 0.3));
        }
      });

      const myX = PLAYER_X + r.distance - camera;
      const legFrame = game.phase === 'running' && r.alive && r.y === 0 ? Math.floor(r.distance / 40) % 2 : 0;
      const myAlpha = r.alive || !racing ? 1 : 0.3;
      // Out over a pit: sink into it.
      const centre = r.distance + r.w / 2;
      const fell = !r.alive && r.y === 0 && r.obstacles.some((o) => o.kind === 'pit' && centre > o.at && centre < o.at + o.w);
      const myY = fell ? -r.h / 2 : r.y;
      const looks = cosmeticsRef.current;
      if (looks.trail && game.phase === 'running' && r.alive) drawTrail(myX, myY, looks.trail, myAlpha);
      drawSprite(myX, myY, me.bot, me.color, legFrame, myAlpha);
      if (looks.hat) drawHat(myX, myY, looks.hat, myAlpha);
      if (r.shield && r.alive) {
        ctx.strokeStyle = POWER_COLORS.shield;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.6 + Math.sin(t / 150) * 0.2;
        ctx.beginPath();
        ctx.arc(myX + r.w / 2, GROUND_Y - myY - r.h / 2, r.w * 0.75, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      drawNameTag(myX, myY, nameRef.current, heading, myAlpha);
      ctx.restore();

      // Phases: lights out, then glitches. Only for the player's own run, not while idle.
      const score = scoreOf(r.distance);
      const dark = inRun ? Math.max(darkness(score), game.mod === 'fog' ? FOG : 0) : 0;
      if (dark > 0) {
        // Erase everything outside a circle of light around the player.
        const worldX = myX + r.w / 2;
        const cx = mirrored() ? width - worldX : worldX;
        const cy = GROUND_Y - myY - r.h / 2;
        const radius = LIGHT_RADIUS + (1 - dark) * width;
        const light = ctx.createRadialGradient(cx, cy, radius * 0.5, cx, cy, radius);
        light.addColorStop(0, 'rgba(0, 0, 0, 0)');
        light.addColorStop(1, `rgba(0, 0, 0, ${0.97 * dark})`);
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = light;
        ctx.fillRect(0, 0, width, HEIGHT);
        ctx.restore();
      }
      if (inRun && game.phase === 'running' && score >= GLITCH_FROM && !reducedMotion && Math.random() < 0.25) {
        // Shift a few horizontal strips sideways (drawn from the canvas onto itself).
        const dpr = canvas.width / width;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        for (let i = 0; i < 3; i++) {
          const y = Math.floor(Math.random() * HEIGHT);
          const h = 2 + Math.floor(Math.random() * 10);
          const shift = (Math.random() - 0.5) * 24;
          ctx.drawImage(canvas, 0, y * dpr, canvas.width, h * dpr, shift * dpr, y * dpr, canvas.width, h * dpr);
        }
        ctx.restore();
      }

      // Coins this run, then any power-ups in effect
      if (inRun && r.collected > 0) {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.font = `600 13px ${FONT}`;
        ctx.fillStyle = COIN_COLOR;
        ctx.fillRect(16, 18, 9, 9);
        ctx.fillText(String(r.collected).padStart(2, '0'), 31, 16);
      }
      if (inRun && r.alive) {
        const effects: { kind: keyof typeof POWER_COLORS; left: number }[] = [];
        if (r.shield) effects.push({ kind: 'shield', left: 1 });
        if (r.distance < r.magnetUntil) effects.push({ kind: 'magnet', left: (r.magnetUntil - r.distance) / MAGNET_LENGTH });
        if (r.distance < r.slowUntil) effects.push({ kind: 'slow', left: (r.slowUntil - r.distance) / SLOW_LENGTH });
        effects.forEach((e, i) => {
          const x = 16 + i * 24;
          ctx.fillStyle = POWER_COLORS[e.kind];
          ctx.fillRect(x, 36, 18, 12);
          ctx.fillStyle = '#ffffff';
          ctx.font = `700 9px ${FONT}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(POWER_LETTERS[e.kind], x + 9, 42.5);
          ctx.fillStyle = POWER_COLORS[e.kind];
          ctx.fillRect(x, 50, 18 * e.left, 2);
        });
      }

      // Score
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.font = `600 15px ${FONT}`;
      const scoreText = pad(scoreOf(r.distance));
      ctx.fillStyle = heading;
      ctx.fillText(scoreText, width - 16, 16);
      const scoreW = ctx.measureText(scoreText).width;
      ctx.font = `15px ${FONT}`;
      ctx.fillStyle = text;
      ctx.fillText('Score ', width - 16 - scoreW, 16);
      if (game.highScore > 0) {
        ctx.font = `12px ${FONT}`;
        ctx.fillText(`HI ${pad(game.highScore)}`, width - 16, 38);
      }

      // Overlays
      if (game.phase === 'idle') {
        centerText('Press Space or tap to play', 56);
        centerText('hold = higher jump · press again mid-air = double jump', 76, 11);
      } else if (game.phase === 'countdown') {
        const n = Math.max(1, Math.ceil((game.countdownEnd - t) / 1000));
        centerText(String(n), 62, 34, heading, '700');
        centerText(`Race with ${racers().length + 1} players`, 92, 11);
      } else if (game.phase === 'running' && racing && !r.alive) {
        centerText('Out! Watching the leader…', 56);
      } else if (game.phase === 'running' && score >= LIGHTS_OUT.from && score < LIGHTS_OUT.from + BANNER_LENGTH) {
        centerText('LIGHTS OUT', 56, 15, heading, '700');
      } else if (game.phase === 'running' && score >= GLITCH_FROM && score < GLITCH_FROM + BANNER_LENGTH) {
        centerText('SYSTEM GLITCH', 56, 15, heading, '700');
      } else if (game.phase === 'running' && score >= BOSS_FROM - BOSS_BANNER && score < BOSS_FROM) {
        centerText('BOSS INCOMING', 76, 15, heading, '700');
      } else if (game.phase === 'running' && score >= BOSS_TO && score < BOSS_TO + BOSS_BANNER) {
        centerText('BOSS DEFEATED', 76, 15, heading, '700');
      } else if (game.phase === 'over' && game.results) {
        game.results.slice(0, 4).forEach((p, i) => {
          const y = 22 + i * 18;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.font = `${p.you ? '700 ' : ''}13px ${FONT}`;
          ctx.fillStyle = p.color;
          ctx.fillRect(width / 2 - 70, y - 5, 10, 10);
          ctx.fillStyle = p.you ? heading : text;
          ctx.fillText(`${ordinal(i)}  ${p.name.padEnd(MAX_NAME_LENGTH)}  ${pad(p.score)}`, width / 2 - 52, y);
        });
        centerText('Press Space or tap to play again', 22 + Math.min(game.results.length, 4) * 18 + 8, 11);
      } else if (game.phase === 'over' && score === 404) {
        centerText('404: score not found', 50, 15, heading, '700');
        centerText('press Space or tap to retry', 72, 11);
      } else if (game.phase === 'over') {
        centerText('Game over · press Space or tap to retry', 56);
      }
    };
    drawRef.current = draw;

    // ---- game flow --------------------------------------------------------------------

    const sendState = (now: number) => {
      if (!transport) return;
      game.lastSent = now;
      const r = game.runner;
      transport.send({
        t: 'state',
        id: me.id,
        seed: game.seed,
        raceId: game.raceId,
        y: Math.round(r.y),
        d: Math.round(r.distance),
        alive: r.alive,
        go: game.phase === 'running',
      });
    };

    const recordScore = () => {
      const score = scoreOf(game.runner.distance);
      if (game.runner.collected >= COINS_FOR_FRAGMENT) find('coins');
      if (score === 404) find('404');
      if (game.runner.collected > 0) setCosmetics(addCoins(game.runner.collected));
      if (score > 0) setStreak(recordPlay(game.day));
      leaderboardRef.current?.report(score);
      if (score > game.highScore) {
        game.highScore = score;
        saveHighScore(score);
      }
      if (game.mode !== 'solo' || score <= 0) return;
      const tape = game.tape;
      game.tape = null;
      if (tape) saveBestRun(game.day, score, tape);
      setLastRun({ score, rank: null });
      if (!apiEnabled || !tape) return;
      submitRun({ day: game.day, deviceId: me.deviceId, name: nameRef.current, color: me.color, tape })
        .then((res) => {
          setLastRun((cur) => (cur && cur.score === score ? { score, rank: res.rank } : cur));
          leaderboardRef.current?.refresh?.();
        })
        .catch(() => {});
    };

    const finishRace = () => {
      const placings: Placing[] = [
        { name: nameRef.current, color: me.color, score: scoreOf(game.runner.distance), you: true },
      ];
      racers().forEach((g) => placings.push({ name: nameOf(g.id), color: g.color, score: scoreOf(g.d), you: false }));
      game.results = placings.sort((a, b) => b.score - a.score);
      game.phase = 'over';
    };

    const tick = (dt: number, now: number) => {
      const r = game.runner;
      if (game.phase === 'countdown') {
        if (now >= game.countdownEnd) game.phase = 'running';
      } else if (game.phase === 'running') {
        const wasAlive = r.alive;
        if (game.tape && r.alive) game.tape.push(dtToUnits(dt));
        step(r, dt);
        if (wasAlive && !r.alive) {
          recordScore();
          sendState(now); // tell everyone right away that we're out
          if (game.mode === 'solo') game.phase = 'over';
        }
      }

      game.ghosts.forEach((g, id) => {
        if (now - g.heardAt > FORGET_MS) game.ghosts.delete(id);
        else if (now - g.heardAt > STALE_MS) g.alive = false;
        // Extrapolate between network updates so other players move smoothly.
        else if (g.alive && g.go) g.d += speedAt(g.d, game.runner.physics.startSpeed) * dt;
      });

      // The challenger's recorded run, replayed in step with ours (it keeps going after we're out).
      if (game.challenge && game.mode === 'solo' && game.phase !== 'idle') {
        const ghost = game.challenge.runner;
        if (ghost.alive) {
          game.elapsed += dt;
          game.challenge.advanceTo(game.elapsed);
          game.ghosts.set(CHALLENGE_ID, {
            id: CHALLENGE_ID,
            color: game.ghostColor,
            seed: game.seed,
            raceId: CHALLENGE_ID,
            y: ghost.y,
            d: ghost.distance,
            alive: ghost.alive,
            go: true,
            heardAt: now,
          });
        }
      }

      if (r.bossBeaten && !game.bossAnnounced) {
        game.bossAnnounced = true;
        find('boss');
      }

      const playing = game.phase === 'countdown' || game.phase === 'running';
      if (playing && game.runner.alive && now - game.lastSent > STATE_INTERVAL_MS) sendState(now);
      if (game.mode === 'race' && game.phase === 'running' && !r.alive && racers().every((g) => !g.alive)) {
        finishRace();
      }
      syncStatus();
    };

    const loop = (now: number) => {
      // Rounded to the tape's resolution, so a recorded run replays exactly.
      const dt = last ? quantizeDt(Math.min((now - last) / 1000, 1 / 30)) : 0;
      last = now;
      // Keep animating while we play, or while other players are on screen.
      const active = game.phase === 'countdown' || game.phase === 'running' || game.ghosts.size > 0;
      if (visible && active) {
        tick(dt, now);
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

    const startSolo = () => {
      const day = todayKey();
      const seed = seedForDay(day);
      const mod = modifierForDay(day);
      const rival = challengeRef.current;
      // A challenge from today's course plays alongside as a ghost; otherwise your own best today.
      const best = loadBestRun(day);
      const ghost =
        rival?.tape && rival.day === day
          ? { tape: rival.tape, name: rival.name, color: rival.color }
          : best
            ? { tape: best.tape, name: 'your best', color: `rgb(${colorsRef.current.border})` }
            : null;
      game.ghosts.delete(CHALLENGE_ID);
      Object.assign(game, {
        phase: 'running',
        mode: 'solo',
        runner: newRunner(seed, mod),
        seed,
        day,
        mod,
        raceId: null,
        results: null,
        tape: [],
        elapsed: 0,
        challenge: ghost ? createTapePlayer(seed, ghost.tape, mod) : null,
        ghostName: ghost?.name ?? '',
        ghostColor: ghost?.color ?? '#888',
        bossAnnounced: false,
      });
      setLastRun(null);
      syncStatus();
      startLoop();
    };

    const beginRace = (raceId: string, seed: number) => {
      Object.assign(game, {
        phase: 'countdown',
        mode: 'race',
        runner: newRunner(seed, modifierForDay(todayKey())),
        seed,
        mod: modifierForDay(todayKey()),
        bossAnnounced: false,
        raceId,
        countdownEnd: performance.now() + COUNTDOWN_MS,
        results: null,
        lastSent: 0,
        day: todayKey(),
        tape: null,
        challenge: null,
      });
      game.ghosts.delete(CHALLENGE_ID);
      syncStatus();
      startLoop();
    };

    startRaceRef.current = () => {
      if (!transport || statusOf() !== 'idle') return;
      const raceId = Math.random().toString(36).slice(2, 10);
      const seed = courseSeed();
      transport.send({ t: 'race', raceId, seed, from: me.id });
      beginRace(raceId, seed);
      stage.focus();
    };

    const onNetMessage = (msg: NetMessage) => {
      if (msg.t === 'race') {
        // Join automatically unless we're busy playing or not looking at the game.
        if (statusOf() !== 'idle' || !visible) return;
        beginRace(msg.raceId, msg.seed);
      } else if (msg.t === 'state' && msg.id !== me.id) {
        const known = game.ghosts.get(msg.id);
        const color = known?.color ?? lobby.get(msg.id)?.color ?? colorFor(msg.id);
        const { seed, raceId, y, d, alive, go } = msg;
        game.ghosts.set(msg.id, { id: msg.id, color, seed, raceId, y, d, alive, go, heardAt: performance.now() });
        startLoop();
      }
    };

    // Join the lobby the first time the game scrolls into view, so visitors who never reach
    // it don't download the network client or connect at all.
    let joined = false;
    const join = () => {
      if (joined) return;
      joined = true;
      leaderboardRef.current = apiEnabled
        ? openApiLeaderboard({ deviceId: me.deviceId }, setBoard)
        : openLeaderboard({ deviceId: me.deviceId, name: nameRef.current, color: me.color }, setBoard);
      connect(myMeta(), {
        onPeers: (list) => {
          lobby = new Map(list.map((p) => [p.id, p]));
          setPeers(list);
          draw();
        },
        onMessage: onNetMessage,
      }).then((t) => {
        if (closed) t?.close();
        else transport = t;
      });
    };

    // ---- input ------------------------------------------------------------------------

    const press = () => {
      if (game.phase === 'idle' || game.phase === 'over') startSolo();
      else if (game.phase === 'running') {
        if (game.tape && game.runner.alive) game.tape.push(PRESS);
        pressJump(game.runner);
      }
    };
    const release = () => {
      if (game.phase === 'running' && game.tape && game.runner.alive) game.tape.push(RELEASE);
      releaseJump(game.runner);
    };

    const isJumpKey = (e: KeyboardEvent) => e.code === 'Space' || e.code === 'ArrowUp';
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isJumpKey(e)) return;
      e.preventDefault();
      if (!e.repeat) press();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (isJumpKey(e)) release();
    };
    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      stage.focus();
      press();
    };

    // Pause when scrolled out of view or the tab is hidden; resume on return.
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && !document.hidden;
      if (entry.isIntersecting) join();
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
    stage.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    document.addEventListener('visibilitychange', onVisibility);
    resize();

    return () => {
      closed = true;
      transport?.close();
      leaderboardRef.current?.close();
      leaderboardRef.current = null;
      cancelAnimationFrame(frame);
      observer.disconnect();
      resizeObserver.disconnect();
      stage.removeEventListener('keydown', onKeyDown);
      stage.removeEventListener('keyup', onKeyUp);
      stage.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [me]);

  // A share link (?run=<id>) loads that run: shown as a challenge, and as a ghost on today's course.
  useEffect(() => {
    const id = challengeIdFromUrl();
    if (!apiEnabled || !id) return;
    let cancelled = false;
    fetchRun(id)
      .then((run) => {
        if (cancelled || !run) return;
        challengeRef.current = run;
        setChallenge(run);
        stageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    leaderboardRef.current?.setScope?.(boardScope);
  }, [boardScope]);

  // Race a leaderboard run's ghost on your next solo run.
  const raceGhost = (runId: string) => {
    fetchRun(runId)
      .then((run) => {
        if (!run) return;
        challengeRef.current = run;
        setChallenge(run);
        stageRef.current?.focus();
        stageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      })
      .catch(() => {});
  };

  const ready = peers.filter((p) => p.status === 'idle').length;

  const today = todayKey();

  const commitName = () => {
    const next = cleanName(nameDraft) || defaultName(me.deviceId);
    setNameDraft(next);
    if (next === name) return;
    setName(next);
    nameRef.current = next;
    saveName(next);
    announceRef.current();
    leaderboardRef.current?.setIdentity(next, me.color);
  };

  return (
    <Wrapper>
      <Heading>
        <FiPlay />
        Take a break
        <ModChip title="Today's twist, the same for everyone. Changes at 00:00 UTC.">{MODIFIER_LABELS[modifierForDay(today)]}</ModChip>
      </Heading>
      {challenge && (
        <ChallengeBanner>
          <Dot style={{ background: challenge.color }} aria-hidden="true" />
          <span>
            <strong>{challenge.name}</strong> challenged you to beat <strong>{pad(challenge.score)}</strong>
            {challenge.tape && challenge.day === today
              ? ' — their run plays alongside yours as a ghost.'
              : ' — that was an earlier course, so no ghost today.'}
          </span>
        </ChallengeBanner>
      )}
      <Stage
        ref={stageRef}
        tabIndex={0}
        role="application"
        aria-label="Runner game. Press Space or tap to jump; hold for a higher jump, press again mid-air to double jump."
      >
        <canvas ref={canvasRef} aria-hidden="true" />
      </Stage>
      <Lobby>
        <NameField>
          <Dot style={{ background: me.color }} aria-hidden="true" />
          <NameInput
            value={nameDraft}
            maxLength={MAX_NAME_LENGTH}
            aria-label="Your player name"
            spellCheck={false}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') {
                setNameDraft(name);
                e.currentTarget.blur();
              }
            }}
          />
        </NameField>
        {currentStreak(streak, today) >= 2 && (
          <LobbyNote title="Days in a row you've played">🔥 {currentStreak(streak, today)}-day streak</LobbyNote>
        )}
        <ShopButton type="button" onClick={() => setShopOpen((o) => !o)} aria-expanded={shopOpen}>
          ◆ {cosmetics.wallet} · Shop
        </ShopButton>
        {peers.length > 0 && (
          <>
            <LobbyText title={peers.map((p) => p.name).join(', ')}>
              {peers.length} other{peers.length === 1 ? '' : 's'} here
              {ready < peers.length && ` · ${peers.length - ready} playing`}
            </LobbyText>
            <RaceButton type="button" onClick={() => startRaceRef.current()} disabled={ready === 0 || myStatus !== 'idle'}>
              <FiFlag />
              Race
            </RaceButton>
          </>
        )}
      </Lobby>
      {shopOpen && <Shop cosmetics={cosmetics} onChange={setCosmetics} />}
      {lastRun && (
        <ResultText>
          Score {pad(lastRun.score)}
          {lastRun.rank !== null && ` · #${lastRun.rank} today`}
          {challenge && lastRun.score > challenge.score && ` · you beat ${challenge.name}!`}
        </ResultText>
      )}
      <Board aria-labelledby="runner-board-title">
        <BoardHeader>
          <BoardTitle id="runner-board-title">
            <FiAward aria-hidden="true" />
            {apiEnabled ? <>Top {TOP_N}</> : <>Today&apos;s top {TOP_N}</>}
          </BoardTitle>
          {apiEnabled && (
            <ScopeTabs>
              <ScopeButton type="button" aria-pressed={boardScope === 'today'} onClick={() => setBoardScope('today')}>
                Today
              </ScopeButton>
              <ScopeButton type="button" aria-pressed={boardScope === 'all'} onClick={() => setBoardScope('all')}>
                All time
              </ScopeButton>
            </ScopeTabs>
          )}
          {boardScope === 'today' && <BoardNote>resets 00:00 UTC</BoardNote>}
        </BoardHeader>
        {board === null ? (
          <BoardNote as="p">Loading…</BoardNote>
        ) : board.entries.length === 0 ? (
          <BoardNote as="p">{board.scope === 'all' ? 'No scores yet.' : 'No scores yet today.'} Set the first one!</BoardNote>
        ) : (
          <BoardList>
            {board.entries.map((entry, i) => (
              <BoardRow key={entry.deviceId} $mine={entry.deviceId === me.deviceId}>
                <span>{i + 1}</span>
                <Dot style={{ background: entry.color }} aria-hidden="true" />
                <BoardName>
                  {entry.name}
                  {board.champion === entry.deviceId && (
                    <Crown title="Last week's champion" aria-label="Last week's champion" />
                  )}
                </BoardName>
                {apiEnabled && board.scope === 'today' && entry.runId && entry.deviceId !== me.deviceId ? (
                  <GhostButton
                    type="button"
                    onClick={() => raceGhost(entry.runId!)}
                    title={`Race ${entry.name}'s ghost`}
                    aria-label={`Race ${entry.name}'s ghost`}
                  >
                    <FaGhost aria-hidden="true" />
                  </GhostButton>
                ) : (
                  <span />
                )}
                <span>{pad(entry.score)}</span>
              </BoardRow>
            ))}
          </BoardList>
        )}
        {board && board.mine > 0 && !board.entries.some((e) => e.deviceId === me.deviceId) && (
          <BoardNote as="p">
            Your best{board.scope === 'today' ? ' today' : ''}: {pad(board.mine)}
          </BoardNote>
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

const Lobby = styled.div`
  flex-wrap: wrap;
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
  font-family: 'SF Mono', monospace;
  font-size: 12px;
  color: var(--text);
`;

const NameField = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
`;

const NameInput = styled.input`
  width: 15ch;
  min-width: 0;
  padding: 3px 6px;
  font: inherit;
  color: var(--heading);
  background: transparent;
  border: 1px solid transparent;
  border-bottom-color: rgba(var(--border-rgb), 0.4);
  border-radius: 3px;
  transition: border-color 0.2s;

  &:hover {
    border-bottom-color: var(--accent);
  }

  &:focus {
    outline: none;
    border-color: var(--accent);
  }
`;

const Dot = styled.span`
  width: 10px;
  height: 10px;
  border-radius: 2px;
`;

const ModChip = styled.span`
  margin-left: auto;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  letter-spacing: 0.5px;
  text-transform: none;
  color: var(--heading);
  background: rgba(var(--accent-rgb), 0.1);
  border: 1px solid rgba(var(--accent-rgb), 0.3);
`;

const LobbyNote = styled.span`
  white-space: nowrap;
`;

const ShopButton = styled.button`
  padding: 4px 10px;
  font: inherit;
  color: #f2b705;
  background: none;
  border: 1px solid rgba(242, 183, 5, 0.4);
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    border-color: #f2b705;
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
`;

const LobbyText = styled.span`
  flex: 1;
  min-width: 0;
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
  font-weight: 400;
  letter-spacing: 0;
  text-transform: none;
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
  grid-template-columns: 2.5ch 10px 1fr auto auto;
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

const BoardName = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Crown = styled(FaCrown)`
  margin-left: 6px;
  vertical-align: -1px;
  color: ${COIN_COLOR};
`;

const GhostButton = styled.button`
  display: grid;
  place-items: center;
  padding: 2px 4px;
  font-size: 11px;
  color: var(--text);
  background: none;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  opacity: 0.6;

  &:hover,
  &:focus-visible {
    color: var(--accent);
    opacity: 1;
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
  }
`;

const ChallengeBanner = styled.p`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  padding: 10px 14px;
  border-radius: 8px;
  font-family: 'SF Mono', monospace;
  font-size: 12px;
  color: var(--text);
  background: rgba(var(--accent-rgb), 0.08);
  border: 1px solid rgba(var(--accent-rgb), 0.25);

  strong {
    color: var(--heading);
  }

  > span:first-child {
    flex: none;
  }
`;

const ResultText = styled.p`
  margin-top: 12px;
  font-family: 'SF Mono', monospace;
  font-size: 12px;
  color: var(--text);
`;

const ScopeTabs = styled.span`
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  border-radius: 6px;
  background: rgba(var(--border-rgb), 0.12);
  align-self: center;
`;

const ScopeButton = styled.button`
  padding: 2px 8px;
  font: inherit;
  font-size: 11px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: var(--text);
  background: none;
  border: none;
  border-radius: 4px;
  cursor: pointer;

  &[aria-pressed='true'] {
    color: var(--heading);
    background: var(--bg-elevated);
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
`;

const RaceButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  font: inherit;
  color: var(--accent);
  background: none;
  border: 1px solid var(--accent);
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover:not(:disabled) {
    background-color: rgba(var(--accent-rgb), 0.1);
  }

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }

  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
`;

export default RunnerGame;
