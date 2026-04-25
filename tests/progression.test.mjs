import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateProgression,
  rankForRating,
  STARTING_RATING,
} from '../server/progression.js';

test('rankForRating maps local competitive rating to French badminton ranks', () => {
  assert.equal(rankForRating(STARTING_RATING), 'P12');
  assert.equal(rankForRating(720), 'P10');
  assert.equal(rankForRating(900), 'D9');
  assert.equal(rankForRating(1260), 'R6');
  assert.equal(rankForRating(1620), 'N3');
  assert.equal(rankForRating(1900), 'N1');
});

test('calculateProgression rewards a successful session with win, rating, XP and streak', () => {
  const result = calculateProgression({
    current: {
      level: 1,
      xp: 0,
      xpMax: 500,
      rating: 600,
      peakRating: 600,
      wins: 0,
      losses: 0,
      streak: 0,
      bestStreak: 0,
      trainedSeconds: 0,
    },
    session: {
      score: 320,
      correct: 3,
      totalTurns: 4,
      durationSeconds: 180,
      difficulty: 2,
    },
  });

  assert.equal(result.session.result, 'W');
  assert.equal(result.session.accuracy, 75);
  assert.equal(result.profile.wins, 1);
  assert.equal(result.profile.losses, 0);
  assert.equal(result.profile.streak, 1);
  assert.equal(result.profile.bestStreak, 1);
  assert.ok(result.profile.rating > 600);
  assert.equal(result.profile.peakRating, result.profile.rating);
  assert.ok(result.profile.xp > 0);
});

test('calculateProgression records a failed session as a limited loss and resets streak', () => {
  const result = calculateProgression({
    current: {
      level: 1,
      xp: 120,
      xpMax: 500,
      rating: 640,
      peakRating: 660,
      wins: 2,
      losses: 0,
      streak: 2,
      bestStreak: 2,
      trainedSeconds: 300,
    },
    session: {
      score: 80,
      correct: 1,
      totalTurns: 4,
      durationSeconds: 90,
      difficulty: 2,
    },
  });

  assert.equal(result.session.result, 'L');
  assert.equal(result.profile.wins, 2);
  assert.equal(result.profile.losses, 1);
  assert.equal(result.profile.streak, 0);
  assert.equal(result.profile.bestStreak, 2);
  assert.ok(result.session.ratingDelta < 0);
  assert.ok(result.session.ratingDelta >= -18);
  assert.equal(result.profile.peakRating, 660);
});
