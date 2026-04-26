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

test('screens expose polished profile controls and remove Strategy drills', async () => {
  const source = await readFile(path.join(process.cwd(), 'src/js/screens.js'), 'utf8');

  assert.match(source, /COUNTRY_OPTIONS/);
  assert.match(source, /<select class="settings-input country-select" name="country"/);
  assert.match(source, /data-player-pill/);
  assert.match(source, /--avatar-color/);
  assert.match(source, /data-daily-bonus-status/);
  assert.match(source, /Daily Bonus/);
  assert.match(source, /const categories = \['All', 'Attack', 'Defense'\]/);
  assert.doesNotMatch(source, /category: 'Strategy'/);
  assert.doesNotMatch(source, /data-drill-filter="\$\{category\}">Strategy/);
});
