ALTER TABLE player_stats ADD COLUMN last_daily_bonus_date TEXT;

ALTER TABLE game_sessions ADD COLUMN daily_bonus_applied INTEGER NOT NULL DEFAULT 0;
ALTER TABLE game_sessions ADD COLUMN xp_multiplier INTEGER NOT NULL DEFAULT 1;

UPDATE player_preferences
SET drill_filter = 'All'
WHERE drill_filter = 'Strategy';
