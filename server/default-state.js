export const DEFAULT_CONTROLS = Object.freeze([
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

export function cloneDefaultState() {
  return JSON.parse(JSON.stringify(DEFAULT_APP_STATE));
}
