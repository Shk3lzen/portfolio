// Score server for the runner on shkelzzen.xyz (Cloudflare Worker + D1).
//
//   POST /runs           submit a finished run as a tape; it's replayed through the game engine
//                        and only the replayed score counts
//   GET  /board          ?scope=today|all&device=<id> → top 10 (best run per device) + your best
//   GET  /runs/:id       one run, with its tape when kept (for challenge ghosts)
//   GET  /s/:id          share page: Open Graph tags for link previews, then on to the game
//   GET  /og/:id.png     the generated preview image for a run
//
// Replaying proves the score came from a real sequence of frames and jumps on that day's course.
// It can't prove a human played it — a patient bot could still submit a perfect run.

import { isTape, replay, seedForDay } from '../../src/components/runner/tape';
import { isColor, isId, isName } from '../../src/components/runner/rules';
import { renderCard } from './card';

export interface Env {
  DB: D1Database;
  SITE_URL: string;
  ALLOWED_ORIGINS: string;
}

const TOP_N = 10;
const MAX_BODY_BYTES = 1_500_000;
const MIN_SECONDS_BETWEEN_RUNS = 2;

const dayKey = (offsetDays = 0) => new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isRunId = (v: string) => /^[a-z0-9]{10}$/.test(v);

const newRunId = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');
};

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

interface RunRow {
  id: string;
  day: string;
  device_id: string;
  name: string;
  color: string;
  score: number;
  seconds: number;
  tape: string | null;
  created_at: number;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const allowed = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
    const cors: Record<string, string> =
      origin && allowed.includes(origin)
        ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' }
        : {};

    const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
      new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...cors, ...headers } });
    const fail = (status: number, error: string) => json({ error }, status);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { ...cors, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' } });
    }

    const path = url.pathname;
    try {
      if (request.method === 'POST' && path === '/runs') return await submitRun(request, env, json, fail);
      if (request.method === 'GET' && path === '/board') return await board(url, env, json, fail);

      const runMatch = /^\/runs\/([a-z0-9]+)$/.exec(path);
      if (request.method === 'GET' && runMatch) {
        const run = await getRun(env, runMatch[1]);
        if (!run) return fail(404, 'not found');
        return json(
          { id: run.id, day: run.day, name: run.name, color: run.color, score: run.score, tape: run.tape ? JSON.parse(run.tape) : null },
          200,
          { 'Cache-Control': 'public, max-age=300' }
        );
      }

      const shareMatch = /^\/s\/([a-z0-9]+)$/.exec(path);
      if (request.method === 'GET' && shareMatch) return await sharePage(url, env, shareMatch[1]);

      const imageMatch = /^\/og\/([a-z0-9]+)\.png$/.exec(path);
      if (request.method === 'GET' && imageMatch) {
        const run = await getRun(env, imageMatch[1]);
        if (!run) return new Response('Not found', { status: 404 });
        const png = await renderCard(run);
        return new Response(png, {
          headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' },
        });
      }

      if (path === '/') return Response.redirect(env.SITE_URL, 302);
      return fail(404, 'not found');
    } catch (err) {
      console.error(err);
      return fail(500, 'server error');
    }
  },
};

type Json = (data: unknown, status?: number, headers?: Record<string, string>) => Response;
type Fail = (status: number, error: string) => Response;

const getRun = async (env: Env, id: string) =>
  isRunId(id) ? env.DB.prepare('SELECT * FROM runs WHERE id = ?1').bind(id).first<RunRow>() : null;

const bestToday = async (env: Env, day: string, deviceId: string) =>
  (await env.DB.prepare('SELECT MAX(score) AS best FROM runs WHERE day = ?1 AND device_id = ?2').bind(day, deviceId).first<{ best: number | null }>())
    ?.best ?? 0;

const submitRun = async (request: Request, env: Env, json: Json, fail: Fail) => {
  const length = Number(request.headers.get('Content-Length') ?? 0);
  if (length > MAX_BODY_BYTES) return fail(413, 'run too long');
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return fail(413, 'run too long');

  let body: any;
  try {
    body = JSON.parse(text);
  } catch {
    return fail(400, 'bad json');
  }
  const { day, deviceId, name, color, tape } = body ?? {};
  if (!isDay(day) || !isId(deviceId) || !isName(name) || !isColor(color) || !isTape(tape)) return fail(400, 'invalid run');
  // Today's course, or yesterday's for a run that finished just after midnight UTC.
  if (day !== dayKey() && day !== dayKey(-1)) return fail(400, 'that course has closed');

  const result = replay(seedForDay(day), tape);
  if (result.alive) return fail(400, 'run did not finish');
  if (result.score <= 0) return fail(400, 'nothing to record');

  const now = Date.now();
  const last = await env.DB.prepare('SELECT created_at FROM runs WHERE device_id = ?1 ORDER BY created_at DESC LIMIT 1')
    .bind(deviceId)
    .first<{ created_at: number }>();
  // A run can't finish sooner after the last one than it took to play.
  if (last && now - last.created_at < Math.max(MIN_SECONDS_BETWEEN_RUNS, result.seconds) * 1000) return fail(429, 'too fast');

  const previousBest = await bestToday(env, day, deviceId);
  const keepTape = result.score > previousBest;
  const id = newRunId();
  await env.DB.prepare(
    'INSERT INTO runs (id, day, device_id, name, color, score, seconds, tape, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)'
  )
    .bind(id, day, deviceId, name, color, result.score, result.seconds, keepTape ? JSON.stringify(tape) : null, now)
    .run();

  // Rank among everyone's best today.
  const ahead = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM (SELECT device_id, MAX(score) AS best FROM runs WHERE day = ?1 GROUP BY device_id) WHERE best > ?2'
  )
    .bind(day, result.score)
    .first<{ n: number }>();

  return json({ id, score: result.score, best: Math.max(previousBest, result.score), rank: (ahead?.n ?? 0) + 1 }, 201);
};

const board = async (url: URL, env: Env, json: Json, fail: Fail) => {
  const scope = url.searchParams.get('scope') === 'all' ? 'all' : 'today';
  const device = url.searchParams.get('device');
  if (device !== null && !isId(device)) return fail(400, 'bad device');
  const day = dayKey();

  // SQLite returns the other columns from the row holding MAX(score), i.e. each device's best run.
  const where = scope === 'today' ? 'WHERE day = ?1' : '';
  const query = `SELECT id, device_id, name, color, MAX(score) AS score FROM runs ${where}
    GROUP BY device_id ORDER BY score DESC, MIN(created_at) ASC LIMIT ${TOP_N}`;
  const stmt = env.DB.prepare(query);
  const { results } = await (scope === 'today' ? stmt.bind(day) : stmt).all<{
    id: string;
    device_id: string;
    name: string;
    color: string;
    score: number;
  }>();

  let mine = 0;
  if (device) {
    const mineQuery =
      scope === 'today'
        ? env.DB.prepare('SELECT MAX(score) AS best FROM runs WHERE day = ?1 AND device_id = ?2').bind(day, device)
        : env.DB.prepare('SELECT MAX(score) AS best FROM runs WHERE device_id = ?1').bind(device);
    mine = (await mineQuery.first<{ best: number | null }>())?.best ?? 0;
  }

  return json(
    {
      scope,
      day,
      entries: results.map((r) => ({ runId: r.id, deviceId: r.device_id, name: r.name, color: r.color, score: r.score })),
      mine,
    },
    200,
    { 'Cache-Control': 'no-store' }
  );
};

const sharePage = async (url: URL, env: Env, id: string) => {
  const run = await getRun(env, id);
  const play = `${env.SITE_URL}/?run=${run ? run.id : ''}#/`;
  if (!run) return Response.redirect(env.SITE_URL, 302);

  const title = `I scored ${run.score} on Shkëlzen's site — can you beat me?`;
  const description = `${run.name} set ${run.score} on today's course of the pixel runner at shkelzzen.xyz. Same course for everyone, all day.`;
  const image = `${url.origin}/og/${run.id}.png`;
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="${escapeHtml(description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${escapeHtml(url.href)}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="${escapeHtml(image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${escapeHtml(`${run.name} scored ${run.score} in the runner game on shkelzzen.xyz`)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${escapeHtml(image)}">
<meta http-equiv="refresh" content="0; url=${escapeHtml(play)}">
<style>body{background:#0a192f;color:#ccd6f6;font:16px system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0}a{color:#64ffda}</style>
</head>
<body>
<p><a href="${escapeHtml(play)}">Beat ${escapeHtml(run.name)}'s ${run.score} →</a></p>
<script>location.replace(${JSON.stringify(play)})</script>
</body>
</html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
};
