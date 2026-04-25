CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS player_profiles (
  user_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  initials TEXT NOT NULL,
  country TEXT NOT NULL,
  avatar_color TEXT NOT NULL,
  level INTEGER NOT NULL,
  xp INTEGER NOT NULL,
  xp_max INTEGER NOT NULL,
  rank TEXT NOT NULL,
  wins INTEGER NOT NULL,
  win_rate INTEGER NOT NULL,
  streak INTEGER NOT NULL,
  best_streak INTEGER NOT NULL,
  trained_seconds INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS player_preferences (
  user_id TEXT PRIMARY KEY,
  drill_filter TEXT NOT NULL,
  leaderboard_period TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS player_controls (
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  key_value TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  PRIMARY KEY (user_id, action),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS game_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  drill_id TEXT,
  workshop TEXT NOT NULL,
  match_id TEXT,
  score INTEGER NOT NULL,
  correct INTEGER NOT NULL,
  total_turns INTEGER NOT NULL,
  duration_seconds INTEGER NOT NULL,
  tactical_average INTEGER,
  placement_average INTEGER,
  completed_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS drill_progress (
  user_id TEXT NOT NULL,
  drill_id TEXT NOT NULL,
  workshop TEXT,
  started INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  best_score INTEGER,
  last_played_at TEXT,
  PRIMARY KEY (user_id, drill_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS player_stats (
  user_id TEXT PRIMARY KEY,
  sessions_played INTEGER NOT NULL DEFAULT 0,
  total_score INTEGER NOT NULL DEFAULT 0,
  total_correct INTEGER NOT NULL DEFAULT 0,
  total_turns INTEGER NOT NULL DEFAULT 0,
  total_duration_seconds INTEGER NOT NULL DEFAULT 0,
  best_score INTEGER NOT NULL DEFAULT 0,
  last_played_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
