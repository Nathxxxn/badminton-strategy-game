import assert from 'node:assert/strict';
import test from 'node:test';

test('fetchBackendState returns backend state when API responds', async () => {
  globalThis.fetch = async url => {
    assert.equal(url, '/api/player/state');
    return new Response(JSON.stringify({ profile: { name: 'Nadia Park' } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  const { fetchBackendState } = await import('../src/js/api-client.js');

  const state = await fetchBackendState();

  assert.equal(state.profile.name, 'Nadia Park');
});

test('saveBackendPreferences returns null on HTTP validation errors', async () => {
  const originalWarn = console.warn;
  console.warn = () => {};
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'Invalid preferences' }), {
    status: 400,
    headers: { 'content-type': 'application/json' },
  });
  const { saveBackendPreferences } = await import('../src/js/api-client.js');

  try {
    const state = await saveBackendPreferences({ leaderboardPeriod: 'monthly' });

    assert.equal(state, null);
  } finally {
    console.warn = originalWarn;
  }
});

test('recordBackendDrillStart posts the drill route', async () => {
  let received = null;
  globalThis.fetch = async (url, options) => {
    received = { url, options };
    return new Response(JSON.stringify({ progression: { startedDrills: ['d1'] } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  const { recordBackendDrillStart } = await import('../src/js/api-client.js');

  const state = await recordBackendDrillStart('d1');

  assert.equal(received.url, '/api/player/drills/d1/start');
  assert.equal(received.options.method, 'POST');
  assert.deepEqual(state.progression.startedDrills, ['d1']);
});
