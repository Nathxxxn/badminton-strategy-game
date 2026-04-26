import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createApp } from '../server/index.js';
import { createPlayerStore } from '../server/db.js';
import { DEFAULT_APP_STATE } from '../server/default-state.js';

async function withServer(fn) {
  const dir = await mkdtemp(path.join(tmpdir(), 'rally-backend-'));
  const store = createPlayerStore({ dbPath: path.join(dir, 'test.sqlite') });
  const app = createApp({ store, staticRoot: process.cwd() });
  const server = app.listen(0);

  await new Promise(resolve => server.once('listening', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await fn({ baseUrl, store });
  } finally {
    await new Promise(resolve => server.close(resolve));
    store.close();
    await rm(dir, { recursive: true, force: true });
  }
}

function sessionCookie(headers) {
  const raw = headers.get('set-cookie') ?? '';
  return raw.split(';')[0];
}

async function requestJson(baseUrl, route, options = {}) {
  const response = await fetch(`${baseUrl}${route}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  return { response, body };
}

async function signup(baseUrl, overrides = {}) {
  const { response, body } = await requestJson(baseUrl, '/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({
      email: 'player@example.com',
      password: 'secret123',
      name: 'Nadia Park',
      country: 'fr',
      ...overrides,
    }),
  });
  return { response, body, cookie: sessionCookie(response.headers) };
}

test('GET /api/health returns ok', async () => {
  await withServer(async ({ baseUrl }) => {
    const { response, body } = await requestJson(baseUrl, '/api/health');

    assert.equal(response.status, 200);
    assert.deepEqual(body, { ok: true });
  });
});

test('protected player state rejects unauthenticated requests', async () => {
  await withServer(async ({ baseUrl }) => {
    const { response, body } = await requestJson(baseUrl, '/api/player/state');

    assert.equal(response.status, 401);
    assert.equal(body.error, 'Authentication required');
  });
});

test('signup creates user, profile, preferences and stats, then sets a session cookie', async () => {
  await withServer(async ({ baseUrl }) => {
    const { response, body, cookie } = await signup(baseUrl);

    assert.equal(response.status, 201);
    assert.match(cookie, /^rally_session=/);
    assert.equal(body.user.email, 'player@example.com');
    assert.equal(body.state.profile.name, 'Nadia Park');
    assert.equal(body.state.profile.country, 'FR');
    assert.equal(body.state.profile.level, 1);
    assert.equal(body.state.profile.xp, 0);
    assert.equal(body.state.profile.rank, 'P12');
    assert.equal(body.state.profile.rating, 600);
    assert.equal(body.state.profile.peakRating, 600);
    assert.equal(body.state.profile.wins, 0);
    assert.equal(body.state.profile.losses, 0);
    assert.equal(body.state.profile.streak, 0);
    assert.equal(body.state.preferences.leaderboardPeriod, 'weekly');
    assert.equal(body.state.dailyBonus.available, true);
    assert.equal(body.state.dailyBonus.multiplier, 2);
    assert.equal(body.state.stats.sessionsPlayed, 0);
    assert.deepEqual(body.state.progression.startedDrills, []);
  });
});

test('signup rejects duplicate emails with HTTP 409', async () => {
  await withServer(async ({ baseUrl }) => {
    await signup(baseUrl);

    const { response, body } = await signup(baseUrl);

    assert.equal(response.status, 409);
    assert.equal(body.error, 'Email already registered');
  });
});

test('login validates password and sets a new session cookie', async () => {
  await withServer(async ({ baseUrl }) => {
    await signup(baseUrl);

    const { response, body, cookie } = await requestJson(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'player@example.com', password: 'secret123' }),
    }).then(result => ({ ...result, cookie: sessionCookie(result.response.headers) }));

    assert.equal(response.status, 200);
    assert.match(cookie, /^rally_session=/);
    assert.equal(body.user.email, 'player@example.com');
    assert.equal(body.state.profile.name, 'Nadia Park');
  });
});

test('GET /api/auth/me returns the authenticated user and state', async () => {
  await withServer(async ({ baseUrl }) => {
    const { cookie } = await signup(baseUrl);

    const { response, body } = await requestJson(baseUrl, '/api/auth/me', {
      headers: { cookie },
    });

    assert.equal(response.status, 200);
    assert.equal(body.user.email, 'player@example.com');
    assert.equal(body.state.profile.name, 'Nadia Park');
  });
});

test('logout invalidates the current session', async () => {
  await withServer(async ({ baseUrl }) => {
    const { cookie } = await signup(baseUrl);

    const logout = await requestJson(baseUrl, '/api/auth/logout', {
      method: 'POST',
      headers: { cookie },
    });
    const state = await requestJson(baseUrl, '/api/player/state', {
      headers: { cookie },
    });

    assert.equal(logout.response.status, 200);
    assert.deepEqual(logout.body, { ok: true });
    assert.equal(state.response.status, 401);
  });
});

test('password change requires the current password', async () => {
  await withServer(async ({ baseUrl }) => {
    const { cookie } = await signup(baseUrl);

    const rejected = await requestJson(baseUrl, '/api/auth/password', {
      method: 'PUT',
      headers: { cookie },
      body: JSON.stringify({ currentPassword: 'wrongpass', newPassword: 'changed123' }),
    });
    const accepted = await requestJson(baseUrl, '/api/auth/password', {
      method: 'PUT',
      headers: { cookie },
      body: JSON.stringify({ currentPassword: 'secret123', newPassword: 'changed123' }),
    });

    assert.equal(rejected.response.status, 400);
    assert.equal(rejected.body.error, 'Invalid current password');
    assert.equal(accepted.response.status, 200);
    assert.deepEqual(accepted.body, { ok: true });
  });
});

test('profile and preferences persist for the authenticated user', async () => {
  await withServer(async ({ baseUrl }) => {
    const { cookie } = await signup(baseUrl);

    const profile = await requestJson(baseUrl, '/api/player/profile', {
      method: 'PUT',
      headers: { cookie },
      body: JSON.stringify({ name: '  Lina Moreau  ', country: 'fra', avatarColor: '#2e6fc5' }),
    });
    const preferences = await requestJson(baseUrl, '/api/player/preferences', {
      method: 'PUT',
      headers: { cookie },
      body: JSON.stringify({ drillFilter: 'Defense', leaderboardPeriod: 'all-time' }),
    });

    assert.equal(profile.response.status, 200);
    assert.equal(profile.body.profile.name, 'Lina Moreau');
    assert.equal(profile.body.profile.country, 'FR');
    assert.equal(preferences.response.status, 200);
    assert.equal(preferences.body.preferences.drillFilter, 'Defense');
    assert.equal(preferences.body.preferences.leaderboardPeriod, 'all-time');
  });
});

test('PUT /api/player/preferences rejects invalid leaderboard period', async () => {
  await withServer(async ({ baseUrl }) => {
    const { cookie } = await signup(baseUrl);
    const { response, body } = await requestJson(baseUrl, '/api/player/preferences', {
      method: 'PUT',
      headers: { cookie },
      body: JSON.stringify({ leaderboardPeriod: 'monthly' }),
    });

    assert.equal(response.status, 400);
    assert.equal(body.error, 'Invalid preferences');
  });
});

test('PUT /api/player/preferences rejects removed Strategy drill filter', async () => {
  await withServer(async ({ baseUrl }) => {
    const { cookie } = await signup(baseUrl);
    const { response, body } = await requestJson(baseUrl, '/api/player/preferences', {
      method: 'PUT',
      headers: { cookie },
      body: JSON.stringify({ drillFilter: 'Strategy' }),
    });

    assert.equal(response.status, 400);
    assert.equal(body.error, 'Invalid preferences');
  });
});

test('POST /api/player/drills/:drillId/start does not duplicate drills', async () => {
  await withServer(async ({ baseUrl }) => {
    const { cookie } = await signup(baseUrl);

    await requestJson(baseUrl, '/api/player/drills/d1/start', { method: 'POST', headers: { cookie } });
    const { response, body } = await requestJson(baseUrl, '/api/player/drills/d1/start', { method: 'POST', headers: { cookie } });

    assert.equal(response.status, 200);
    assert.deepEqual(body.progression.startedDrills, ['d1']);
    assert.equal(body.drills.find(drill => drill.id === 'd1').started, true);
  });
});

test('POST /api/game-sessions records a competitive win with rating, XP, best score and completion', async () => {
  await withServer(async ({ baseUrl }) => {
    const { cookie } = await signup(baseUrl);

    const { response, body } = await requestJson(baseUrl, '/api/game-sessions', {
      method: 'POST',
      headers: { cookie },
      body: JSON.stringify({
        drillId: 'd1',
        workshop: 'attack',
        matchId: 'MATCH_ATTACK_001',
        score: 320,
        correct: 3,
        totalTurns: 4,
        durationSeconds: 180,
        tacticalAverage: 82,
        placementAverage: 78,
        completedAt: '2026-04-25T12:00:00.000Z',
      }),
    });

    const drill = body.drills.find(entry => entry.id === 'd1');
    assert.equal(response.status, 201);
    assert.equal(body.stats.sessionsPlayed, 1);
    assert.equal(body.profile.wins, 1);
    assert.equal(body.profile.losses, 0);
    assert.equal(body.profile.streak, 1);
    assert.equal(body.profile.bestStreak, 1);
    assert.ok(body.profile.rating > DEFAULT_APP_STATE.profile.rating);
    assert.equal(body.profile.peakRating, body.profile.rating);
    assert.ok(body.profile.xp > DEFAULT_APP_STATE.profile.xp);
    assert.equal(body.profile.trained, '3m');
    assert.equal(drill.attempts, 1);
    assert.equal(drill.completed, true);
    assert.equal(drill.bestScore, 320);
    assert.equal(body.progression.bestScores.d1, 320);
    assert.equal(body.leaderboard.sessions[0].result, 'W');
    assert.ok(body.leaderboard.sessions[0].ratingDelta > 0);
    assert.equal(body.leaderboard.sessions[0].accuracy, 75);
    assert.equal(body.leaderboard.sessions[0].dailyBonusApplied, true);
    assert.equal(body.leaderboard.sessions[0].xpMultiplier, 2);
    assert.equal(body.leaderboard.sessions[0].xpGained, 620);
    assert.equal(body.dailyBonus.available, false);
    assert.equal(body.dailyBonus.lastClaimedDate, '2026-04-25');
  });
});

test('daily bonus doubles XP only for the first completed session of the local day', async () => {
  await withServer(async ({ baseUrl }) => {
    const { cookie } = await signup(baseUrl);

    const first = await requestJson(baseUrl, '/api/game-sessions', {
      method: 'POST',
      headers: { cookie },
      body: JSON.stringify({
        drillId: 'd1',
        workshop: 'attack',
        score: 320,
        correct: 3,
        totalTurns: 4,
        durationSeconds: 180,
        completedAt: '2026-04-25T08:00:00.000Z',
      }),
    });
    const second = await requestJson(baseUrl, '/api/game-sessions', {
      method: 'POST',
      headers: { cookie },
      body: JSON.stringify({
        drillId: 'd1',
        workshop: 'attack',
        score: 320,
        correct: 3,
        totalTurns: 4,
        durationSeconds: 180,
        completedAt: '2026-04-25T18:00:00.000Z',
      }),
    });

    const firstSession = first.body.leaderboard.sessions.find(session => session.completedAt === '2026-04-25T08:00:00.000Z');
    const secondSession = second.body.leaderboard.sessions.find(session => session.completedAt === '2026-04-25T18:00:00.000Z');
    assert.equal(first.response.status, 201);
    assert.equal(second.response.status, 201);
    assert.equal(firstSession.dailyBonusApplied, true);
    assert.equal(firstSession.xpGained, 620);
    assert.equal(secondSession.dailyBonusApplied, false);
    assert.equal(secondSession.xpMultiplier, 1);
    assert.equal(secondSession.xpGained, 310);
    assert.equal(second.body.dailyBonus.available, false);
  });
});

test('POST /api/game-sessions records a competitive loss with limited rating drop and streak reset', async () => {
  await withServer(async ({ baseUrl }) => {
    const { cookie } = await signup(baseUrl);

    await requestJson(baseUrl, '/api/game-sessions', {
      method: 'POST',
      headers: { cookie },
      body: JSON.stringify({ drillId: 'd1', workshop: 'attack', score: 320, correct: 3, totalTurns: 4, durationSeconds: 180 }),
    });
    const { response, body } = await requestJson(baseUrl, '/api/game-sessions', {
      method: 'POST',
      headers: { cookie },
      body: JSON.stringify({ drillId: 'd1', workshop: 'attack', score: 60, correct: 1, totalTurns: 4, durationSeconds: 90 }),
    });

    const latest = body.leaderboard.sessions.find(session => session.result === 'L');
    assert.equal(response.status, 201);
    assert.equal(body.profile.wins, 1);
    assert.equal(body.profile.losses, 1);
    assert.equal(body.profile.streak, 0);
    assert.equal(body.profile.bestStreak, 1);
    assert.equal(latest.result, 'L');
    assert.ok(latest.ratingDelta < 0);
    assert.ok(latest.ratingDelta >= -18);
  });
});

test('competitive rank updates when rating crosses French badminton thresholds', async () => {
  await withServer(async ({ baseUrl }) => {
    const { cookie } = await signup(baseUrl);
    let state = null;

    for (let index = 0; index < 4; index += 1) {
      const result = await requestJson(baseUrl, '/api/game-sessions', {
        method: 'POST',
        headers: { cookie },
        body: JSON.stringify({ drillId: 'd1', workshop: 'attack', score: 500, correct: 4, totalTurns: 4, durationSeconds: 120 }),
      });
      state = result.body;
    }

    assert.ok(state.profile.rating >= 720);
    assert.notEqual(state.profile.rank, 'P12');
  });
});

test('personal leaderboard filters weekly and all-time game sessions', async () => {
  await withServer(async ({ baseUrl }) => {
    const { cookie } = await signup(baseUrl);
    await requestJson(baseUrl, '/api/game-sessions', {
      method: 'POST',
      headers: { cookie },
      body: JSON.stringify({ drillId: 'd1', workshop: 'attack', matchId: 'old', score: 100, correct: 1, totalTurns: 4, durationSeconds: 60, completedAt: '2026-03-01T12:00:00.000Z' }),
    });
    await requestJson(baseUrl, '/api/game-sessions', {
      method: 'POST',
      headers: { cookie },
      body: JSON.stringify({ drillId: 'd5', workshop: 'defense', matchId: 'new', score: 240, correct: 3, totalTurns: 4, durationSeconds: 120, completedAt: new Date().toISOString() }),
    });

    const weekly = await requestJson(baseUrl, '/api/player/leaderboard?period=weekly', { headers: { cookie } });
    const allTime = await requestJson(baseUrl, '/api/player/leaderboard?period=all-time', { headers: { cookie } });

    assert.equal(weekly.response.status, 200);
    assert.equal(weekly.body.sessions.length, 1);
    assert.equal(weekly.body.sessions[0].matchId, 'new');
    assert.equal(weekly.body.sessions[0].result, 'W');
    assert.equal(typeof weekly.body.sessions[0].ratingDelta, 'number');
    assert.equal(weekly.body.sessions[0].accuracy, 75);
    assert.equal(allTime.body.sessions.length, 2);
    assert.equal(allTime.body.summary.bestScore, 240);
  });
});

test('POST /api/player/controls/reset restores default controls', async () => {
  await withServer(async ({ baseUrl }) => {
    const { cookie } = await signup(baseUrl);
    await requestJson(baseUrl, '/api/player/controls', {
      method: 'PUT',
      headers: { cookie },
      body: JSON.stringify({ controls: [{ action: 'Pause', key: 'P' }] }),
    });

    const { response, body } = await requestJson(baseUrl, '/api/player/controls/reset', { method: 'POST', headers: { cookie } });

    assert.equal(response.status, 200);
    assert.deepEqual(body.controls, DEFAULT_APP_STATE.controls);
  });
});

test('reset progression clears sessions and drill progress but keeps account and profile', async () => {
  await withServer(async ({ baseUrl }) => {
    const { cookie } = await signup(baseUrl);
    await requestJson(baseUrl, '/api/game-sessions', {
      method: 'POST',
      headers: { cookie },
      body: JSON.stringify({ drillId: 'd1', workshop: 'attack', matchId: 'MATCH_ATTACK_001', score: 320, correct: 3, totalTurns: 4, durationSeconds: 180 }),
    });

    const reset = await requestJson(baseUrl, '/api/player/reset-progression', {
      method: 'POST',
      headers: { cookie },
    });

    assert.equal(reset.response.status, 200);
    assert.equal(reset.body.user.email, 'player@example.com');
    assert.equal(reset.body.profile.name, 'Nadia Park');
    assert.equal(reset.body.profile.rating, 600);
    assert.equal(reset.body.profile.rank, 'P12');
    assert.equal(reset.body.profile.wins, 0);
    assert.equal(reset.body.profile.losses, 0);
    assert.equal(reset.body.profile.streak, 0);
    assert.equal(reset.body.stats.sessionsPlayed, 0);
    assert.equal(reset.body.dailyBonus.available, true);
    assert.equal(reset.body.dailyBonus.lastClaimedDate, null);
    assert.deepEqual(reset.body.progression.startedDrills, []);
    assert.equal(reset.body.drills.find(drill => drill.id === 'd1').attempts, 0);
  });
});
