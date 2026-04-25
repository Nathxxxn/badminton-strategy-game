ALTER TABLE player_profiles ADD COLUMN losses INTEGER NOT NULL DEFAULT 0;
ALTER TABLE player_profiles ADD COLUMN rating INTEGER NOT NULL DEFAULT 600;
ALTER TABLE player_profiles ADD COLUMN peak_rating INTEGER NOT NULL DEFAULT 600;

ALTER TABLE game_sessions ADD COLUMN result TEXT;
ALTER TABLE game_sessions ADD COLUMN accuracy INTEGER;
ALTER TABLE game_sessions ADD COLUMN rating_before INTEGER;
ALTER TABLE game_sessions ADD COLUMN rating_after INTEGER;
ALTER TABLE game_sessions ADD COLUMN rating_delta INTEGER;
ALTER TABLE game_sessions ADD COLUMN xp_gained INTEGER;

ALTER TABLE drill_progress ADD COLUMN last_result TEXT;

ALTER TABLE player_stats ADD COLUMN wins INTEGER NOT NULL DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN losses INTEGER NOT NULL DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN current_streak INTEGER NOT NULL DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN best_streak INTEGER NOT NULL DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN rating INTEGER NOT NULL DEFAULT 600;
ALTER TABLE player_stats ADD COLUMN peak_rating INTEGER NOT NULL DEFAULT 600;

UPDATE player_profiles
SET level = 1,
  xp = 0,
  xp_max = 500,
  rank = 'P12',
  wins = 0,
  losses = 0,
  win_rate = 0,
  streak = 0,
  best_streak = 0,
  trained_seconds = 0,
  rating = 600,
  peak_rating = 600
WHERE user_id IN (
  SELECT user_id FROM player_stats WHERE sessions_played = 0
);
