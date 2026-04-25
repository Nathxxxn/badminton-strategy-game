import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('screens render competitive rating fields instead of mocked rank hints', async () => {
  const source = await readFile(path.join(process.cwd(), 'src/js/screens.js'), 'utf8');

  assert.match(source, /RATING/);
  assert.match(source, /PEAK/);
  assert.match(source, /ratingDelta/);
  assert.match(source, /losses/);
  assert.doesNotMatch(source, /\+42 pts this week/);
  assert.doesNotMatch(source, /Diamond I/);
});
