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

function createDragRig({ onShot = () => {}, options } = {}) {
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

  return { canvas, court, onShot, options };
}

async function loadDragShooter() {
  globalThis.window = {
    addEventListener() {},
    removeEventListener() {},
  };

  const { DragShooter } = await import('../src/js/drag.js');
  return DragShooter;
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

test('DragShooter emits the projected preview landing point for short backward drags', async () => {
  const DragShooter = await loadDragShooter();
  let emitted = null;
  const { canvas, court } = createDragRig();
  const drag = new DragShooter(canvas, court, shot => { emitted = shot; });

  drag.activate({ x: 0.5, y: 0.72 }, [{ x: 0.5, y: 0.72, t: 0.5 }]);
  drag._handlePointerDown({
    clientX: 500,
    clientY: 720,
    pointerId: 1,
    preventDefault() {},
  });
  drag._handlePointerUp({
    clientX: 500,
    clientY: 790,
    preventDefault() {},
  });

  assert.ok(emitted.aimPoint.y < 0.5);
});

test('DragShooter exposes the selected shot type for type-specific preview rendering', async () => {
  const DragShooter = await loadDragShooter();
  const { canvas, court } = createDragRig();
  const drag = new DragShooter(canvas, court, () => {});

  drag.setShotType('CLEAR');
  assert.equal(drag._shotType, 'CLEAR');

  drag.setShotType('UNKNOWN');
  assert.equal(drag._shotType, 'CLEAR');
});

test('DragShooter keeps the legacy drag profile when no lab profiles are provided', async () => {
  const DragShooter = await loadDragShooter();
  const { canvas, court } = createDragRig();
  const drag = new DragShooter(canvas, court, () => {});

  drag.activate({ x: 0.5, y: 0.72 }, [{ x: 0.5, y: 0.72, t: 0.5 }]);
  drag._handlePointerDown({
    clientX: 500,
    clientY: 720,
    pointerId: 1,
    preventDefault() {},
  });
  drag._handlePointerMove({
    clientX: 500,
    clientY: 790,
    movementX: 0,
    movementY: 70,
    preventDefault() {},
  });

  const smash = drag._computeShot();
  drag.setShotType('DROP');
  const drop = drag._computeShot();

  assert.equal(smash.power, drop.power);
  assert.equal(Number(smash.power.toFixed(3)), 0.321);
  assert.equal(Number(smash.aimPoint.y.toFixed(2)), 0.3);
  assert.equal(Number(drop.aimPoint.y.toFixed(2)), 0.3);
});

test('DragShooter applies lab profiles to make equal drags feel different by shot type', async () => {
  const DragShooter = await loadDragShooter();
  const { canvas, court } = createDragRig();
  const drag = new DragShooter(canvas, court, () => {}, {
    profiles: {
      SMASH: { maxDragPx: 210, deadzonePx: 18, tensionExponent: 1.35, targetYMin: 0.07, targetYMax: 0.24 },
      DROP: { maxDragPx: 120, deadzonePx: 10, tensionExponent: 0.82, targetYMin: 0.36, targetYMax: 0.48 },
      DRIVE: { maxDragPx: 145, deadzonePx: 12, tensionExponent: 0.95, targetYMin: 0.18, targetYMax: 0.34 },
    },
  });

  drag.activate({ x: 0.5, y: 0.72 }, [{ x: 0.5, y: 0.72, t: 0.5 }]);
  drag._handlePointerDown({
    clientX: 500,
    clientY: 720,
    pointerId: 1,
    preventDefault() {},
  });
  drag._handlePointerMove({
    clientX: 500,
    clientY: 800,
    movementX: 0,
    movementY: 80,
    preventDefault() {},
  });

  drag.setShotType('SMASH');
  const smash = drag._computeShot();
  drag.setShotType('DROP');
  const drop = drag._computeShot();
  drag.setShotType('DRIVE');
  const drive = drag._computeShot();

  assert.ok(smash.power < drive.power);
  assert.ok(drive.power < drop.power);
  assert.ok(smash.aimPoint.y < drive.aimPoint.y);
  assert.ok(drive.aimPoint.y < drop.aimPoint.y);
});

test('DragShooter constrains direct lab-profile aims to each shot target band', async () => {
  const DragShooter = await loadDragShooter();
  const { canvas, court } = createDragRig();
  const drag = new DragShooter(canvas, court, () => {}, {
    profiles: {
      CLEAR: { maxDragPx: 230, deadzonePx: 20, tensionExponent: 1.45, targetYMin: 0.03, targetYMax: 0.12 },
      DROP: { maxDragPx: 120, deadzonePx: 10, tensionExponent: 0.82, targetYMin: 0.36, targetYMax: 0.49 },
      SMASH: { maxDragPx: 205, deadzonePx: 18, tensionExponent: 1.25, targetYMin: 0.06, targetYMax: 0.42 },
    },
  });

  drag.activate({ x: 0.5, y: 0.72 }, [{ x: 0.5, y: 0.72, t: 0.5 }]);
  drag._handlePointerDown({
    clientX: 500,
    clientY: 720,
    pointerId: 1,
    preventDefault() {},
  });
  drag._handlePointerMove({
    clientX: 500,
    clientY: 980,
    movementX: 0,
    movementY: 260,
    preventDefault() {},
  });

  drag.setShotType('CLEAR');
  const clear = drag._computeShot();
  drag.setShotType('DROP');
  const drop = drag._computeShot();
  drag.setShotType('SMASH');
  const smash = drag._computeShot();

  assert.ok(clear.aimPoint.y >= 0.03 && clear.aimPoint.y <= 0.12);
  assert.ok(drop.aimPoint.y >= 0.36 && drop.aimPoint.y <= 0.49);
  assert.ok(smash.aimPoint.y >= 0.06 && smash.aimPoint.y <= 0.42);
});

test('DragShooter can fire a backward drag that continues below the canvas', async () => {
  const DragShooter = await loadDragShooter();
  let emitted = null;
  const { canvas, court } = createDragRig();
  const drag = new DragShooter(canvas, court, shot => { emitted = shot; });

  drag.activate({ x: 0.5, y: 0.92 }, [{ x: 0.5, y: 0.92, t: 0.5 }]);
  drag._handlePointerDown({
    clientX: 500,
    clientY: 920,
    pointerId: 1,
    preventDefault() {},
  });
  drag._handlePointerMove({
    clientX: 500,
    clientY: 1120,
    movementX: 0,
    movementY: 200,
    preventDefault() {},
  });
  drag._handlePointerUp({
    clientX: 500,
    clientY: 1120,
    preventDefault() {},
  });

  assert.ok(emitted);
  assert.ok(emitted.power > 0);
  assert.ok(emitted.aimPoint.y < 0.5);
});

test('DragShooter keeps a captured drag active when the pointer leaves the canvas', async () => {
  const DragShooter = await loadDragShooter();
  let emitted = null;
  const { canvas, court } = createDragRig();
  const drag = new DragShooter(canvas, court, shot => { emitted = shot; });

  drag.activate({ x: 0.5, y: 0.92 }, [{ x: 0.5, y: 0.92, t: 0.5 }]);
  drag._handlePointerDown({
    clientX: 500,
    clientY: 920,
    pointerId: 1,
    preventDefault() {},
  });
  drag._handlePointerLeave();
  drag._handlePointerUp({
    clientX: 500,
    clientY: 1120,
    preventDefault() {},
  });

  assert.ok(emitted);
  assert.ok(emitted.power > 0);
});

test('DragShooter cancels an active drag on pointercancel without firing', async () => {
  const DragShooter = await loadDragShooter();
  let emitted = null;
  const { canvas, court } = createDragRig();
  const drag = new DragShooter(canvas, court, shot => { emitted = shot; });

  drag.activate({ x: 0.5, y: 0.92 }, [{ x: 0.5, y: 0.92, t: 0.5 }]);
  drag._handlePointerDown({
    clientX: 500,
    clientY: 920,
    pointerId: 1,
    preventDefault() {},
  });
  drag._handlePointerCancel();
  drag._handlePointerUp({
    clientX: 500,
    clientY: 1120,
    preventDefault() {},
  });

  assert.equal(emitted, null);
});

test('DragShooter cancels an active drag on Escape without firing', async () => {
  const DragShooter = await loadDragShooter();
  let emitted = null;
  const { canvas, court } = createDragRig();
  const drag = new DragShooter(canvas, court, shot => { emitted = shot; });

  drag.activate({ x: 0.5, y: 0.92 }, [{ x: 0.5, y: 0.92, t: 0.5 }]);
  drag._handlePointerDown({
    clientX: 500,
    clientY: 920,
    pointerId: 1,
    preventDefault() {},
  });
  drag._handleKeyDown({ key: 'Escape' });
  drag._handlePointerUp({
    clientX: 500,
    clientY: 1120,
    preventDefault() {},
  });

  assert.equal(emitted, null);
});

test('main wires valid impact points into shot filtering and drag activation', async () => {
  const mainJs = await readFile(path.join(process.cwd(), 'src/js/main.js'), 'utf8');

  assert.match(mainJs, /getValidImpactPoints/);
  assert.match(mainJs, /setAllowedTypes\(.*valid/i);
  assert.match(mainJs, /drag\.activate\(.*impact/i);
});
