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

async function requestJson(baseUrl, route, options = {}) {
  const response = await fetch(`${baseUrl}${route}`, {
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
    ...options,
  });
  const body = await response.json();
  return { response, body };
}

test('GET /api/health returns ok', async () => {
  await withServer(async ({ baseUrl }) => {
    const { response, body } = await requestJson(baseUrl, '/api/health');

    assert.equal(response.status, 200);
    assert.deepEqual(body, { ok: true });
  });
});

test('GET /api/player/state initializes default state', async () => {
  await withServer(async ({ baseUrl }) => {
    const { response, body } = await requestJson(baseUrl, '/api/player/state');

    assert.equal(response.status, 200);
    assert.equal(body.profile.name, DEFAULT_APP_STATE.profile.name);
    assert.equal(body.preferences.leaderboardPeriod, 'weekly');
    assert.deepEqual(body.progression.startedDrills, []);
  });
});

test('PUT /api/player/profile persists name and normalized country', async () => {
  await withServer(async ({ baseUrl }) => {
    const { response, body } = await requestJson(baseUrl, '/api/player/profile', {
      method: 'PUT',
      body: JSON.stringify({ name: '  Nadia Park  ', country: 'fra', avatarColor: '#2e6fc5' }),
    });
    const { body: reloaded } = await requestJson(baseUrl, '/api/player/state');

    assert.equal(response.status, 200);
    assert.equal(body.profile.name, 'Nadia Park');
    assert.equal(body.profile.country, 'FR');
    assert.equal(reloaded.profile.avatarColor, '#2e6fc5');
  });
});

test('PUT /api/player/preferences rejects invalid leaderboard period', async () => {
  await withServer(async ({ baseUrl }) => {
    const { response, body } = await requestJson(baseUrl, '/api/player/preferences', {
      method: 'PUT',
      body: JSON.stringify({ leaderboardPeriod: 'monthly' }),
    });

    assert.equal(response.status, 400);
    assert.equal(body.error, 'Invalid preferences');
  });
});

test('POST /api/player/drills/:drillId/start does not duplicate drills', async () => {
  await withServer(async ({ baseUrl }) => {
    await requestJson(baseUrl, '/api/player/drills/d1/start', { method: 'POST' });
    const { response, body } = await requestJson(baseUrl, '/api/player/drills/d1/start', { method: 'POST' });

    assert.equal(response.status, 200);
    assert.deepEqual(body.progression.startedDrills, ['d1']);
  });
});

test('POST /api/player/controls/reset restores default controls', async () => {
  await withServer(async ({ baseUrl, store }) => {
    store.updateState({ controls: [{ action: 'Pause', key: 'P' }] });

    const { response, body } = await requestJson(baseUrl, '/api/player/controls/reset', { method: 'POST' });

    assert.equal(response.status, 200);
    assert.deepEqual(body.controls, DEFAULT_APP_STATE.controls);
  });
});
