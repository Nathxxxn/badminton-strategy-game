import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createPlayerStore } from './db.js';
import { DEFAULT_APP_STATE } from './default-state.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DRILL_FILTERS = new Set(['All', 'Attack', 'Defense', 'Strategy']);
const LEADERBOARD_PERIODS = new Set(['weekly', 'all-time']);

function badRequest(res, error) {
  return res.status(400).json({ error });
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

export function createApp({ store = createPlayerStore(), staticRoot = PROJECT_ROOT } = {}) {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '32kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/player/state', (_req, res) => {
    res.json(store.getState());
  });

  app.put('/api/player/profile', (req, res) => {
    const profilePatch = sanitizeProfile(req.body ?? {});
    res.json(store.updateState({ profile: profilePatch }));
  });

  app.put('/api/player/preferences', (req, res) => {
    const preferencesPatch = sanitizePreferences(req.body ?? {});
    if (!preferencesPatch) return badRequest(res, 'Invalid preferences');
    return res.json(store.updateState({ preferences: preferencesPatch }));
  });

  app.post('/api/player/drills/:drillId/start', (req, res) => {
    const state = store.getState();
    const drillId = String(req.params.drillId ?? '').trim();
    const startedDrills = drillId && !state.progression.startedDrills.includes(drillId)
      ? state.progression.startedDrills.concat(drillId)
      : state.progression.startedDrills;
    res.json(store.updateState({ progression: { startedDrills } }));
  });

  app.post('/api/player/controls/reset', (_req, res) => {
    res.json(store.updateState({ controls: DEFAULT_APP_STATE.controls }));
  });

  app.use(express.static(staticRoot));

  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 3000);
  const app = createApp();
  app.listen(port, () => {
    console.log(`Rally dev server running at http://localhost:${port}`);
  });
}
