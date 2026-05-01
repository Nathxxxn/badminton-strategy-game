import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import {
  applyMatchPoint,
  createMatchState,
  isMatchComplete,
  isSetComplete,
  resolveTurnTimeLimitSeconds,
} from '../src/js/match-runtime.js';
import { BASE_REACTION_TIMES, calculateAdjustedTime } from '../src/js/logic/MatchEngine.js';

test('match set is won at 5 points with a 2 point margin', () => {
  const state = createMatchState();

  for (let i = 0; i < 4; i += 1) applyMatchPoint(state, 'player', 80);
  for (let i = 0; i < 3; i += 1) applyMatchPoint(state, 'opponent', 30);
  applyMatchPoint(state, 'player', 80);

  assert.equal(state.sets.player, 1);
  assert.equal(state.sets.opponent, 0);
  assert.deepEqual(state.points, { player: 0, opponent: 0 });
  assert.equal(isSetComplete({ points: { player: 5, opponent: 3 } }), true);
});

test('match set continues at 5-4 and finishes at the 11 point cap', () => {
  assert.equal(isSetComplete({ points: { player: 5, opponent: 4 } }), false);
  assert.equal(isSetComplete({ points: { player: 11, opponent: 10 } }), true);
});

test('match completes after one side wins 2 sets', () => {
  const state = createMatchState();

  for (let set = 0; set < 2; set += 1) {
    for (let i = 0; i < 5; i += 1) applyMatchPoint(state, 'opponent', 20);
  }

  assert.equal(state.sets.opponent, 2);
  assert.equal(isMatchComplete(state), true);
  assert.equal(state.winner, 'opponent');
});

test('timer uses scenario limit before calculated match fallback', () => {
  assert.equal(resolveTurnTimeLimitSeconds({ timeLimitMs: 3450 }, 70, 'D8'), 3.45);
  assert.equal(resolveTurnTimeLimitSeconds({ timeLimitSeconds: 4.2 }, 70, 'D8'), 4.2);
  assert.equal(
    resolveTurnTimeLimitSeconds({ timePressure: { secondsPerTurn: 6 } }, 70, 'D8'),
    6,
  );
});

test('timer fallback uses opponent rank, incoming shot type and previous score', () => {
  const turn = { incomingShuttle: { type: 'KILL' } };
  const previousScore = 40;
  const expected = Math.max(
    8,
    calculateAdjustedTime(BASE_REACTION_TIMES.D8.KILL, previousScore) / 1000 * 3,
  );

  assert.equal(resolveTurnTimeLimitSeconds(turn, previousScore, 'D8'), expected);
  assert.notEqual(
    resolveTurnTimeLimitSeconds({ incomingShuttle: { type: 'CLEAR' } }, 20, 'D8'),
    resolveTurnTimeLimitSeconds({ incomingShuttle: { type: 'CLEAR' } }, 90, 'D8'),
  );
});

test('timer fallback keeps match turns playable even for fast opponent shots', () => {
  assert.equal(resolveTurnTimeLimitSeconds({ incomingShuttle: { type: 'KILL' } }, 80, 'N1'), 8);
  assert.ok(resolveTurnTimeLimitSeconds({ incomingShuttle: { type: 'CLEAR' } }, 80, 'D8') > 8);
});

test('match UI markers and routing are present', async () => {
  const root = process.cwd();
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  const main = await readFile(path.join(root, 'src/js/main.js'), 'utf8');
  const screens = await readFile(path.join(root, 'src/js/screens.js'), 'utf8');

  assert.match(html, /id="match-scoreboard"/);
  assert.match(html, /id="match-fatigue"/);
  assert.match(html, /id="match-ready-overlay"/);
  assert.match(html, />I'm ready<\/button>/);
  assert.match(html, /id="hud-timer-bar"/);
  assert.match(screens, /id: 'match'[\s\S]*available: true/);
  assert.match(main, /currentWorkshop === 'match'/);
  assert.match(main, /showMatchReadyPrompt/);
  assert.match(main, /applyMatchPoint/);
});
