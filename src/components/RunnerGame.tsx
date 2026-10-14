import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { FiPlay, FiFlag, FiAward } from 'react-icons/fi';
import {
  HEIGHT,
  GROUND_Y,
  PLAYER_X,
  PLAYER_W,
  PLAYER_H,
  PIXEL,
  Obstacle,
  Runner,
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
import { BoardState, Leaderboard, openLeaderboard, TOP_N } from './runner/leaderboard';

// A tiny endless runner: a pixel invader hops over posts and dodges drones.
// Space / ↑ / click / tap to jump, hold for a higher jump, press again mid-air to double jump.
// Everyone plays the same course each day, so other visitors' bots show up alongside yours;
// the Race button lines everyone up for a synchronised start.

const HIGH_SCORE_KEY = 'runner-high-score';
const COUNTDOWN_MS = 3000;
const STATE_INTERVAL_MS = 100; // position updates/s to other players: 10
const STALE_MS = 3000; // a player we haven't heard from in this long is out
const FORGET_MS = 6000; // …and is removed from the screen after this long
const FONT = '"SF Mono", ui-monospace, Menlo, monospace';

// Two frames so the legs shuffle while running.
const SPRITE_FRAMES = [
  ['.XX....XX.', 'XXXXXXXXXX', 'XX.XXXX.XX', 'XXXXXXXXXX', 'XXXXXXXXXX', 'XX.X..X.XX', 'X........X'],
  ['.XX....XX.', 'XXXXXXXXXX', 'XX.XXXX.XX', 'XXXXXXXXXX', 'XXXXXXXXXX', 'XX.X..X.XX', '.X......X.'],
];

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
const courseSeed = () => {
  const day = todayKey();
  let hash = 0;
  for (let i = 0; i < day.length; i++) hash = (hash * 31 + day.charCodeAt(i)) | 0;
  return hash >>> 0;
};
const ordinal = (n: number) => ['1st', '2nd', '3rd'][n] ?? `${n + 1}th`;

const RunnerGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const colorsRef = useRef({ text: '#888', heading: '#ccc', border: '136, 146, 176' });
  const drawRef = useRef<() => void>(() => {});
  const startRaceRef = useRef<() => void>(() => {});
  const announceRef = useRef<() => void>(() => {});
  const leaderboardRef = useRef<Leaderboard | null>(null);
  const [board, setBoard] = useState<BoardState | null>(null);
  // Colour and name are per device; the id is per tab so two tabs on one computer can still race.
  const [me] = useState(() => {
    const deviceId = getDeviceId();
    return { id: `${deviceId}-${Math.random().toString(36).slice(2, 6)}`, deviceId, color: colorFor(deviceId) };
  });
  const [name, setName] = useState(() => loadName(me.deviceId));
  const [nameDraft, setNameDraft] = useState(name);
  const nameRef = useRef(name);
  const [peers, setPeers] = useState<PeerMeta[]>([]);
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
      runner: newRunner(courseSeed()),
      seed: courseSeed(),
      raceId: null,
      countdownEnd: 0,
      ghosts: new Map(),
      results: null,
      lastSent: 0,
      highScore: readHighScore(),
    };
    let width = 0;
    let frame = 0;
    let last = 0;
    let visible = true;
    let transport: Transport | null = null;
    let closed = false;
    let lobby = new Map<string, PeerMeta>();
    const nameOf = (id: string) => lobby.get(id)?.name ?? 'player';

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

    const drawSprite = (x: number, y: number, color: string, legFrame: number, alpha: number) => {
      const top = GROUND_Y - PLAYER_H - y;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      SPRITE_FRAMES[legFrame].forEach((row, r) => {
        for (let c = 0; c < row.length; c++) {
          if (row[c] === 'X') ctx.fillRect(x + c * PIXEL, top + r * PIXEL, PIXEL, PIXEL);
        }
      });
      ctx.globalAlpha = 1;
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
      const cy = GROUND_Y - PLAYER_H / 2 - slot * 18;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x + dir * 6, cy);
      ctx.lineTo(x - dir * 4, cy - 7);
      ctx.lineTo(x - dir * 4, cy + 7);
      ctx.fill();
      ctx.font = `11px ${FONT}`;
      ctx.textAlign = side === 'right' ? 'right' : 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x - dir * 8, cy);
    };

    // Name tag centred above a bot.
    const drawNameTag = (x: number, y: number, label: string, color: string, alpha: number) => {
      ctx.globalAlpha = alpha;
      ctx.font = `10px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = color;
      ctx.fillText(label, x + PLAYER_W / 2, GROUND_Y - PLAYER_H - y - 4);
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

      ctx.fillStyle = `rgba(${border}, 0.45)`;
      ctx.fillRect(0, GROUND_Y, width, 2);

      for (const o of r.obstacles) {
        const x = PLAYER_X + o.at - camera;
        if (x < width && x + o.w > 0) drawObstacle(o, x, heading, t);
      }

      const slots = { left: 0, right: 0 };
      visibleGhosts().forEach((g) => {
        const x = PLAYER_X + g.d - camera;
        const gap = scoreOf(Math.abs(g.d - r.distance));
        const label = nameOf(g.id);
        if (x > width) drawEdgeMarker('right', slots.right++, g.color, `${label} +${gap}`);
        else if (x + PLAYER_W < 0) drawEdgeMarker('left', slots.left++, g.color, `-${gap} ${label}`);
        else {
          const alpha = g.alive ? 0.55 : 0.2;
          drawSprite(x, g.y, g.color, g.alive && g.go ? Math.floor(g.d / 40) % 2 : 0, alpha);
          drawNameTag(x, g.y, label, g.color, Math.min(1, alpha + 0.3));
        }
      });

      const myX = PLAYER_X + r.distance - camera;
      const legFrame = game.phase === 'running' && r.alive && r.y === 0 ? Math.floor(r.distance / 40) % 2 : 0;
      const myAlpha = r.alive || !racing ? 1 : 0.3;
      drawSprite(myX, r.y, me.color, legFrame, myAlpha);
      drawNameTag(myX, r.y, nameRef.current, heading, myAlpha);

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
      leaderboardRef.current?.report(score);
      if (score > game.highScore) {
        game.highScore = score;
        saveHighScore(score);
      }
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
        else if (g.alive && g.go) g.d += speedAt(g.d) * dt;
      });

      const playing = game.phase === 'countdown' || game.phase === 'running';
      if (playing && game.runner.alive && now - game.lastSent > STATE_INTERVAL_MS) sendState(now);
      if (game.mode === 'race' && game.phase === 'running' && !r.alive && racers().every((g) => !g.alive)) {
        finishRace();
      }
      syncStatus();
    };

    const loop = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 0;
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
      Object.assign(game, {
        phase: 'running',
        mode: 'solo',
        runner: newRunner(courseSeed()),
        seed: courseSeed(),
        raceId: null,
        results: null,
      });
      syncStatus();
      startLoop();
    };

    const beginRace = (raceId: string, seed: number) => {
      Object.assign(game, {
        phase: 'countdown',
        mode: 'race',
        runner: newRunner(seed),
        seed,
        raceId,
        countdownEnd: performance.now() + COUNTDOWN_MS,
        results: null,
        lastSent: 0,
      });
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
      leaderboardRef.current = openLeaderboard({ deviceId: me.deviceId, name: nameRef.current, color: me.color }, setBoard);
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
      else if (game.phase === 'running') pressJump(game.runner);
    };
    const release = () => releaseJump(game.runner);

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

  const ready = peers.filter((p) => p.status === 'idle').length;

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
      </Heading>
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
      <Board aria-labelledby="runner-board-title">
        <BoardTitle id="runner-board-title">
          <FiAward aria-hidden="true" />
          Today&apos;s top {TOP_N}
          <BoardNote>resets 00:00 UTC</BoardNote>
        </BoardTitle>
        {board === null ? (
          <BoardNote as="p">Loading…</BoardNote>
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
        {board && board.mine > 0 && !board.entries.some((e) => e.deviceId === me.deviceId) && (
          <BoardNote as="p">Your best today: {pad(board.mine)}</BoardNote>
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

const BoardTitle = styled.h4`
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--heading);
  margin-bottom: 10px;

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

const BoardName = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
