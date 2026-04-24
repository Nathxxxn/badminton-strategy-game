const STORAGE_KEY = 'rally.appState.v1';

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
    level: 12,
    xp: 1240,
    xpMax: 2000,
    rank: 'Silver III',
    wins: 47,
    winRate: 61,
    streak: 5,
    bestStreak: 9,
    trained: '18h 22m',
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
  const storage = getStorage();
  const next = mergeState(loadAppState(), patch);
  if (storage) storage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
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
