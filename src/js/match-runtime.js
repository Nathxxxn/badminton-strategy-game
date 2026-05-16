import { BASE_REACTION_TIMES, calculateAdjustedTime } from './logic/KinematicEngine.js';
import { RATING_THRESHOLDS } from './logic/RatingEngine.js';

export const MATCH_TARGET_POINTS = 5;
export const MATCH_POINT_CAP = 11;
export const MATCH_SETS_TO_WIN = 2;
export const DEFAULT_OPPONENT_RANK = 'D8';
export const DEFAULT_PREVIOUS_SCORE = 80;
export const MATCH_TIMER_FALLBACK_MULTIPLIER = 3;
export const MATCH_TIMER_MIN_SECONDS = 8;

const PARTICIPANTS = ['player', 'partner', 'opponent1', 'opponent2'];

// ─── Opponent style generation ────────────────────────────────────────────────

const RANK_ORDER = Object.keys(RATING_THRESHOLDS);

const STYLE_POOL = [
  'Aggressive', 'Defensive', 'Backhand', 'Net', 'Smash', 'Deceptive', 'AllRound', 'Baseline',
];

// Name pools by rank tier (8 names each so pool[idx % 8] and pool[(idx+4) % 8] are always different)
const NAME_POOLS = {
  // P12, P10 — club beginners
  beginner:     ['Thomas', 'Lucas', 'Emma', 'Mathieu', 'Julie', 'Antoine', 'Romain', 'Sophie'],
  // D9, D8, D7 — departmental
  departmental: ['Karim', 'Yannick', 'Mehdi', 'Chloé', 'Damien', 'Nadia', 'Julien', 'Léa'],
  // R6, R5, R4 — regional / advanced
  regional:     ['Chen', 'Yuki', 'Amir', 'Ryo', 'Jana', 'Mia', 'Jun', 'Nina'],
  // N3, N2, N1 — elite: real world champions
  elite:        ['Viktor', 'Kento', 'Carolina', 'Anders', 'Tai', 'Nozomi', 'Ratchanok', 'Zheng'],
};

/** Default opponent names used in exercise mode (no rank context). */
export const DEFAULT_OPPONENT_NAMES = ['Léa', 'Hugo'];

function namePool(idx) {
  if (idx >= 8) return NAME_POOLS.elite;
  if (idx >= 5) return NAME_POOLS.regional;
  if (idx >= 2) return NAME_POOLS.departmental;
  return NAME_POOLS.beginner;
}

/**
 * Generate deterministic opponent style profiles from their rank.
 * Higher ranks produce more varied / unpredictable style combinations
 * and draw from progressively elite name pools (real champions at N3+).
 *
 * @param {string} opponentRank  e.g. 'D8', 'R5'
 * @returns {{ opp1: { style: string, hand: string, name: string }, opp2: { style: string, hand: string, name: string } }}
 */
export function generateOpponentStyles(opponentRank) {
  const rankIndex = RANK_ORDER.indexOf(opponentRank);
  const idx = rankIndex < 0 ? 3 : rankIndex;

  const style1 = STYLE_POOL[idx % STYLE_POOL.length];
  const style2 = STYLE_POOL[(idx + 3) % STYLE_POOL.length];

  // Higher rank = more likely left-handed opp2 (adds challenge)
  const hand2 = idx >= 6 ? 'left' : 'right';

  const pool  = namePool(idx);
  const name1 = pool[idx % pool.length];
  const name2 = pool[(idx + 4) % pool.length]; // offset by half pool → always different

  return {
    opp1: { style: style1, hand: 'right', name: name1 },
    opp2: { style: style2, hand: hand2,   name: name2 },
  };
}

// ─── ELO-style rating delta ───────────────────────────────────────────────────

const ELO_K = 32;

function rankToRating(rank) {
  return RATING_THRESHOLDS[rank] ?? RATING_THRESHOLDS[DEFAULT_OPPONENT_RANK];
}

/**
 * Compute the FFBAD rating delta after a match using an ELO-style formula.
 *
 * @param {'player'|'opponent'} winner
 * @param {number} playerRating   Numerical FFBAD rating of the player
 * @param {string} opponentRank   Rank string of the opponent e.g. 'R5'
 * @returns {number}              Signed integer delta (e.g. +18 or -14)
 */
export function computeRatingDelta(winner, playerRating, opponentRank) {
  const opponentRating = rankToRating(opponentRank);
  const expected = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
  const actual = winner === 'player' ? 1 : 0;
  return Math.round(ELO_K * (actual - expected));
}

// ─── Match state ──────────────────────────────────────────────────────────────

function clampFatigue(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getPoints(stateOrSet) {
  return stateOrSet?.points ?? stateOrSet ?? { player: 0, opponent: 0 };
}

export function createMatchState({ opponentRank = DEFAULT_OPPONENT_RANK, playerRating = 600 } = {}) {
  return {
    points: { player: 0, opponent: 0 },
    sets: { player: 0, opponent: 0 },
    setHistory: [],
    winner: null,
    opponentRank,
    playerRating,
    // Generated at init from opponentRank; Logic can override these if it sends richer profiles.
    opponentStyles: generateOpponentStyles(opponentRank),
    previousTurnScore: DEFAULT_PREVIOUS_SCORE,
    fatigue: {
      player: 100,
      partner: 100,
      opponent1: 100,
      opponent2: 100,
    },
    // Filled by finaliseMatchState() once the match ends.
    ratingDelta: null,
  };
}

/**
 * Seal the match state after the final point: compute and store the rating delta.
 * Call this once isMatchComplete(state) is true.
 *
 * @param {object} state  Live match state (mutated in place)
 * @returns {object}      The same state with ratingDelta filled
 */
export function finaliseMatchState(state) {
  if (!state || state.ratingDelta !== null) return state;
  if (!isMatchComplete(state)) return state;

  state.ratingDelta = computeRatingDelta(
    state.winner,
    state.playerRating,
    state.opponentRank,
  );

  return state;
}

export function isSetComplete(stateOrSet) {
  const points = getPoints(stateOrSet);
  const player = points.player ?? 0;
  const opponent = points.opponent ?? 0;
  const leader = Math.max(player, opponent);
  const gap = Math.abs(player - opponent);

  return leader >= MATCH_POINT_CAP || (leader >= MATCH_TARGET_POINTS && gap >= 2);
}

export function isMatchComplete(state) {
  return Boolean(state?.winner) ||
    (state?.sets?.player ?? 0) >= MATCH_SETS_TO_WIN ||
    (state?.sets?.opponent ?? 0) >= MATCH_SETS_TO_WIN;
}

function setWinner(points) {
  return points.player > points.opponent ? 'player' : 'opponent';
}

function applyFatigue(fatigue, pointWinner, turnScore) {
  const next = { ...fatigue };
  const playerFailed = pointWinner === 'opponent';
  const lowScore = Number.isFinite(turnScore) && turnScore < 50;

  PARTICIPANTS.forEach(id => {
    next[id] = clampFatigue((next[id] ?? 100) - 1);
  });

  if (playerFailed) {
    next.player = clampFatigue(next.player - 4);
    next.partner = clampFatigue(next.partner - 2);
  } else {
    next.opponent1 = clampFatigue(next.opponent1 - 2);
    next.opponent2 = clampFatigue(next.opponent2 - 2);
  }

  if (lowScore) {
    next.player = clampFatigue(next.player - 2);
  }

  return next;
}

export function applyMatchPoint(state, winner, turnScore = DEFAULT_PREVIOUS_SCORE) {
  if (!state || isMatchComplete(state)) return state;
  if (winner !== 'player' && winner !== 'opponent') return state;

  state.points[winner] += 1;
  state.previousTurnScore = Number.isFinite(turnScore) ? turnScore : DEFAULT_PREVIOUS_SCORE;
  state.fatigue = applyFatigue(state.fatigue, winner, state.previousTurnScore);

  if (isSetComplete(state)) {
    const winnerId = setWinner(state.points);
    state.setHistory.push({ ...state.points, winner: winnerId });
    state.sets[winnerId] += 1;
    state.points = { player: 0, opponent: 0 };

    if (isMatchComplete(state)) {
      state.winner = state.sets.player > state.sets.opponent ? 'player' : 'opponent';
      finaliseMatchState(state);
    }
  }

  return state;
}

function positiveNumber(value) {
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function resolveTurnTimeLimitSeconds(
  turn,
  previousTurnScore = DEFAULT_PREVIOUS_SCORE,
  opponentRank = DEFAULT_OPPONENT_RANK,
) {
  const timeLimitMs = positiveNumber(turn?.timeLimitMs);
  if (timeLimitMs !== null) return timeLimitMs / 1000;

  const timeLimitSeconds = positiveNumber(turn?.timeLimitSeconds);
  if (timeLimitSeconds !== null) return timeLimitSeconds;

  const pressureSeconds = positiveNumber(turn?.timePressure?.secondsPerTurn);
  if (pressureSeconds !== null) return pressureSeconds;

  const rankTimes = BASE_REACTION_TIMES[opponentRank] ?? BASE_REACTION_TIMES[DEFAULT_OPPONENT_RANK];
  const incomingType = turn?.incomingShuttle?.type ?? turn?.shuttlecock?.type ?? 'DRIVE';
  const baseTime = rankTimes[incomingType] ?? rankTimes.DRIVE;

  const adjustedSeconds = calculateAdjustedTime(baseTime, previousTurnScore) / 1000;
  return Math.max(MATCH_TIMER_MIN_SECONDS, adjustedSeconds * MATCH_TIMER_FALLBACK_MULTIPLIER);
}
