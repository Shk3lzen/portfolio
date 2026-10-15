# Runner score server

A Cloudflare Worker (with a D1 database) behind the runner game on shkelzzen.xyz:

- **Verified scores.** The game records each solo run as a tape of frame times and jumps
  (`src/components/runner/tape.ts`). The Worker replays the tape through the same engine and
  stores the score it gets, not one the browser claims.
- **Leaderboards.** Today's top 10 and all-time top 10, best run per device.
- **Sharing.** `/s/<run>` is a share page with Open Graph tags and a generated 1200×630 preview
  image (`/og/<run>.png`, pixel art drawn and PNG-encoded in the Worker, no dependencies). It
  forwards people to the site, which loads the run as a challenge and races its ghost. The game
  has no share button at the moment, so nothing links here yet; every run's page is ready if one
  comes back.

Without the Worker the site still works: the game falls back to the peer-to-peer daily board.

## Run locally

```bash
cd worker
npm install
npm run db:init:local
npm run dev            # http://127.0.0.1:8787
```

Then point the site at it, in `.env.development.local` at the repo root (not committed):

```
REACT_APP_RUNNER_API=http://127.0.0.1:8787
```

## Deploy

1. `npx wrangler login`
2. `npx wrangler d1 create shkelzzen-runner` and copy the printed `database_id` into
   `wrangler.toml`.
3. `npm run db:init` to create the table.
4. `npm run deploy`. Optionally give it a custom domain such as `runner.shkelzzen.xyz` in the
   Cloudflare dashboard (Workers → shkelzzen-runner → Settings → Domains & Routes).
5. Build the site with the Worker's URL, e.g. add `.env.production` at the repo root with
   `REACT_APP_RUNNER_API=https://runner.shkelzzen.xyz`, then `npm run deploy` there as usual.

## Limits worth knowing

Replaying proves a score came from a real sequence of frames and jumps on that day's course,
and the Worker refuses runs submitted faster than they could have been played. It can't prove a
human was playing: a determined bot could still post a high score.
