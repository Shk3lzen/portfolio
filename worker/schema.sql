-- One row per verified run. The tape is kept only for a device's best run of the day
-- (enough for challenge ghosts) so storage stays small.
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  day TEXT NOT NULL,
  device_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  score INTEGER NOT NULL,
  seconds REAL NOT NULL,
  tape TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS runs_day_score ON runs (day, score DESC);
CREATE INDEX IF NOT EXISTS runs_score ON runs (score DESC);
CREATE INDEX IF NOT EXISTS runs_device ON runs (device_id, created_at DESC);
