import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { AISpawnEngine } from '../src/js/logic/AISpawnEngine.js';
import { PlacementEngine } from '../src/js/logic/PlacementEngine.js';
import { buildTacticalPayload } from '../src/js/payload-builder.js';

function createAiSpawn() {
  return new AISpawnEngine(null, new PlacementEngine(), null);
}

test('AISpawnEngine returns deterministic valid impact points for a shot window', () => {
  const aiSpawn = createAiSpawn();
  const points = aiSpawn.getValidImpactPoints(
    { x: 0.5, y: 0.0 },
    { x: 0.5, y: 1.0 },
    { x: 0.5, y: 0.9 },
    1.0,
    'KILL',
  );

  assert.ok(points.length > 1);
  assert.deepEqual(points, [...points].sort((a, b) => a.t - b.t));
  assert.ok(points.every(point => point.t >= 0.8 && point.t <= 1.0));
  assert.deepEqual(points[0], { x: 0.5, y: 0.8, t: 0.8 });
});

test('AISpawnEngine returns an empty impact list when the shuttle is unreachable', () => {
  const aiSpawn = createAiSpawn();
  const points = aiSpawn.getValidImpactPoints(
    { x: 0.0, y: 0.0 },
    { x: 0.0, y: 0.1 },
    { x: 1.0, y: 1.0 },
    0.1,
    'SMASH',
  );

  assert.deepEqual(points, []);
});

test('getValidImpactPoint remains compatible and returns a member of the valid impact list', () => {
  const aiSpawn = createAiSpawn();
  const args = [
    { x: 0.5, y: 0.0 },
    { x: 0.5, y: 1.0 },
    { x: 0.5, y: 0.9 },
    1.0,
    'KILL',
  ];
  const points = aiSpawn.getValidImpactPoints(...args);
  const selected = aiSpawn.getValidImpactPoint(...args);

  assert.ok(points.some(point => (
    point.x === selected.x &&
    point.y === selected.y &&
    point.t === selected.t
  )));
});

test('buildTacticalPayload prefers the shot impact point over the legacy turn shuttle position', () => {
  const payload = buildTacticalPayload(
    {
      aimPoint: { x: 0.4, y: 0.2 },
      power: 0.8,
      impactPoint: { x: 0.55, y: 0.72 },
    },
    {
      shuttlecock: { position: { x: 0.2, y: 0.8 }, type: 'CLEAR' },
      players: {
        opponent1: { x: 0.2, y: 0.2 },
        opponent2: { x: 0.8, y: 0.2 },
      },
    },
    { forcedType: 'SMASH' },
  );

  assert.deepEqual(payload.impactPoint, { x: 0.55, y: 0.72 });
});

test('DragShooter emits the closest valid impact point selected at pointerdown', async () => {
  globalThis.window = {
    addEventListener() {},
    removeEventListener() {},
  };

  const { DragShooter } = await import('../src/js/drag.js');
  let emitted = null;
  const canvas = {
    style: {},
    addEventListener() {},
    removeEventListener() {},
    setPointerCapture() {},
    getContext() {
      return {};
    },
    getBoundingClientRect() {
      return { left: 0, top: 0 };
    },
  };
  const court = {
    toCanvas(x, y) {
      return { x: x * 1000, y: y * 1000 };
    },
    toNormalized(x, y) {
      return { x: x / 1000, y: y / 1000 };
    },
  };
  const drag = new DragShooter(canvas, court, shot => { emitted = shot; });

  drag.activate(
    { x: 0.5, y: 0.5 },
    [
      { x: 0.45, y: 0.5, t: 0.45 },
      { x: 0.55, y: 0.5, t: 0.55 },
    ],
  );
  drag._handlePointerDown({
    clientX: 552,
    clientY: 502,
    pointerId: 1,
    preventDefault() {},
  });
  drag._handlePointerUp({
    clientX: 552,
    clientY: 650,
    preventDefault() {},
  });

  assert.deepEqual(emitted.impactPoint, { x: 0.55, y: 0.5, t: 0.55 });
});

test('main wires valid impact points into shot filtering and drag activation', async () => {
  const mainJs = await readFile(path.join(process.cwd(), 'src/js/main.js'), 'utf8');

  assert.match(mainJs, /getValidImpactPoints/);
  assert.match(mainJs, /setAllowedTypes\(.*valid/i);
  assert.match(mainJs, /drag\.activate\(.*impact/i);
});
