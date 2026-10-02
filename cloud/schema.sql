CREATE TABLE IF NOT EXISTS households (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tz TEXT NOT NULL DEFAULT 'America/New_York',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  hid TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 2,
  low_impact INTEGER NOT NULL DEFAULT 0,
  pos INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS members_hid ON members(hid);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  hid TEXT NOT NULL,
  code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'lobby', -- lobby, ready, live, done
  plan TEXT,
  coach TEXT,
  started_at INTEGER,
  paused_at INTEGER,
  paused_ms INTEGER NOT NULL DEFAULT 0,
  offset_ms INTEGER NOT NULL DEFAULT 0,
  pace REAL NOT NULL DEFAULT 1,
  planned_blocks INTEGER NOT NULL DEFAULT 0,
  completed_blocks INTEGER NOT NULL DEFAULT 0,
  focus TEXT,
  weekday INTEGER,
  local_hour INTEGER,
  summary TEXT,
  created_at INTEGER NOT NULL,
  finished_at INTEGER
);
CREATE INDEX IF NOT EXISTS sessions_code ON sessions(code);
CREATE INDEX IF NOT EXISTS sessions_hid ON sessions(hid, created_at);

CREATE TABLE IF NOT EXISTS presence (
  session_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  present INTEGER NOT NULL DEFAULT 1,
  via TEXT NOT NULL DEFAULT 'tv', -- tv or phone
  energy INTEGER,
  sore TEXT NOT NULL DEFAULT '[]',
  rating TEXT,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (session_id, member_id)
);

CREATE TABLE IF NOT EXISTS events (
  hid TEXT NOT NULL,
  at INTEGER NOT NULL,
  text TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS events_hid ON events(hid, at);

-- What the coach said, when (shown as captions on phones).
CREATE TABLE IF NOT EXISTS lines (
  session_id TEXT NOT NULL,
  at INTEGER NOT NULL,
  text TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS lines_session ON lines(session_id, at);
