export const STARTING_RATING = 600;
export const STARTING_LEVEL = 1;
export const STARTING_XP = 0;
export const STARTING_XP_MAX = 500;
export const WIN_ACCURACY_THRESHOLD = 60;

const RANK_THRESHOLDS = Object.freeze([
  { min: 1860, rank: 'N1' },
  { min: 1740, rank: 'N2' },
  { min: 1620, rank: 'N3' },
  { min: 1500, rank: 'R4' },
  { min: 1380, rank: 'R5' },
  { min: 1260, rank: 'R6' },
  { min: 1140, rank: 'D7' },
  { min: 1020, rank: 'D8' },
  { min: 900, rank: 'D9' },
  { min: 780, rank: 'P10' },
  { min: 720, rank: 'P10' },
  { min: 660, rank: 'P11' },
  { min: 0, rank: 'P12' },
]);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function numberOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function xpMaxForLevel(level) {
  return STARTING_XP_MAX + Math.max(0, level - 1) * 125;
}

export function rankForRating(rating) {
  const normalized = Math.max(0, Math.round(numberOr(rating, STARTING_RATING)));
  return RANK_THRESHOLDS.find(entry => normalized >= entry.min)?.rank ?? 'P12';
}

export function calculateProgression({ current, session }) {
  const score = Math.max(0, Math.round(numberOr(session.score, 0)));
  const totalTurns = Math.max(1, Math.round(numberOr(session.totalTurns, 1)));
  const correct = clamp(Math.round(numberOr(session.correct, 0)), 0, totalTurns);
  const durationSeconds = Math.max(0, Math.round(numberOr(session.durationSeconds, 0)));
  const difficulty = clamp(Math.round(numberOr(session.difficulty, 2)), 1, 4);
  const accuracy = Math.round((correct / totalTurns) * 100);
  const won = accuracy >= WIN_ACCURACY_THRESHOLD;

  const ratingBefore = Math.max(0, Math.round(numberOr(current.rating, STARTING_RATING)));
  const scoreBonus = Math.min(12, Math.floor(score / 100));
  const accuracyBonus = Math.max(0, Math.round((accuracy - WIN_ACCURACY_THRESHOLD) / 5));
  const difficultyBonus = difficulty * 2;
  const ratingDelta = won
    ? 18 + scoreBonus + accuracyBonus + difficultyBonus
    : -Math.min(18, 8 + Math.round((WIN_ACCURACY_THRESHOLD - accuracy) / 4) + Math.max(0, difficulty - 1));
  const ratingAfter = Math.max(0, ratingBefore + ratingDelta);

  const wins = Math.max(0, Math.round(numberOr(current.wins, 0))) + (won ? 1 : 0);
  const losses = Math.max(0, Math.round(numberOr(current.losses, 0))) + (won ? 0 : 1);
  const streak = won ? Math.max(0, Math.round(numberOr(current.streak, 0))) + 1 : 0;
  const bestStreak = Math.max(Math.max(0, Math.round(numberOr(current.bestStreak, 0))), streak);
  const winRate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;

  const xpGained = Math.max(20, Math.round(score * 0.25 + accuracy * 2 + difficulty * 15 + (won ? 50 : 10)));
  let level = Math.max(1, Math.round(numberOr(current.level, STARTING_LEVEL)));
  let xp = Math.max(0, Math.round(numberOr(current.xp, STARTING_XP))) + xpGained;
  let xpMax = Math.max(1, Math.round(numberOr(current.xpMax, xpMaxForLevel(level))));
  while (xp >= xpMax) {
    xp -= xpMax;
    level += 1;
    xpMax = xpMaxForLevel(level);
  }

  return {
    session: {
      result: won ? 'W' : 'L',
      accuracy,
      ratingBefore,
      ratingAfter,
      ratingDelta,
      xpGained,
    },
    profile: {
      level,
      xp,
      xpMax,
      rank: rankForRating(ratingAfter),
      rating: ratingAfter,
      peakRating: Math.max(Math.round(numberOr(current.peakRating, STARTING_RATING)), ratingAfter),
      wins,
      losses,
      winRate,
      streak,
      bestStreak,
      trainedSeconds: Math.max(0, Math.round(numberOr(current.trainedSeconds, 0))) + durationSeconds,
    },
  };
}
