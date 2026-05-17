import { createClient } from '@libsql/client';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

async function runMigrations(client) {
  await client.execute('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)');
  const result = await client.execute('SELECT version FROM schema_migrations');
  const applied = new Set(result.rows.map(row => Number(row.version)));

  for (const migration of readMigrations()) {
    if (applied.has(migration.version)) continue;
    const stmts = migration.sql
      .split(';')
      .map(s => s.trim())
      .filter(Boolean)
      .map(sql => ({ sql, args: [] }));
    await client.batch([
      ...stmts,
      { sql: 'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)', args: [migration.version, nowIso()] },
    ], 'write');
  }
}

function controlsStatements(userId, controls) {
  return [
    { sql: 'DELETE FROM player_controls WHERE user_id = ?', args: [userId] },
    ...controls.map((bind, index) => ({
      sql: 'INSERT INTO player_controls (user_id, action, key_value, sort_order) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, action) DO UPDATE SET key_value = excluded.key_value, sort_order = excluded.sort_order',
      args: [userId, bind.action, bind.key, index],
    })),
  ];
}

function getDefaultControls() {
  return clone(DEFAULT_CONTROLS);
}

export async function createPlayerStore() {
  const url = process.env.TURSO_DATABASE_URL
    ?? `file:${path.join(process.cwd(), 'server/data/rally.sqlite')}`;

  if (url.startsWith('file:')) {
    mkdirSync(path.dirname(url.slice(5)), { recursive: true });
  }

  const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

  try {
    await client.execute('PRAGMA foreign_keys = ON');
  } catch {
    // Remote Turso handles referential integrity server-side
  }

  await runMigrations(client);

  async function createUser({ email, passwordHash, name, country }) {
    const timestamp = nowIso();
    const userId = randomUUID();
    const profile = DEFAULT_APP_STATE.profile;
    const normalizedName = String(name ?? profile.name).trim() || profile.name;

    await client.batch([
      {
        sql: 'INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        args: [userId, normalizeEmail(email), passwordHash, timestamp, timestamp],
      },
      {
        sql: 'INSERT INTO player_profiles (user_id, name, initials, country, avatar_color, level, xp, xp_max, rank, wins, losses, win_rate, streak, best_streak, trained_seconds, rating, peak_rating) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        args: [
          userId, normalizedName, initialsFor(normalizedName), normalizeCountry(country),
          profile.avatarColor, profile.level, profile.xp, profile.xpMax,
          rankForRating(profile.rating), profile.wins, profile.losses, profile.winRate,
          profile.streak, profile.bestStreak, 0, profile.rating, profile.peakRating,
        ],
      },
      {
        sql: 'INSERT INTO player_preferences (user_id, drill_filter, leaderboard_period) VALUES (?, ?, ?)',
        args: [userId, DEFAULT_APP_STATE.preferences.drillFilter, DEFAULT_APP_STATE.preferences.leaderboardPeriod],
      },
      { sql: 'INSERT INTO player_stats (user_id) VALUES (?)', args: [userId] },
      ...controlsStatements(userId, getDefaultControls()),
    ], 'write');

    const res = await client.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [userId] });
    return res.rows[0];
  }

  async function createSession(userId) {
    const token = randomBytes(32).toString('base64url');
    await client.execute({
      sql: 'INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)',
      args: [randomUUID(), userId, hashToken(token), nowIso(), new Date(Date.now() + SESSION_TTL_MS).toISOString()],
    });
    return token;
  }

  async function findSession(token) {
    if (!token) return null;
    const res = await client.execute({
      sql: 'SELECT sessions.*, users.email FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ? AND sessions.revoked_at IS NULL AND sessions.expires_at > ?',
      args: [hashToken(token), nowIso()],
    });
    return res.rows[0] ?? null;
  }

  async function revokeSessionToken(token) {
    if (!token) return;
    await client.execute({
      sql: 'UPDATE sessions SET revoked_at = ? WHERE token_hash = ?',
      args: [nowIso(), hashToken(token)],
    });
  }

  async function getUser(userId) {
    const res = await client.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [userId] });
    return res.rows[0] ?? null;
  }

  function publicUser(user) {
    if (!user) return null;
    return { id: user.id, email: user.email };
  }

  async function getState(userId, referenceDate) {
    const [userRes, profileRes, prefsRes, controlsRes, statsRes, drillsRes] = await Promise.all([
      client.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [userId] }),
      client.execute({ sql: 'SELECT * FROM player_profiles WHERE user_id = ?', args: [userId] }),
      client.execute({ sql: 'SELECT * FROM player_preferences WHERE user_id = ?', args: [userId] }),
      client.execute({ sql: 'SELECT action, key_value, sort_order FROM player_controls WHERE user_id = ? ORDER BY sort_order ASC', args: [userId] }),
      client.execute({ sql: 'SELECT * FROM player_stats WHERE user_id = ?', args: [userId] }),
      client.execute({ sql: 'SELECT * FROM drill_progress WHERE user_id = ?', args: [userId] }),
    ]);

    const user = userRes.rows[0] ?? null;
    const profileRow = profileRes.rows[0];
    const preferencesRow = prefsRes.rows[0];
    const controls = controlsRes.rows.map(row => ({ action: row.action, key: row.key_value }));
    const statsRow = statsRes.rows[0];
    const progressById = new Map(drillsRes.rows.map(row => [row.drill_id, row]));

    const profile = mapProfile(profileRow);
    const preferences = mapPreferences(preferencesRow);

    const drills = DRILL_CATALOG.map(drill => {
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

    const bestScores = Object.fromEntries(drills.filter(d => d.bestScore !== null).map(d => [d.id, d.bestScore]));
    const leaderboard = await sessionsForPeriod(userId, preferences.leaderboardPeriod);

    return {
      user: publicUser(user),
      account: { email: user?.email },
      profile,
      preferences,
      progression: {
        startedDrills: drills.filter(d => d.started).map(d => d.id),
        bestScores,
      },
      dailyBonus: mapDailyBonus(statsRow, referenceDate),
      controls,
      stats: mapStats(statsRow),
      drills,
      leaderboard,
    };
  }

  async function updateProfile(userId, patch) {
    const profileRes = await client.execute({ sql: 'SELECT * FROM player_profiles WHERE user_id = ?', args: [userId] });
    const current = mapProfile(profileRes.rows[0]);
    const name = typeof patch.name === 'string' && patch.name.trim() ? patch.name.trim() : current.name;
    await client.execute({
      sql: 'UPDATE player_profiles SET name = ?, initials = ?, country = ?, avatar_color = ? WHERE user_id = ?',
      args: [
        name,
        initialsFor(name),
        typeof patch.country === 'string' ? normalizeCountry(patch.country) : current.country,
        typeof patch.avatarColor === 'string' && patch.avatarColor.trim() ? patch.avatarColor.trim() : current.avatarColor,
        userId,
      ],
    });
    return getState(userId);
  }

  async function updatePreferences(userId, patch) {
    const prefsRes = await client.execute({ sql: 'SELECT * FROM player_preferences WHERE user_id = ?', args: [userId] });
    const current = mapPreferences(prefsRes.rows[0]);
    await client.execute({
      sql: 'UPDATE player_preferences SET drill_filter = ?, leaderboard_period = ? WHERE user_id = ?',
      args: [patch.drillFilter ?? current.drillFilter, patch.leaderboardPeriod ?? current.leaderboardPeriod, userId],
    });
    return getState(userId);
  }

  async function updateControls(userId, controls) {
    await client.batch(controlsStatements(userId, Array.isArray(controls) ? controls : getDefaultControls()), 'write');
    return getState(userId);
  }

  async function resetControls(userId) {
    await client.batch(controlsStatements(userId, getDefaultControls()), 'write');
    return getState(userId);
  }

  async function startDrill(userId, drillId) {
    const drill = DRILL_CATALOG.find(entry => entry.id === drillId);
    await client.execute({
      sql: 'INSERT INTO drill_progress (user_id, drill_id, workshop, started) VALUES (?, ?, ?, 1) ON CONFLICT(user_id, drill_id) DO UPDATE SET started = 1',
      args: [userId, drillId, drill?.workshop ?? null],
    });
    return getState(userId);
  }

  function defaultDrillForWorkshop(workshop) {
    if (workshop === 'defense') return 'd5';
    if (workshop === 'attack') return 'd1';
    return null;
  }

  async function recordGameSession(userId, payload) {
    const completedAt = typeof payload.completedAt === 'string' ? payload.completedAt : nowIso();
    const score = Math.max(0, Number.parseInt(payload.score, 10) || 0);
    const totalTurns = Math.max(0, Number.parseInt(payload.totalTurns, 10) || 0);
    const correct = Math.max(0, Number.parseInt(payload.correct, 10) || 0);
    if (totalTurns <= 0 || correct > totalTurns) return getState(userId);
    const durationSeconds = Math.max(0, Number.parseInt(payload.durationSeconds, 10) || 0);
    const workshop = String(payload.workshop ?? 'attack');
    const drillId = payload.drillId ? String(payload.drillId) : defaultDrillForWorkshop(workshop);
    const drill = DRILL_CATALOG.find(entry => entry.id === drillId);

    const [profileRes, statsRes] = await Promise.all([
      client.execute({ sql: 'SELECT * FROM player_profiles WHERE user_id = ?', args: [userId] }),
      client.execute({ sql: 'SELECT * FROM player_stats WHERE user_id = ?', args: [userId] }),
    ]);
    const profileRow = profileRes.rows[0];
    const statsRow = statsRes.rows[0];

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

    const statements = [
      {
        sql: 'INSERT INTO game_sessions (id, user_id, drill_id, workshop, match_id, score, correct, total_turns, duration_seconds, tactical_average, placement_average, result, accuracy, rating_before, rating_after, rating_delta, xp_gained, daily_bonus_applied, xp_multiplier, completed_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        args: [
          randomUUID(), userId, drillId, workshop,
          payload.matchId ? String(payload.matchId) : null,
          score, correct, totalTurns, durationSeconds,
          Number.isFinite(payload.tacticalAverage) ? payload.tacticalAverage : null,
          Number.isFinite(payload.placementAverage) ? payload.placementAverage : null,
          progression.session.result,
          progression.session.accuracy,
          progression.session.ratingBefore,
          progression.session.ratingAfter,
          progression.session.ratingDelta,
          progression.session.xpGained,
          progression.session.dailyBonusApplied ? 1 : 0,
          progression.session.xpMultiplier,
          completedAt,
          nowIso(),
        ],
      },
    ];

    if (drillId) {
      statements.push({
        sql: 'INSERT INTO drill_progress (user_id, drill_id, workshop, started, completed, attempts, best_score, last_played_at, last_result) VALUES (?, ?, ?, 1, ?, 1, ?, ?, ?) ON CONFLICT(user_id, drill_id) DO UPDATE SET started = 1, completed = MAX(completed, excluded.completed), attempts = attempts + 1, best_score = CASE WHEN best_score IS NULL OR excluded.best_score > best_score THEN excluded.best_score ELSE best_score END, last_played_at = excluded.last_played_at, last_result = excluded.last_result',
        args: [userId, drillId, workshop, completed, score, completedAt, progression.session.result],
      });
    }

    statements.push(
      {
        sql: 'UPDATE player_stats SET sessions_played = sessions_played + 1, total_score = total_score + ?, total_correct = total_correct + ?, total_turns = total_turns + ?, total_duration_seconds = total_duration_seconds + ?, best_score = MAX(best_score, ?), wins = ?, losses = ?, current_streak = ?, best_streak = ?, rating = ?, peak_rating = ?, last_daily_bonus_date = ?, last_played_at = ? WHERE user_id = ?',
        args: [
          score, correct, totalTurns, durationSeconds, score,
          progression.profile.wins, progression.profile.losses,
          progression.profile.streak, progression.profile.bestStreak,
          progression.profile.rating, progression.profile.peakRating,
          dailyBonusApplied ? sessionDate : (statsRow?.last_daily_bonus_date ?? null),
          completedAt,
          userId,
        ],
      },
      {
        sql: 'UPDATE player_profiles SET level = ?, xp = ?, xp_max = ?, rank = ?, rating = ?, peak_rating = ?, wins = ?, losses = ?, win_rate = ?, streak = ?, best_streak = ?, trained_seconds = ? WHERE user_id = ?',
        args: [
          progression.profile.level, progression.profile.xp, progression.profile.xpMax,
          progression.profile.rank, progression.profile.rating, progression.profile.peakRating,
          progression.profile.wins, progression.profile.losses, progression.profile.winRate,
          progression.profile.streak, progression.profile.bestStreak, progression.profile.trainedSeconds,
          userId,
        ],
      },
    );

    await client.batch(statements, 'write');
    return getState(userId, completedAt);
  }

  async function sessionsForPeriod(userId, period = 'weekly') {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const res = await client.execute(
      period === 'all-time'
        ? { sql: 'SELECT * FROM game_sessions WHERE user_id = ? ORDER BY rating_delta DESC, score DESC, accuracy DESC, completed_at DESC, created_at DESC', args: [userId] }
        : { sql: 'SELECT * FROM game_sessions WHERE user_id = ? AND completed_at >= ? ORDER BY rating_delta DESC, score DESC, accuracy DESC, completed_at DESC, created_at DESC', args: [userId, weekAgo] },
    );
    const sessions = res.rows.map(mapSession);
    const bestScore = sessions.reduce((best, s) => Math.max(best, s.score), 0);
    const totalScore = sessions.reduce((sum, s) => sum + s.score, 0);
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

  async function resetProgression(userId) {
    const profile = DEFAULT_APP_STATE.profile;
    await client.batch([
      { sql: 'DELETE FROM game_sessions WHERE user_id = ?', args: [userId] },
      { sql: 'DELETE FROM drill_progress WHERE user_id = ?', args: [userId] },
      {
        sql: 'UPDATE player_stats SET sessions_played = 0, total_score = 0, total_correct = 0, total_turns = 0, total_duration_seconds = 0, best_score = 0, wins = 0, losses = 0, current_streak = 0, best_streak = 0, rating = 600, peak_rating = 600, last_daily_bonus_date = NULL, last_played_at = NULL WHERE user_id = ?',
        args: [userId],
      },
      {
        sql: 'UPDATE player_profiles SET level = ?, xp = ?, xp_max = ?, rank = ?, rating = ?, peak_rating = ?, wins = ?, losses = ?, win_rate = ?, streak = ?, best_streak = ?, trained_seconds = ? WHERE user_id = ?',
        args: [
          profile.level, profile.xp, profile.xpMax, rankForRating(profile.rating),
          profile.rating, profile.peakRating, profile.wins, profile.losses, profile.winRate,
          profile.streak, profile.bestStreak, 0,
          userId,
        ],
      },
    ], 'write');
    return getState(userId);
  }

  return {
    auth: {
      createUser,
      findUserByEmail: async email => {
        const res = await client.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [normalizeEmail(email)] });
        return res.rows[0] ?? null;
      },
      getUser,
      publicUser,
      updatePassword: async (userId, passwordHash) => {
        await client.execute({
          sql: 'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?',
          args: [passwordHash, nowIso(), userId],
        });
      },
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
      client.close();
    },
  };
}
