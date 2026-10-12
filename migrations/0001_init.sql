CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);

CREATE TABLE login_failures (
  ip TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX login_failures_ip ON login_failures (ip, at);

-- Game state is gzip+base64 produced by the browser; the Worker never parses it.
CREATE TABLE games (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  game_date TEXT NOT NULL,
  turn INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  state TEXT NOT NULL
);

CREATE TABLE snapshots (
  game_id TEXT NOT NULL,
  turn INTEGER NOT NULL,
  game_date TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  state TEXT NOT NULL,
  PRIMARY KEY (game_id, turn)
);
