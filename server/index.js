import bcrypt from 'bcryptjs';
import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createPlayerStore } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DRILL_FILTERS = new Set(['All', 'Attack', 'Defense']);
const LEADERBOARD_PERIODS = new Set(['weekly', 'all-time']);
const SESSION_COOKIE = 'rally_session';
const PASSWORD_MIN_LENGTH = 6;

function badRequest(res, error) {
  return res.status(400).json({ error });
}

function unauthorized(res) {
  return res.status(401).json({ error: 'Authentication required' });
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 1000 * 60 * 60 * 24 * 30,
  };
}

function clearCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  };
}

function parseCookies(header = '') {
  return Object.fromEntries(
    String(header)
      .split(';')
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => {
        const [key, ...value] = part.split('=');
        return [decodeURIComponent(key), decodeURIComponent(value.join('='))];
      }),
  );
}

function sessionTokenFromRequest(req) {
  return parseCookies(req.headers.cookie)[SESSION_COOKIE] ?? null;
}

function sanitizeProfile(body) {
  const patch = {};
  if (typeof body.name === 'string') {
    const name = body.name.trim();
    if (name) patch.name = name;
  }
  if (typeof body.country === 'string') {
    const country = body.country.trim().slice(0, 2).toUpperCase();
    if (country) patch.country = country;
  }
  if (typeof body.avatarColor === 'string' && body.avatarColor.trim()) {
    patch.avatarColor = body.avatarColor.trim();
  }
  return patch;
}

function sanitizePreferences(body) {
  const patch = {};
  if (body.drillFilter !== undefined) {
    if (!DRILL_FILTERS.has(body.drillFilter)) return null;
    patch.drillFilter = body.drillFilter;
  }
  if (body.leaderboardPeriod !== undefined) {
    if (!LEADERBOARD_PERIODS.has(body.leaderboardPeriod)) return null;
    patch.leaderboardPeriod = body.leaderboardPeriod;
  }
  return patch;
}

function sanitizeControls(body) {
  if (!Array.isArray(body.controls)) return null;
  return body.controls
    .filter(bind => typeof bind?.action === 'string' && typeof bind?.key === 'string')
    .map(bind => ({ action: bind.action.trim(), key: bind.key.trim() }))
    .filter(bind => bind.action && bind.key);
}

function sanitizeSignup(body) {
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  const name = String(body.name ?? '').trim();
  const country = String(body.country ?? '').trim();
  if (!email.includes('@')) return null;
  if (password.length < PASSWORD_MIN_LENGTH) return null;
  if (!name) return null;
  return { email, password, name, country };
}

function sanitizeLogin(body) {
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  if (!email || !password) return null;
  return { email, password };
}

async function authPayload(store, userId) {
  const user = await store.auth.getUser(userId);
  return {
    user: store.auth.publicUser(user),
    state: await store.getState(userId),
  };
}

function requireAuth(store) {
  return async (req, res, next) => {
    const token = sessionTokenFromRequest(req);
    const session = await store.auth.findSession(token);
    if (!session) return unauthorized(res);
    req.sessionToken = token;
    req.user = { id: session.user_id, email: session.email };
    return next();
  };
}

export function createApp({ store, staticRoot = PROJECT_ROOT } = {}) {
  const app = express();
  const protectedRoute = requireAuth(store);

  app.use(cors({ credentials: true, origin: true }));
  app.use(express.json({ limit: '64kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/auth/signup', async (req, res) => {
    const input = sanitizeSignup(req.body ?? {});
    if (!input) return badRequest(res, 'Invalid signup');
    if (await store.auth.findUserByEmail(input.email)) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await store.auth.createUser({ ...input, passwordHash });
    const token = await store.auth.createSession(user.id);
    res.cookie(SESSION_COOKIE, token, cookieOptions());
    return res.status(201).json(await authPayload(store, user.id));
  });

  app.post('/api/auth/login', async (req, res) => {
    const input = sanitizeLogin(req.body ?? {});
    if (!input) return badRequest(res, 'Invalid login');
    const user = await store.auth.findUserByEmail(input.email);
    if (!user || !(await bcrypt.compare(input.password, user.password_hash))) {
      return unauthorized(res);
    }
    const token = await store.auth.createSession(user.id);
    res.cookie(SESSION_COOKIE, token, cookieOptions());
    return res.json(await authPayload(store, user.id));
  });

  app.post('/api/auth/logout', protectedRoute, async (req, res) => {
    await store.auth.revokeSessionToken(req.sessionToken);
    res.cookie(SESSION_COOKIE, '', clearCookieOptions());
    res.json({ ok: true });
  });

  app.get('/api/auth/me', protectedRoute, async (req, res) => {
    res.json(await authPayload(store, req.user.id));
  });

  app.put('/api/auth/password', protectedRoute, async (req, res) => {
    const currentPassword = String(req.body?.currentPassword ?? '');
    const newPassword = String(req.body?.newPassword ?? '');
    if (newPassword.length < PASSWORD_MIN_LENGTH) return badRequest(res, 'Invalid new password');
    const user = await store.auth.getUser(req.user.id);
    if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) {
      return badRequest(res, 'Invalid current password');
    }
    await store.auth.updatePassword(req.user.id, await bcrypt.hash(newPassword, 12));
    return res.json({ ok: true });
  });

  app.get('/api/player/state', protectedRoute, async (req, res) => {
    res.json(await store.getState(req.user.id));
  });

  app.put('/api/player/profile', protectedRoute, async (req, res) => {
    res.json(await store.updateProfile(req.user.id, sanitizeProfile(req.body ?? {})));
  });

  app.put('/api/player/preferences', protectedRoute, async (req, res) => {
    const preferencesPatch = sanitizePreferences(req.body ?? {});
    if (!preferencesPatch) return badRequest(res, 'Invalid preferences');
    return res.json(await store.updatePreferences(req.user.id, preferencesPatch));
  });

  app.put('/api/player/controls', protectedRoute, async (req, res) => {
    const controls = sanitizeControls(req.body ?? {});
    if (!controls) return badRequest(res, 'Invalid controls');
    return res.json(await store.updateControls(req.user.id, controls));
  });

  app.post('/api/player/controls/reset', protectedRoute, async (req, res) => {
    res.json(await store.resetControls(req.user.id));
  });

  app.post('/api/player/reset-progression', protectedRoute, async (req, res) => {
    res.json(await store.resetProgression(req.user.id));
  });

  app.post('/api/player/drills/:drillId/start', protectedRoute, async (req, res) => {
    const drillId = String(req.params.drillId ?? '').trim();
    if (!drillId) return badRequest(res, 'Invalid drill');
    res.json(await store.startDrill(req.user.id, drillId));
  });

  app.get('/api/player/drills', protectedRoute, async (req, res) => {
    res.json({ drills: (await store.getState(req.user.id)).drills });
  });

  app.get('/api/player/leaderboard', protectedRoute, async (req, res) => {
    const period = LEADERBOARD_PERIODS.has(req.query.period) ? req.query.period : 'weekly';
    res.json(await store.sessionsForPeriod(req.user.id, period));
  });

  app.post('/api/game-sessions', protectedRoute, async (req, res) => {
    res.status(201).json(await store.recordGameSession(req.user.id, req.body ?? {}));
  });

  app.get('/api/game-sessions', protectedRoute, async (req, res) => {
    const period = LEADERBOARD_PERIODS.has(req.query.period) ? req.query.period : 'weekly';
    res.json(await store.sessionsForPeriod(req.user.id, period));
  });

  app.use(express.static(staticRoot));

  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 3000);
  const store = await createPlayerStore();
  const app = createApp({ store });
  app.listen(port, () => {
    console.log(`Rally server running at http://localhost:${port}`);
  });
}
