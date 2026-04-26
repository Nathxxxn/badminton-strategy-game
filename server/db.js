import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { DEFAULT_APP_STATE, DEFAULT_CONTROLS } from './default-state.js';
import {
  calculateProgression,
  rankForRating,
  STARTING_RATING,
} from './progression.js';

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

const DRILL_CATALOG = Object.freeze([
  { id: 'd1', title: 'Cross-court smash', category: 'Attack', workshop: 'attack', difficulty: 2 },
  { id: 'd2', title: 'Drop shot deception', category: 'Attack', workshop: 'attack', difficulty: 3 },
  { id: 'd3', title: 'Straight net kill', category: 'Attack', workshop: 'attack', difficulty: 2 },
  { id: 'd4', title: 'Jumping smash power', category: 'Attack', workshop: 'attack', difficulty: 4 },
  { id: 'd5', title: 'Baseline clear defense', category: 'Defense', workshop: 'defense', difficulty: 2 },
  { id: 'd6', title: 'Smash block timing', category: 'Defense', workshop: 'defense', difficulty: 3 },
  { id: 'd7', title: 'Counter-attack lifts', category: 'Defense', workshop: 'defense', difficulty: 3 },
  { id: 'd8', title: 'Deceptive block to net', category: 'Defense', workshop: 'defense', difficulty: 4 },
]);

function nowIso() {
  return new Date().toISOString();
}

function localDateKey(value = nowIso()) {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(Number.isNaN(date.getTime()) ? new Date() : date);
  const byType = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function mergeState(base, patch) {
  if (!isPlainObject(patch)) return clone(base);

  const next = clone(base);
  Object.entries(patch).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      next[key] = clone(value);
    } else if (isPlainObject(value) && isPlainObject(next[key])) {
      next[key] = mergeState(next[key], value);
    } else if (value !== undefined) {
      next[key] = value;
    }
  });
  return next;
}

function initialsFor(name) {
  return String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('') || DEFAULT_APP_STATE.profile.initials;
}

function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

function normalizeCountry(country) {
  return String(country ?? DEFAULT_APP_STATE.profile.country).trim().slice(0, 2).toUpperCase() || DEFAULT_APP_STATE.profile.country;
}

function secondsToTrained(seconds) {
  if (!seconds) return DEFAULT_APP_STATE.profile.trained;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function mapProfile(row) {
  return {
    name: row.name,
    initials: row.initials,
    country: row.country,
    avatarColor: row.avatar_color,
    level: row.level,
    xp: row.xp,
    xpMax: row.xp_max,
    rank: rankForRating(row.rating ?? STARTING_RATING),
    rating: row.rating ?? STARTING_RATING,
    peakRating: row.peak_rating ?? STARTING_RATING,
    wins: row.wins,
    losses: row.losses ?? 0,
    winRate: row.win_rate,
    streak: row.streak,
    bestStreak: row.best_streak,
    trained: secondsToTrained(row.trained_seconds),
  };
}

function mapPreferences(row) {
  return {
    drillFilter: row.drill_filter === 'Strategy' ? 'All' : row.drill_filter,
    leaderboardPeriod: row.leaderboard_period,
  };
}

function mapStats(row) {
  const sessionsPlayed = row?.sessions_played ?? 0;
  return {
    sessionsPlayed,
    totalScore: row?.total_score ?? 0,
    totalCorrect: row?.total_correct ?? 0,
    totalTurns: row?.total_turns ?? 0,
    bestScore: row?.best_score ?? 0,
    averageScore: sessionsPlayed > 0 ? Math.round((row.total_score ?? 0) / sessionsPlayed) : 0,
    accuracy: (row?.total_turns ?? 0) > 0 ? Math.round(((row.total_correct ?? 0) / row.total_turns) * 100) : 0,
    wins: row?.wins ?? 0,
    losses: row?.losses ?? 0,
    currentStreak: row?.current_streak ?? 0,
    bestStreak: row?.best_streak ?? 0,
    rating: row?.rating ?? STARTING_RATING,
    peakRating: row?.peak_rating ?? STARTING_RATING,
    totalDurationSeconds: row?.total_duration_seconds ?? 0,
    lastPlayedAt: row?.last_played_at ?? null,
  };
}

function mapDailyBonus(row, referenceDate = nowIso()) {
  const today = localDateKey(referenceDate);
  const lastClaimedDate = row?.last_daily_bonus_date ?? null;
  return {
    available: lastClaimedDate !== today,
    multiplier: 2,
    lastClaimedDate,
  };
}

function mapSession(row) {
  return {
    id: row.id,
    drillId: row.drill_id,
    workshop: row.workshop,
    matchId: row.match_id,
    score: row.score,
    correct: row.correct,
    totalTurns: row.total_turns,
    durationSeconds: row.duration_seconds,
    tacticalAverage: row.tactical_average,
    placementAverage: row.placement_average,
    result: row.result,
    accuracy: row.accuracy ?? Math.round((row.correct / row.total_turns) * 100),
    ratingBefore: row.rating_before,
    ratingAfter: row.rating_after,
    ratingDelta: row.rating_delta,
    xpGained: row.xp_gained,
    dailyBonusApplied: Boolean(row.daily_bonus_applied),
    xpMultiplier: row.xp_multiplier ?? 1,
    completedAt: row.completed_at,
  };
}

function readMigrations() {
  return readdirSync(MIGRATIONS_DIR)
    .filter(file => /^\d+_.+\.sql$/.test(file))
    .sort()
    .map(file => ({
      version: Number(file.split('_')[0]),
      sql: readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'),
    }));
}

function runMigrations(db) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)');
  const applied = new Set(db.prepare('SELECT version FROM schema_migrations').all().map(row => row.version));
  const insert = db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)');

  for (const migration of readMigrations()) {
    if (applied.has(migration.version)) continue;
    const apply = db.transaction(() => {
      db.exec(migration.sql);
      insert.run(migration.version, nowIso());
    });
    apply();
  }
}

function getDefaultControls() {
  return clone(DEFAULT_CONTROLS);
}

export function createPlayerStore({ dbPath = path.join(process.cwd(), 'server/data/rally.sqlite') } = {}) {
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runMigrations(db);

  const insertUser = db.prepare(`
    INSERT INTO users (id, email, password_hash, created_at, updated_at)
    VALUES (@id, @email, @passwordHash, @createdAt, @updatedAt)
  `);
  const findUserByEmail = db.prepare('SELECT * FROM users WHERE email = ?');
  const findUserById = db.prepare('SELECT * FROM users WHERE id = ?');
  const updatePassword = db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?');
  const insertProfile = db.prepare(`
    INSERT INTO player_profiles (
      user_id, name, initials, country, avatar_color, level, xp, xp_max, rank,
      wins, losses, win_rate, streak, best_streak, trained_seconds, rating, peak_rating
    )
    VALUES (@userId, @name, @initials, @country, @avatarColor, @level, @xp, @xpMax, @rank,
      @wins, @losses, @winRate, @streak, @bestStreak, @trainedSeconds, @rating, @peakRating)
  `);
  const insertPreferences = db.prepare(`
    INSERT INTO player_preferences (user_id, drill_filter, leaderboard_period)
    VALUES (?, ?, ?)
  `);
  const insertStats = db.prepare('INSERT INTO player_stats (user_id) VALUES (?)');
  const replaceControl = db.prepare(`
    INSERT INTO player_controls (user_id, action, key_value, sort_order)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, action) DO UPDATE SET key_value = excluded.key_value, sort_order = excluded.sort_order
  `);
  const deleteControls = db.prepare('DELETE FROM player_controls WHERE user_id = ?');
  const getProfileRow = db.prepare('SELECT * FROM player_profiles WHERE user_id = ?');
  const getPreferencesRow = db.prepare('SELECT * FROM player_preferences WHERE user_id = ?');
  const getControlsRows = db.prepare('SELECT action, key_value, sort_order FROM player_controls WHERE user_id = ? ORDER BY sort_order ASC');
  const getStatsRow = db.prepare('SELECT * FROM player_stats WHERE user_id = ?');
  const getDrillRows = db.prepare('SELECT * FROM drill_progress WHERE user_id = ?');
  const getSessionsRows = db.prepare(`
    SELECT * FROM game_sessions
    WHERE user_id = ?
    ORDER BY rating_delta DESC, score DESC, accuracy DESC, completed_at DESC, created_at DESC
  `);
  const getWeeklySessionsRows = db.prepare(`
    SELECT * FROM game_sessions
    WHERE user_id = ? AND completed_at >= ?
    ORDER BY rating_delta DESC, score DESC, accuracy DESC, completed_at DESC, created_at DESC
  `);
  const insertSession = db.prepare(`
    INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at)
    VALUES (@id, @userId, @tokenHash, @createdAt, @expiresAt)
  `);
  const getSessionByHash = db.prepare(`
    SELECT sessions.*, users.email
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.revoked_at IS NULL AND sessions.expires_at > ?
  `);
  const revokeSession = db.prepare('UPDATE sessions SET revoked_at = ? WHERE token_hash = ?');
  const updateProfileStatement = db.prepare(`
    UPDATE player_profiles
    SET name = @name, initials = @initials, country = @country, avatar_color = @avatarColor
    WHERE user_id = @userId
  `);
  const updateProfileStatsStatement = db.prepare(`
    UPDATE player_profiles
    SET level = @level, xp = @xp, xp_max = @xpMax, rank = @rank, rating = @rating,
      peak_rating = @peakRating, wins = @wins, losses = @losses, win_rate = @winRate,
      streak = @streak, best_streak = @bestStreak, trained_seconds = @trainedSeconds
    WHERE user_id = @userId
  `);
  const updatePreferencesStatement = db.prepare(`
    UPDATE player_preferences
    SET drill_filter = @drillFilter, leaderboard_period = @leaderboardPeriod
    WHERE user_id = @userId
  `);
  const upsertDrillStart = db.prepare(`
    INSERT INTO drill_progress (user_id, drill_id, workshop, started)
    VALUES (?, ?, ?, 1)
    ON CONFLICT(user_id, drill_id) DO UPDATE SET started = 1
  `);
  const upsertDrillResult = db.prepare(`
    INSERT INTO drill_progress (user_id, drill_id, workshop, started, completed, attempts, best_score, last_played_at, last_result)
    VALUES (@userId, @drillId, @workshop, 1, @completed, 1, @bestScore, @lastPlayedAt, @lastResult)
    ON CONFLICT(user_id, drill_id) DO UPDATE SET
      started = 1,
      completed = MAX(completed, excluded.completed),
      attempts = attempts + 1,
      best_score = CASE
        WHEN best_score IS NULL OR excluded.best_score > best_score THEN excluded.best_score
        ELSE best_score
      END,
      last_played_at = excluded.last_played_at,
      last_result = excluded.last_result
  `);
  const insertGameSession = db.prepare(`
    INSERT INTO game_sessions (
      id, user_id, drill_id, workshop, match_id, score, correct, total_turns, duration_seconds,
      tactical_average, placement_average, result, accuracy, rating_before, rating_after,
      rating_delta, xp_gained, daily_bonus_applied, xp_multiplier, completed_at, created_at
    )
    VALUES (@id, @userId, @drillId, @workshop, @matchId, @score, @correct, @totalTurns, @durationSeconds,
      @tacticalAverage, @placementAverage, @result, @accuracy, @ratingBefore, @ratingAfter,
      @ratingDelta, @xpGained, @dailyBonusApplied, @xpMultiplier, @completedAt, @createdAt)
  `);
  const updateStats = db.prepare(`
    UPDATE player_stats
    SET sessions_played = sessions_played + 1,
      total_score = total_score + @score,
      total_correct = total_correct + @correct,
      total_turns = total_turns + @totalTurns,
      total_duration_seconds = total_duration_seconds + @durationSeconds,
      best_score = MAX(best_score, @score),
      wins = @wins,
      losses = @losses,
      current_streak = @streak,
      best_streak = @bestStreak,
      rating = @rating,
      peak_rating = @peakRating,
      last_daily_bonus_date = @lastDailyBonusDate,
      last_played_at = @completedAt
    WHERE user_id = @userId
  `);
  const resetProgressRows = db.prepare('DELETE FROM game_sessions WHERE user_id = ?');
  const resetDrillRows = db.prepare('DELETE FROM drill_progress WHERE user_id = ?');
  const resetStats = db.prepare(`
    UPDATE player_stats
    SET sessions_played = 0, total_score = 0, total_correct = 0, total_turns = 0,
      total_duration_seconds = 0, best_score = 0, wins = 0, losses = 0,
      current_streak = 0, best_streak = 0, rating = 600, peak_rating = 600,
      last_daily_bonus_date = NULL, last_played_at = NULL
    WHERE user_id = ?
  `);

  function writeControls(userId, controls) {
    deleteControls.run(userId);
    controls.forEach((bind, index) => replaceControl.run(userId, bind.action, bind.key, index));
  }

  function createUser({ email, passwordHash, name, country }) {
    const timestamp = nowIso();
    const userId = randomUUID();
    const profile = DEFAULT_APP_STATE.profile;
    const normalizedName = String(name ?? profile.name).trim() || profile.name;
    const create = db.transaction(() => {
      insertUser.run({ id: userId, email: normalizeEmail(email), passwordHash, createdAt: timestamp, updatedAt: timestamp });
      insertProfile.run({
        userId,
        name: normalizedName,
        initials: initialsFor(normalizedName),
        country: normalizeCountry(country),
        avatarColor: profile.avatarColor,
        level: profile.level,
        xp: profile.xp,
        xpMax: profile.xpMax,
        rank: rankForRating(profile.rating),
        rating: profile.rating,
        peakRating: profile.peakRating,
        wins: profile.wins,
        losses: profile.losses,
        winRate: profile.winRate,
        streak: profile.streak,
        bestStreak: profile.bestStreak,
        trainedSeconds: 0,
      });
      insertPreferences.run(userId, DEFAULT_APP_STATE.preferences.drillFilter, DEFAULT_APP_STATE.preferences.leaderboardPeriod);
      insertStats.run(userId);
      writeControls(userId, getDefaultControls());
    });
    create();
    return findUserById.get(userId);
  }

  function createSession(userId) {
    const token = randomBytes(32).toString('base64url');
    const createdAt = nowIso();
    insertSession.run({
      id: randomUUID(),
      userId,
      tokenHash: hashToken(token),
      createdAt,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    });
    return token;
  }

  function findSession(token) {
    if (!token) return null;
    return getSessionByHash.get(hashToken(token), nowIso()) ?? null;
  }

  function revokeSessionToken(token) {
    if (!token) return;
    revokeSession.run(nowIso(), hashToken(token));
  }

  function getUser(userId) {
    return findUserById.get(userId) ?? null;
  }

  function publicUser(user) {
    if (!user) return null;
    return { id: user.id, email: user.email };
  }

  function getDrillProgress(userId) {
    const progressById = new Map(getDrillRows.all(userId).map(row => [row.drill_id, row]));
    return DRILL_CATALOG.map(drill => {
      const row = progressById.get(drill.id);
      return {
        ...drill,
        started: Boolean(row?.started),
        completed: Boolean(row?.completed),
        attempts: row?.attempts ?? 0,
        bestScore: row?.best_score ?? null,
        lastPlayedAt: row?.last_played_at ?? null,
        lastResult: row?.last_result ?? null,
      };
    });
  }

  function getState(userId) {
    const user = getUser(userId);
    const profile = mapProfile(getProfileRow.get(userId));
    const preferences = mapPreferences(getPreferencesRow.get(userId));
    const controls = getControlsRows.all(userId).map(row => ({ action: row.action, key: row.key_value }));
    const drills = getDrillProgress(userId);
    const bestScores = Object.fromEntries(drills.filter(drill => drill.bestScore !== null).map(drill => [drill.id, drill.bestScore]));
    const statsRow = getStatsRow.get(userId);

    return {
      user: publicUser(user),
      account: { email: user.email },
      profile,
      preferences,
      progression: {
        startedDrills: drills.filter(drill => drill.started).map(drill => drill.id),
        bestScores,
      },
      dailyBonus: mapDailyBonus(statsRow),
      controls,
      stats: mapStats(statsRow),
      drills,
      leaderboard: sessionsForPeriod(userId, preferences.leaderboardPeriod),
    };
  }

  function updateProfile(userId, patch) {
    const current = mapProfile(getProfileRow.get(userId));
    const name = typeof patch.name === 'string' && patch.name.trim() ? patch.name.trim() : current.name;
    updateProfileStatement.run({
      userId,
      name,
      initials: initialsFor(name),
      country: typeof patch.country === 'string' ? normalizeCountry(patch.country) : current.country,
      avatarColor: typeof patch.avatarColor === 'string' && patch.avatarColor.trim() ? patch.avatarColor.trim() : current.avatarColor,
    });
    return getState(userId);
  }

  function updatePreferences(userId, patch) {
    const current = mapPreferences(getPreferencesRow.get(userId));
    updatePreferencesStatement.run({
      userId,
      drillFilter: patch.drillFilter ?? current.drillFilter,
      leaderboardPeriod: patch.leaderboardPeriod ?? current.leaderboardPeriod,
    });
    return getState(userId);
  }

  function updateControls(userId, controls) {
    writeControls(userId, Array.isArray(controls) ? controls : getDefaultControls());
    return getState(userId);
  }

  function resetControls(userId) {
    writeControls(userId, getDefaultControls());
    return getState(userId);
  }

  function startDrill(userId, drillId) {
    const drill = DRILL_CATALOG.find(entry => entry.id === drillId);
    upsertDrillStart.run(userId, drillId, drill?.workshop ?? null);
    return getState(userId);
  }

  function defaultDrillForWorkshop(workshop) {
    if (workshop === 'defense') return 'd5';
    if (workshop === 'attack') return 'd1';
    return null;
  }

  function recordGameSession(userId, payload) {
    const completedAt = typeof payload.completedAt === 'string' ? payload.completedAt : nowIso();
    const score = Math.max(0, Number.parseInt(payload.score, 10) || 0);
    const totalTurns = Math.max(0, Number.parseInt(payload.totalTurns, 10) || 0);
    const correct = Math.max(0, Number.parseInt(payload.correct, 10) || 0);
    if (totalTurns <= 0 || correct > totalTurns) return getState(userId);
    const durationSeconds = Math.max(0, Number.parseInt(payload.durationSeconds, 10) || 0);
    const workshop = String(payload.workshop ?? 'attack');
    const drillId = payload.drillId ? String(payload.drillId) : defaultDrillForWorkshop(workshop);
    const drill = DRILL_CATALOG.find(entry => entry.id === drillId);
    const profileRow = getProfileRow.get(userId);
    const statsRow = getStatsRow.get(userId);
    const sessionDate = localDateKey(completedAt);
    const dailyBonusApplied = statsRow?.last_daily_bonus_date !== sessionDate;
    const xpMultiplier = dailyBonusApplied ? 2 : 1;
    const progression = calculateProgression({
      current: {
        level: profileRow.level,
        xp: profileRow.xp,
        xpMax: profileRow.xp_max,
        rating: profileRow.rating,
        peakRating: profileRow.peak_rating,
        wins: profileRow.wins,
        losses: profileRow.losses,
        streak: profileRow.streak,
        bestStreak: profileRow.best_streak,
        trainedSeconds: profileRow.trained_seconds,
      },
      session: {
        score,
        correct,
        totalTurns,
        durationSeconds,
        difficulty: drill?.difficulty ?? 2,
        xpMultiplier,
      },
    });
    const completed = progression.session.result === 'W' ? 1 : 0;
    const tx = db.transaction(() => {
      insertGameSession.run({
        id: randomUUID(),
        userId,
        drillId,
        workshop,
        matchId: payload.matchId ? String(payload.matchId) : null,
        score,
        correct,
        totalTurns,
        durationSeconds,
        tacticalAverage: Number.isFinite(payload.tacticalAverage) ? payload.tacticalAverage : null,
        placementAverage: Number.isFinite(payload.placementAverage) ? payload.placementAverage : null,
        result: progression.session.result,
        accuracy: progression.session.accuracy,
        ratingBefore: progression.session.ratingBefore,
        ratingAfter: progression.session.ratingAfter,
        ratingDelta: progression.session.ratingDelta,
        xpGained: progression.session.xpGained,
        dailyBonusApplied: progression.session.dailyBonusApplied ? 1 : 0,
        xpMultiplier: progression.session.xpMultiplier,
        completedAt,
        createdAt: nowIso(),
      });
      if (drillId) {
        upsertDrillResult.run({
          userId,
          drillId,
          workshop,
          completed,
          bestScore: score,
          lastPlayedAt: completedAt,
          lastResult: progression.session.result,
        });
      }
      updateStats.run({
        userId,
        score,
        correct,
        totalTurns,
        durationSeconds,
        completedAt,
        wins: progression.profile.wins,
        losses: progression.profile.losses,
        streak: progression.profile.streak,
        bestStreak: progression.profile.bestStreak,
        rating: progression.profile.rating,
        peakRating: progression.profile.peakRating,
        lastDailyBonusDate: dailyBonusApplied ? sessionDate : statsRow?.last_daily_bonus_date ?? null,
      });
      updateProfileStatsStatement.run({
        userId,
        level: progression.profile.level,
        xp: progression.profile.xp,
        xpMax: progression.profile.xpMax,
        rank: progression.profile.rank,
        rating: progression.profile.rating,
        peakRating: progression.profile.peakRating,
        wins: progression.profile.wins,
        losses: progression.profile.losses,
        winRate: progression.profile.winRate,
        streak: progression.profile.streak,
        bestStreak: progression.profile.bestStreak,
        trainedSeconds: progression.profile.trainedSeconds,
      });
    });
    tx();
    return getState(userId);
  }

  function sessionsForPeriod(userId, period = 'weekly') {
    const rows = period === 'all-time'
      ? getSessionsRows.all(userId)
      : getWeeklySessionsRows.all(userId, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
    const sessions = rows.map(mapSession);
    const bestScore = sessions.reduce((best, session) => Math.max(best, session.score), 0);
    const totalScore = sessions.reduce((sum, session) => sum + session.score, 0);
    return {
      period,
      summary: {
        sessionsPlayed: sessions.length,
        bestScore,
        averageScore: sessions.length ? Math.round(totalScore / sessions.length) : 0,
      },
      sessions,
    };
  }

  function resetProgression(userId) {
    const reset = db.transaction(() => {
      resetProgressRows.run(userId);
      resetDrillRows.run(userId);
      resetStats.run(userId);
      const profile = DEFAULT_APP_STATE.profile;
      updateProfileStatsStatement.run({
        userId,
        level: profile.level,
        xp: profile.xp,
        xpMax: profile.xpMax,
        rank: rankForRating(profile.rating),
        rating: profile.rating,
        peakRating: profile.peakRating,
        wins: profile.wins,
        losses: profile.losses,
        winRate: profile.winRate,
        streak: profile.streak,
        bestStreak: profile.bestStreak,
        trainedSeconds: 0,
      });
    });
    reset();
    return getState(userId);
  }

  return {
    auth: {
      createUser,
      findUserByEmail: email => findUserByEmail.get(normalizeEmail(email)) ?? null,
      getUser,
      publicUser,
      updatePassword: (userId, passwordHash) => updatePassword.run(passwordHash, nowIso(), userId),
      createSession,
      findSession,
      revokeSessionToken,
    },
    getState,
    updateProfile,
    updatePreferences,
    updateControls,
    resetControls,
    startDrill,
    recordGameSession,
    sessionsForPeriod,
    resetProgression,
    close() {
      db.close();
    },
  };
}
