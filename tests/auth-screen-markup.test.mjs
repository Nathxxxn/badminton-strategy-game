import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('auth screen exposes distinct sign in and create tabs with expected fields', async () => {
  const source = await readFile(new URL('../src/js/screens.js', import.meta.url), 'utf8');

  assert.match(source, /data-auth-tab="login">Sign in<\/button>/);
  assert.match(source, /data-auth-tab="signup">Create<\/button>/);
  assert.match(source, /data-auth-form="login"[\s\S]*name="email"[\s\S]*name="password"/);
  assert.match(source, /data-auth-form="signup"[\s\S]*name="name"[\s\S]*name="email"[\s\S]*name="password"[\s\S]*name="confirmPassword"[\s\S]*name="country"/);
});
