import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { KinematicEngine } from '../src/js/logic/KinematicEngine.js';
import { TacticalEngine } from '../src/js/logic/TacticalEngine.js';
import { PlacementEngine } from '../src/js/logic/PlacementEngine.js';
import { FeedbackEngine } from '../src/js/logic/FeedbackEngine.js';
import { BASE_REACTION_TIMES, RATING_THRESHOLDS } from '../src/js/logic/MatchEngine.js';
import { rankForRating } from '../server/progression.js';

test('tactical and kinematic engines share the same shot parameter contract', () => {
  const kinematic = new KinematicEngine();
  const tactical = new TacticalEngine();

  assert.deepEqual(tactical.SHOT_PARAMS, kinematic.SHOT_PARAMS);
});

test('match engine rank and reaction-time tables cover the app ranks and shot types', () => {
  const shotTypes = Object.keys(new KinematicEngine().SHOT_PARAMS).sort();

  Object.entries(RATING_THRESHOLDS).forEach(([rank, minRating]) => {
    assert.equal(rankForRating(minRating), rank);
    assert.deepEqual(Object.keys(BASE_REACTION_TIMES[rank]).sort(), shotTypes);
  });
});

test('kinematic engine supports every declared shot type with default runtime arguments', () => {
  const kinematic = new KinematicEngine();

  Object.keys(kinematic.SHOT_PARAMS).forEach(shotType => {
    const shotCaps = kinematic.shotPossibility(shotType);
    const moveCaps = kinematic.movementPossibility(shotType);

    assert.equal(typeof shotCaps.allowedReach, 'number');
    assert.ok(Array.isArray(shotCaps.allowedShots));
    assert.equal(typeof moveCaps.allowedRadius, 'number');
  });
});

test('scenario catalog validator knows every logic shot type', async () => {
  const exercisesJs = await readFile(path.join(process.cwd(), 'src/js/exercises.js'), 'utf8');

  Object.keys(new KinematicEngine().SHOT_PARAMS).forEach(shotType => {
    assert.match(exercisesJs, new RegExp(`['"]${shotType}['"]`));
  });
});

test('tactical feedback remains numeric for early tactical faults', () => {
  const tactical = new TacticalEngine();
  const feedback = new FeedbackEngine();
  const analysis = tactical.getCompleteAnalysis(
    { type: 'NET_DROP', endPos: { x: 0.5, y: 0.2 } },
    { type: 'SMASH', endPos: { x: 0.5, y: 0.4 } },
    [
      { x: 0.4, y: 0.5, hand: 'right' },
      { x: 0.6, y: 0.5, hand: 'left' },
    ],
    { x: 0.5, y: 0.1 },
  );
  const tacticalFeedback = feedback.getTacticalFeedback(analysis);

  assert.equal(typeof tacticalFeedback.totalScore, 'number');
  assert.ok(Number.isFinite(tacticalFeedback.totalScore));
  assert.ok(Array.isArray(tacticalFeedback.messages));
  assert.ok(tacticalFeedback.details.breakdown);
});

test('placement engine feedback exposes a flat renderable ideal position', () => {
  const placement = new PlacementEngine();
  const feedback = new FeedbackEngine();
  const result = placement.evaluateGlobalPlacement(
    { x: 0.35, y: 0.45 },
    { x: 0.65, y: 0.45 },
    { type: 'SMASH', endPos: { x: 0.7, y: 0.2 } },
    false,
  );
  const placementFeedback = feedback.getPlacementFeedback(result);

  assert.equal(typeof result.ideal.x, 'number');
  assert.equal(typeof result.ideal.y, 'number');
  assert.equal(typeof placementFeedback.idealPosition.x, 'number');
  assert.equal(typeof placementFeedback.idealPosition.y, 'number');
  assert.equal(typeof placementFeedback.details.realDistance, 'string');
});
