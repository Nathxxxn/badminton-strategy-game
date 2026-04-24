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
