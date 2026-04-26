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
  dailyBonus: Object.freeze({
    available: true,
    multiplier: 2,
    lastClaimedDate: null,
  }),
  controls: DEFAULT_CONTROLS,
});

export function cloneDefaultState() {
  return JSON.parse(JSON.stringify(DEFAULT_APP_STATE));
}
