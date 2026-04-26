import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('database migrations directory uses fileURLToPath for file URL portability', async () => {
  const source = await readFile(path.join(process.cwd(), 'server/db.js'), 'utf8');

  assert.match(source, /import \{ fileURLToPath \} from 'node:url';/);
  assert.match(
    source,
    /const MIGRATIONS_DIR = path\.join\(path\.dirname\(fileURLToPath\(import\.meta\.url\)\), 'migrations'\);/,
  );
  assert.doesNotMatch(source, /new URL\(import\.meta\.url\)\.pathname/);
});
