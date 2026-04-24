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
  resetControls,
  saveAppState,
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
