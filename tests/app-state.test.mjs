import assert from 'node:assert/strict';
import test from 'node:test';

const storage = new Map();

globalThis.localStorage = {
  getItem(key) {
    return storage.has(key) ? storage.get(key) : null;
  },
  setItem(key, value) {
    storage.set(key, String(value));
  },
  removeItem(key) {
    storage.delete(key);
  },
};

const {
  DEFAULT_APP_STATE,
  loadAppState,
  loadAppStateAsync,
  loginAsync,
  logoutAsync,
  recordGameSessionAsync,
  resetControls,
  resetControlsAsync,
  saveAppStateAsync,
  saveAppState,
  recordDrillStartAsync,
} = await import('../src/js/app-state.js');

test('loadAppState returns defaults when storage is empty', () => {
  storage.clear();

  const state = loadAppState();

  assert.equal(state.profile.name, 'Alex Kim');
  assert.equal(state.profile.country, 'KR');
  assert.equal(state.preferences.leaderboardPeriod, 'weekly');
  assert.equal(state.preferences.drillFilter, 'All');
  assert.equal(state.progression.startedDrills.length, 0);
});

test('saveAppState persists nested profile and preferences without losing defaults', () => {
  storage.clear();

  const state = saveAppState({
    profile: { name: 'Nadia Park', avatarColor: '#2e6fc5' },
    preferences: { leaderboardPeriod: 'all-time' },
  });
  const reloaded = loadAppState();

  assert.equal(state.profile.name, 'Nadia Park');
  assert.equal(reloaded.profile.name, 'Nadia Park');
  assert.equal(reloaded.profile.country, DEFAULT_APP_STATE.profile.country);
  assert.equal(reloaded.profile.avatarColor, '#2e6fc5');
  assert.equal(reloaded.preferences.leaderboardPeriod, 'all-time');
  assert.equal(reloaded.preferences.drillFilter, 'All');
});

test('resetControls restores default keybinds and keeps other state', () => {
  storage.clear();
  saveAppState({
    profile: { name: 'Nadia Park' },
    controls: [{ action: 'Pause', key: 'P' }],
  });

  const state = resetControls();

  assert.equal(state.profile.name, 'Nadia Park');
  assert.deepEqual(state.controls, DEFAULT_APP_STATE.controls);
});

test('default controls match playable shot hotkeys', () => {
  assert.deepEqual(DEFAULT_APP_STATE.controls.slice(0, 6), [
    { action: 'Select Smash', key: '1' },
    { action: 'Select Drop', key: '2' },
    { action: 'Select Drive', key: '3' },
    { action: 'Select Clear', key: '4' },
    { action: 'Select Kill', key: '5' },
    { action: 'Select Net drop', key: '6' },
  ]);
});

test('loadAppStateAsync uses backend state and mirrors it to localStorage', async () => {
  storage.clear();
  globalThis.fetch = async url => {
    assert.equal(url, '/api/player/state');
    return new Response(JSON.stringify({
      ...DEFAULT_APP_STATE,
      profile: { ...DEFAULT_APP_STATE.profile, name: 'Backend Player' },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  const state = await loadAppStateAsync();
  const cached = loadAppState();

  assert.equal(state.profile.name, 'Backend Player');
  assert.equal(cached.profile.name, 'Backend Player');
});

test('saveAppStateAsync saves profile patches through backend when available', async () => {
  storage.clear();
  let payload = null;
  globalThis.fetch = async (url, options) => {
    payload = { url, options };
    return new Response(JSON.stringify({
      ...DEFAULT_APP_STATE,
      profile: { ...DEFAULT_APP_STATE.profile, name: 'API Name' },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  const state = await saveAppStateAsync({ profile: { name: 'API Name' } });

  assert.equal(payload.url, '/api/player/profile');
  assert.equal(payload.options.method, 'PUT');
  assert.equal(state.profile.name, 'API Name');
  assert.equal(loadAppState().profile.name, 'API Name');
});

test('async helpers fall back to localStorage when backend is unavailable', async () => {
  storage.clear();
  const originalWarn = console.warn;
  console.warn = () => {};
  globalThis.fetch = async () => {
    throw new Error('offline');
  };

  try {
    const saved = await saveAppStateAsync({ preferences: { drillFilter: 'Defense' } });
    const drilled = await recordDrillStartAsync('d1');
    const reset = await resetControlsAsync();

    assert.equal(saved.preferences.drillFilter, 'Defense');
    assert.deepEqual(drilled.progression.startedDrills, ['d1']);
    assert.deepEqual(reset.controls, DEFAULT_APP_STATE.controls);
  } finally {
    console.warn = originalWarn;
  }
});

test('loginAsync returns backend auth payload and caches authenticated state', async () => {
  storage.clear();
  globalThis.fetch = async url => {
    assert.equal(url, '/api/auth/login');
    return new Response(JSON.stringify({
      user: { email: 'player@example.com' },
      state: {
        ...DEFAULT_APP_STATE,
        user: { email: 'player@example.com' },
        profile: { ...DEFAULT_APP_STATE.profile, name: 'Nadia Park' },
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  const payload = await loginAsync({ email: 'player@example.com', password: 'secret123' });

  assert.equal(payload.user.email, 'player@example.com');
  assert.equal(payload.state.profile.name, 'Nadia Park');
  assert.equal(loadAppState().profile.name, 'Nadia Park');
});

test('recordGameSessionAsync mirrors backend progression state', async () => {
  storage.clear();
  globalThis.fetch = async url => {
    assert.equal(url, '/api/game-sessions');
    return new Response(JSON.stringify({
      ...DEFAULT_APP_STATE,
      stats: { sessionsPlayed: 1 },
      progression: { startedDrills: ['d1'], bestScores: { d1: 320 } },
    }), { status: 201, headers: { 'content-type': 'application/json' } });
  };

  const state = await recordGameSessionAsync({ drillId: 'd1', workshop: 'attack', score: 320 });

  assert.equal(state.stats.sessionsPlayed, 1);
  assert.equal(loadAppState().progression.bestScores.d1, 320);
});

test('logoutAsync clears cached authenticated state', async () => {
  storage.clear();
  saveAppState({ profile: { name: 'Nadia Park' } });
  globalThis.fetch = async url => {
    assert.equal(url, '/api/auth/logout');
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  const ok = await logoutAsync();

  assert.equal(ok, true);
  assert.equal(storage.has('rally.appState.v1'), false);
});
