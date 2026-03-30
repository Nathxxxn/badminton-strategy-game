/**
 * main.js — Application entry point and game orchestrator
 * Developer A · Rendering & UI  (shared file — coordinate with Developer B)
 *
 * Responsibilities:
 *  - Initialize all rendering modules
 *  - Manage game state (current rally, turn index, score, combo)
 *  - Orchestrate positioning and shot turns
 *  - Wire screen navigation via ScreenManager
 *
 * ── INTEGRATION POINTS (Developer B) ─────────────────────────────────────────
 * 1. Replace MOCK_RALLIES import with real exercise loader from exercises.js
 * 2. Replace calcPoints() with calls to evaluate.js scoring functions
 * 3. Call hud.setXP() and hud.setLevel() from progression.js hooks
 * 4. Wire match.js rally chaining in place of the simple linear rally
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Court }                  from './court.js';
import { Renderer }               from './renderer.js';
import { ZoneOverlay, getZoneAt } from './zones.js';
import { DragShooter }            from './drag.js';
import { Animator }               from './animations.js';
import { snapToGrid }             from './snap.js';
import { HUD }                    from './hud.js';
import { ScreenManager }          from './screens.js';
import { MOCK_RALLIES }           from './mock-data.js';  // INTEGRATION POINT 1

// ─── Init ─────────────────────────────────────────────────────────────────────

const canvas   = document.getElementById('game-canvas');
const court    = new Court(canvas);
const renderer = new Renderer(canvas, court);
const zones    = new ZoneOverlay(canvas, court);
const anim     = new Animator(canvas, court);
const hud      = new HUD();
const screens  = new ScreenManager();

// DragShooter references onShotFired which is declared below (hoisted)
const drag = new DragShooter(canvas, court, onShotFired);

// ─── Game state ───────────────────────────────────────────────────────────────

/** @type {Array|null} Active rally turn list */
let currentRally    = null;
let currentWorkshop = null;
let turnIndex       = 0;
let score           = 0;
let combo           = 0;
let correct         = 0;

/** rAF id for the drag render loop */
let dragRafId = null;

/** Zone ID under cursor during positioning hover */
let hoverZone = null;

/** Tracks whether a turn is currently active (prevents input during animations) */
let turnActive = false;

// ─── Rendering helpers ─────────────────────────────────────────────────────

/**
 * Render one static frame: court + optional hover zone + scene.
 * Does NOT drive animations — those composite on top each rAF tick.
 */
function renderBase(turn, { showShuttle = true, hoverZoneId = null } = {}) {
  court.draw();
  if (hoverZoneId) zones.drawHoverZone(hoverZoneId);
  renderer.drawScene(turn.players, showShuttle ? turn.shuttlecock : null, 'ally1');
}

const nextFrame = () => new Promise(r => requestAnimationFrame(r));

/**
 * Run multiple animations simultaneously, redrawing base each frame.
 * @param {Array<() => Promise>} starters
 * @param {function} baseRender  Called each frame before animations draw
 */
async function runAnims(starters, baseRender) {
  let remaining = starters.length;
  const promises = starters.map(fn => fn().then(() => { remaining--; }));
  while (remaining > 0) {
    baseRender();
    await nextFrame();
  }
  await Promise.all(promises);
}

// ─── Drag render loop ──────────────────────────────────────────────────────

function startDragLoop(turn) {
  if (dragRafId !== null) return;
  function loop() {
    renderBase(turn, { showShuttle: true });
    drag.draw();
    dragRafId = requestAnimationFrame(loop);
  }
  dragRafId = requestAnimationFrame(loop);
}

function stopDragLoop() {
  if (dragRafId !== null) { cancelAnimationFrame(dragRafId); dragRafId = null; }
}

// ─── Input cleanup ─────────────────────────────────────────────────────────

/**
 * Remove all canvas input listeners that may be active during a turn.
 * Called before any screen transition away from 'exercise'.
 */
function cleanupTurnListeners() {
  canvas.removeEventListener('pointermove', onPositionHover);
  canvas.style.cursor = 'default';
  stopDragLoop();
  drag.deactivate();
}

// ─── Positioning turn ──────────────────────────────────────────────────────

function startPositioningTurn(turn) {
  turnActive = true;
  hoverZone = null;
  renderBase(turn);
  hud.setInstruction(turn);
  hud.update(score, turnIndex, currentRally.length, combo);
  canvas.style.cursor = 'crosshair';
  canvas.addEventListener('pointermove', onPositionHover);
  canvas.addEventListener('pointerup', onPositionClick, { once: true });
}

function onPositionHover(e) {
  const turn = currentRally[turnIndex];
  const rect = canvas.getBoundingClientRect();
  const raw  = court.toNormalized(e.clientX - rect.left, e.clientY - rect.top);
  const pos  = snapToGrid(Math.max(0, Math.min(1, raw.x)), Math.max(0, Math.min(1, raw.y)));
  const newHover = (pos.y >= 0.5) ? getZoneAt(pos.x, pos.y) : null;
  if (newHover !== hoverZone) {
    hoverZone = newHover;
    renderBase(turn, { hoverZoneId: hoverZone });
  }
}

async function onPositionClick(e) {
  if (!turnActive) return;
  canvas.removeEventListener('pointermove', onPositionHover);
  canvas.style.cursor = 'default';
  hoverZone = null;

  const turn = currentRally[turnIndex];
  const rect = canvas.getBoundingClientRect();
  const raw  = court.toNormalized(e.clientX - rect.left, e.clientY - rect.top);
  const pos  = snapToGrid(Math.max(0, Math.min(1, raw.x)), Math.max(0, Math.min(1, raw.y)));

  // Reject clicks on opponent half
  if (pos.y < 0.5) {
    renderBase(turn);
    zones.drawWrongZones([getZoneAt(pos.x, pos.y)].filter(Boolean));
    await hud.showExplanation('⚠ Clique sur ta moitié du terrain !', '#f97316', 1200);
    canvas.addEventListener('pointermove', onPositionHover);
    canvas.addEventListener('pointerup', onPositionClick, { once: true });
    canvas.style.cursor = 'crosshair';
    return;
  }

  const clickedZone = getZoneAt(pos.x, pos.y);
  const isCorrect   = turn.correctZones.includes(clickedZone);

  // Move all players simultaneously
  const movementStarters = [];
  movementStarters.push(() => anim.movePlayer(turn.players.ally1, pos, true));
  for (const [id, data] of Object.entries(turn.players)) {
    if (id !== 'ally1' && data.movingTo) {
      movementStarters.push(() => anim.movePlayer(data, data.movingTo, id.startsWith('ally')));
    }
  }
  await runAnims(movementStarters, () => renderBase(turn));

  // Freeze result frame
  renderBase(turn);
  turn.correctZones.forEach(z => zones.drawCorrectZones([z]));
  if (!isCorrect) zones.drawClickMarker(pos.x, pos.y);
  else            zones.drawCheckmark(pos.x, pos.y);

  await runAnims(
    [() => anim.flashFeedback(isCorrect ? 'correct' : 'wrong')],
    () => { renderBase(turn); turn.correctZones.forEach(z => zones.drawCorrectZones([z])); },
  );

  await hud.showExplanation(
    isCorrect ? `✓ ${turn.explanation}` : `✗ ${turn.explanation}`,
    isCorrect ? '#34d399' : '#f87171',
  );

  applyScore(calcPoints(isCorrect), isCorrect);
  nextTurn();
}

// ─── Shot turn ─────────────────────────────────────────────────────────────

async function startShotTurn(turn) {
  turnActive = true;
  // Show instruction immediately — player reads while shuttle flies in
  hud.setInstruction(turn);
  hud.update(score, turnIndex, currentRally.length, combo);
  // Animate incoming shuttle
  await runAnims(
    [() => anim.flyShuttle(turn.shuttlecock.from, turn.shuttlecock.position, turn.shuttlecock.speed, 'high')],
    () => renderBase(turn, { showShuttle: false }),
  );
  renderBase(turn);
  canvas.addEventListener('pointerdown', () => startDragLoop(turn), { once: true, passive: true });
  drag.activate(turn.shuttlecock.position);
}

// NOTE: declared as function declaration for hoisting (DragShooter constructor
// receives this as a callback before the function expressions below are reached)
async function onShotFired(shot) {
  if (!turnActive) return;
  stopDragLoop();
  drag.deactivate();
  const turn = currentRally[turnIndex];

  const aimZone   = getZoneAt(shot.aimPoint.x, shot.aimPoint.y);
  const isCorrect = turn.correctZones.includes(aimZone);

  const flightSpeed = shot.power < 0.3 ? 'slow' : shot.power < 0.6 ? 'medium' : 'fast';

  // Opponents react toward landing zone simultaneously with the shot flight
  const opp1   = turn.players.opponent1;
  const opp2   = turn.players.opponent2;
  const { x: lx, y: ly } = shot.aimPoint;
  const opp1Target = { x: (opp1.x + lx) / 2, y: (opp1.y + ly) / 2 };
  const opp2Target = { x: (opp2.x + lx) / 2, y: (opp2.y + ly) / 2 };

  await runAnims(
    [
      () => anim.flyShuttle(turn.shuttlecock.position, shot.aimPoint, flightSpeed, 'low'),
      () => anim.movePlayer(opp1, opp1Target, false),
      () => anim.movePlayer(opp2, opp2Target, false),
    ],
    () => renderBase(turn, { showShuttle: false }),
  );

  // Freeze result frame
  renderBase(turn, { showShuttle: false });
  turn.correctZones.forEach(z => zones.drawCorrectZones([z]));
  if (!isCorrect) zones.drawClickMarker(shot.aimPoint.x, shot.aimPoint.y);
  else            zones.drawCheckmark(shot.aimPoint.x, shot.aimPoint.y);

  await runAnims(
    [() => anim.flashFeedback(isCorrect ? 'correct' : 'wrong')],
    () => {
      renderBase(turn, { showShuttle: false });
      turn.correctZones.forEach(z => zones.drawCorrectZones([z]));
    },
  );

  await hud.showExplanation(
    isCorrect ? `✓ ${turn.explanation}` : `✗ ${turn.explanation}`,
    isCorrect ? '#34d399' : '#f87171',
  );

  applyScore(calcPoints(isCorrect), isCorrect);
  nextTurn();
}

// ─── Scoring ───────────────────────────────────────────────────────────────

// INTEGRATION POINT 2: replace with evaluate.js scoring when available
function calcPoints(isCorrect) {
  if (!isCorrect) return 0;
  return Math.round(100 * (1 + Math.max(0, combo - 1) * 0.5));
}

function applyScore(pts, isCorrect) {
  score += pts;
  if (isCorrect) { combo++; correct++; } else { combo = 0; }
  hud.update(score, turnIndex, currentRally.length, combo);
}

// ─── Turn sequencing ────────────────────────────────────────────────────────

function nextTurn() {
  turnActive = false;
  hud.hideInstruction();  // clear immediately, new turn will set its own
  turnIndex++;
  if (turnIndex >= currentRally.length) {
    setTimeout(showEndScreen, 350);
    return;
  }
  setTimeout(() => runTurn(turnIndex), 350);
}

function runTurn(index) {
  const turn = currentRally[index];
  if (turn.type === 'positioning') startPositioningTurn(turn);
  else                             startShotTurn(turn);
}

function showEndScreen() {
  hud.hideInstruction();
  const pct   = Math.round((correct / currentRally.length) * 100);
  const stars = pct >= 90 ? '★★★' : pct >= 60 ? '★★☆' : '★☆☆';
  document.getElementById('end-title').textContent  = `${stars}  Fin du rally !`;
  document.getElementById('end-score').textContent  = `Score : ${score} pts`;
  document.getElementById('end-detail').textContent = `${correct} / ${currentRally.length} bonnes réponses`;
  document.getElementById('end-screen').style.display = 'flex';
}

// ─── Screen routing ─────────────────────────────────────────────────────────

function startGame(workshop) {
  currentWorkshop = workshop;
  currentRally    = MOCK_RALLIES[workshop];
  turnIndex = 0; score = 0; combo = 0; correct = 0;
  turnActive = false;

  // Hide end screen if visible
  document.getElementById('end-screen').style.display = 'none';

  screens.show('exercise');
  hud.show();
  hud.update(score, 0, currentRally.length, 0);
  runTurn(0);
}

function resetAndShowMenu() {
  cleanupTurnListeners();
  turnActive = false;
  currentRally = null;
  document.getElementById('end-screen').style.display = 'none';
  hud.hideInstruction();
  hud.hide();
  screens.show('menu');
}

// Wire screen events
screens.on('menu:start',       ()             => screens.show('workshop-select'));
screens.on('workshop:select',  ({ workshop }) => startGame(workshop));
screens.on('end:replay',       ()             => startGame(currentWorkshop));
screens.on('end:menu',         ()             => resetAndShowMenu());

// ─── Startup ────────────────────────────────────────────────────────────────

// Draw a blank court in the background for visual context behind the menu
court.draw();

hud.hide();
screens.show('menu');

window.addEventListener('resize', () => {
  court._resize();
  if (currentRally && turnIndex < currentRally.length) {
    renderBase(currentRally[turnIndex]);
  } else {
    court.draw();
  }
});
