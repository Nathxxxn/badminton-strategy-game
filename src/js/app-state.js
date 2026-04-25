const STORAGE_KEY = 'rally.appState.v1';

import {
  changeBackendPassword,
  fetchBackendState,
  fetchBackendSession,
  loginBackend,
  logoutBackend,
  recordBackendDrillStart,
  recordBackendGameSession,
  resetBackendControls,
  resetBackendProgression,
  saveBackendPreferences,
  saveBackendProfile,
  signupBackend,
} from './api-client.js';

const DEFAULT_CONTROLS = Object.freeze([
  { action: 'Select Smash', key: '1' },
  { action: 'Select Drop', key: '2' },
  { action: 'Select Clear', key: '3' },
  { action: 'Select Drive', key: '4' },
  { action: 'Target Left', key: 'A / ←' },
  { action: 'Target Center', key: 'S / ↓' },
  { action: 'Target Right', key: 'D / →' },
  { action: 'Confirm Shot', key: 'Space' },
  { action: 'Pause', key: 'Esc' },
]);

export const DEFAULT_APP_STATE = Object.freeze({
  profile: Object.freeze({
    name: 'Alex Kim',
    initials: 'AK',
    country: 'KR',
    avatarColor: '#ffd23f',
    level: 1,
    xp: 0,
    xpMax: 500,
    rank: 'P12',
    rating: 600,
    peakRating: 600,
    wins: 0,
    losses: 0,
    winRate: 0,
    streak: 0,
    bestStreak: 0,
    trained: '0m',
  }),
  preferences: Object.freeze({
    drillFilter: 'All',
    leaderboardPeriod: 'weekly',
  }),
  progression: Object.freeze({
    startedDrills: Object.freeze([]),
    bestScores: Object.freeze({}),
  }),
  controls: DEFAULT_CONTROLS,
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mergeState(base, patch) {
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

function normalizeState(value) {
  return mergeState(DEFAULT_APP_STATE, value);
}

function getStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function cacheState(state) {
  const storage = getStorage();
  const normalized = normalizeState(state);
  if (storage) storage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

function clearCachedState() {
  const storage = getStorage();
  if (storage) storage.removeItem(STORAGE_KEY);
}

export function loadAppState() {
  const storage = getStorage();
  if (!storage) return clone(DEFAULT_APP_STATE);

  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return clone(DEFAULT_APP_STATE);

  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    storage.removeItem(STORAGE_KEY);
    return clone(DEFAULT_APP_STATE);
  }
}

export function saveAppState(patch) {
  const next = mergeState(loadAppState(), patch);
  return cacheState(next);
}

export function resetControls() {
  return saveAppState({ controls: DEFAULT_APP_STATE.controls });
}

export function recordDrillStart(drillId) {
  const state = loadAppState();
  const startedDrills = state.progression.startedDrills.includes(drillId)
    ? state.progression.startedDrills
    : state.progression.startedDrills.concat(drillId);

  return saveAppState({ progression: { startedDrills } });
}

export async function loadAppStateAsync() {
  const backendState = await fetchBackendState();
  if (backendState) return cacheState(backendState);
  return loadAppState();
}

export async function loadSessionAsync() {
  const payload = await fetchBackendSession();
  if (payload?.state) cacheState(payload.state);
  return payload;
}

export async function signupAsync(credentials) {
  const payload = await signupBackend(credentials);
  if (payload?.state) cacheState(payload.state);
  return payload;
}

export async function loginAsync(credentials) {
  const payload = await loginBackend(credentials);
  if (payload?.state) cacheState(payload.state);
  return payload;
}

export async function logoutAsync() {
  const ok = await logoutBackend();
  if (ok) clearCachedState();
  return ok;
}

export function changePasswordAsync(passwordPatch) {
  return changeBackendPassword(passwordPatch);
}

export async function saveAppStateAsync(patch) {
  let backendState = null;

  if (patch?.profile) {
    backendState = await saveBackendProfile(patch.profile);
  }

  if (patch?.preferences) {
    backendState = await saveBackendPreferences(patch.preferences);
  }

  if (backendState) return cacheState(backendState);
  return saveAppState(patch);
}

export async function resetControlsAsync() {
  const backendState = await resetBackendControls();
  if (backendState) return cacheState(backendState);
  return resetControls();
}

export async function resetProgressionAsync() {
  const backendState = await resetBackendProgression();
  if (backendState) return cacheState(backendState);
  return saveAppState({ progression: DEFAULT_APP_STATE.progression });
}

export async function recordDrillStartAsync(drillId) {
  const backendState = await recordBackendDrillStart(drillId);
  if (backendState) return cacheState(backendState);
  return recordDrillStart(drillId);
}

export async function recordGameSessionAsync(sessionSummary) {
  const backendState = await recordBackendGameSession(sessionSummary);
  if (backendState) return cacheState(backendState);
  return loadAppState();
}
