import assert from 'node:assert/strict';
import test from 'node:test';

import { ExerciseTimer } from '../src/js/timer.js';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

test('ExerciseTimer honors fractional second overrides', async () => {
  let expired = false;
  const timer = new ExerciseTimer('D8', () => {}, () => { expired = true; });

  const total = timer.start('shot', 0.18);

  assert.equal(total, 0.18);
  assert.equal(timer.isRunning, true);

  await delay(260);

  assert.equal(expired, true);
  assert.equal(timer.isRunning, false);
});

test('ExerciseTimer pause and resume preserve remaining time', async () => {
  let expired = false;
  const timer = new ExerciseTimer('D8', () => {}, () => { expired = true; });

  timer.start('shot', 0.28);
  await delay(90);
  timer.pause();
  const remainingAtPause = timer.remaining;

  await delay(240);

  assert.equal(expired, false);
  assert.equal(timer.isRunning, false);
  assert.ok(Math.abs(timer.remaining - remainingAtPause) < 0.03);

  timer.resume();
  assert.equal(timer.isRunning, true);
  await delay(260);

  assert.equal(expired, true);
});
