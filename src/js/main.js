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
import { payloadToLogic }         from './coord-adapter.js';
import { buildPlacementPayload, buildTacticalPayload } from './payload-builder.js';
import { loadWorkshopRally, warmScenarioCatalog } from './exercises.js';
import { evaluatePlacementTurn, evaluateTacticalTurn, prepareTurnForRuntime } from './evaluate.js';
import { ExerciseTimer }          from './timer.js';
import { recordGameSessionAsync } from './app-state.js';

const COURT_WIDTH_M = 6.10;
const FULL_COURT_LENGTH_M = 13.40;
const MOVE_RADIUS_STROKE = 'rgba(94, 234, 212, 0.42)';
const DEFAULT_PLAYER_PROFILE = Object.freeze({
  rank: 'P12',
  points: 0,
  level: 1,
});

// ─── Init ─────────────────────────────────────────────────────────────────────

const canvas   = document.getElementById('game-canvas');
const court    = new Court(canvas);
const renderer = new Renderer(canvas, court);
const zones    = new ZoneOverlay(canvas, court);
const anim     = new Animator(canvas, court);
const hud      = new HUD();
const screens  = new ScreenManager();
const timer    = new ExerciseTimer(
  DEFAULT_PLAYER_PROFILE.rank,
  () => {},
  () => {
    const context = timedTurnContext;
    if (!context) return;
    void handleTurnTimeout(context);
  },
  hud.getTimerElement(),
);

// DragShooter references onShotFired which is declared below (hoisted)
const drag = new DragShooter(canvas, court, onShotFired);

// ─── Game state ───────────────────────────────────────────────────────────────

/** @type {Array|null} Active rally turn list */
let currentRally    = null;
let currentWorkshop = null;
let currentDrillId  = null;
let turnIndex       = 0;
let score           = 0;
let combo           = 0;
let correct         = 0;
let gameStartedAt   = null;

// Extended stats (per-turn accumulation for end-screen)
let scoreTacticalSum  = 0;
let scorePlacementSum = 0;
let countTactical     = 0;
let countPlacement    = 0;
let totalBonus        = 0;
let totalMalus        = 0;
let countBackhand     = 0;
let countBody         = 0;
let countTooClose     = 0;
let countTooFar       = 0;

/** rAF id for the drag render loop */
let dragRafId = null;

/** Zone ID under cursor during positioning hover */
let hoverZone = null;

/** Tracks whether a turn is currently active (prevents input during animations) */
let turnActive = false;
let startRequestId = 0;
let timedTurnContext = null;

// ─── Rendering helpers ─────────────────────────────────────────────────────

/**
 * Render one static frame: court + optional hover zone + scene.
 * Does NOT drive animations — those composite on top each rAF tick.
 */
function renderBase(turn, { showShuttle = true, hoverZoneId = null } = {}) {
  court.draw();
  if (hoverZoneId) zones.drawHoverZone(hoverZoneId);
  renderer.drawScene(turn.players, showShuttle ? turn.shuttlecock : null, 'ally1', turn.equipment ?? null);
  if (turn?.type === 'positioning' && turn?.moveRadius && turn?.players?.ally1) {
    renderer.drawReachCircle(turn.players.ally1, turn.moveRadius, MOVE_RADIUS_STROKE);
  }
  if (turn?.playerReach && turn?.players?.ally1) {
    renderer.drawReachCircle(turn.players.ally1, turn.playerReach);
  }
}

function renderFeedbackFrame(
  turn,
  {
    showShuttle = true,
    hoverZoneId = null,
    correctionFrom = null,
    correctionTo = null,
  } = {},
) {
  renderBase(turn, { showShuttle, hoverZoneId });
  if (correctionFrom && correctionTo) {
    renderer.drawCorrectionIndicator(correctionFrom, correctionTo);
  }
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

function onShotPointerDown() {
  const turn = currentRally?.[turnIndex];
  if (!turn || !turnActive) return;
  startDragLoop(turn);
}

// ─── Input cleanup ─────────────────────────────────────────────────────────

/**
 * Remove all canvas input listeners that may be active during a turn.
 * Called before any screen transition away from 'exercise'.
 */
function cleanupTurnListeners() {
  canvas.removeEventListener('pointermove', onPositionHover);
  canvas.removeEventListener('pointerup', onPositionClick);
  canvas.removeEventListener('pointerdown', onShotPointerDown);
  canvas.style.cursor = 'default';
  stopDragLoop();
  drag.deactivate();
}

function clampToRadius(origin, target, radiusMetres) {
  if (!origin || !radiusMetres) return target;

  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const distM = Math.hypot(dx * COURT_WIDTH_M, dy * FULL_COURT_LENGTH_M);

  if (distM <= radiusMetres || distM === 0) return target;

  const scale = radiusMetres / distM;
  return snapToGrid(origin.x + dx * scale, origin.y + dy * scale);
}

function constrainPlacementPos(turn, pos) {
  if (!turn?.moveRadius || !turn?.players?.ally1) return pos;
  return clampToRadius(turn.players.ally1, pos, turn.moveRadius);
}

function buildScoreLines(totalScore, messages = []) {
  const list = [`Score : ${totalScore}/100`];
  if (Array.isArray(messages)) return list.concat(messages.filter(Boolean));
  if (messages) list.push(messages);
  return list;
}

function getTimePressure(turn) {
  const enabled = turn?.timePressure?.enabled !== false;
  const secondsPerTurn = Number.isFinite(turn?.timePressure?.secondsPerTurn)
    ? turn.timePressure.secondsPerTurn
    : null;

  return { enabled, secondsPerTurn };
}

function startTurnTimer(turn) {
  stopTurnTimer();

  const { enabled, secondsPerTurn } = getTimePressure(turn);
  if (!enabled) return;

  timedTurnContext = {
    requestId: startRequestId,
    turnIndex,
    turnType: turn.type,
  };
  timer.start(turn.type, secondsPerTurn);
}

function stopTurnTimer() {
  timedTurnContext = null;
  timer.stop();
}

async function animatePlacementResolution(turn, pos) {
  const movementStarters = [() => anim.movePlayer(turn.players.ally1, pos, true)];

  for (const [id, data] of Object.entries(turn.players)) {
    if (id !== 'ally1' && data.movingTo) {
      movementStarters.push(() => anim.movePlayer(data, data.movingTo, id.startsWith('ally')));
    }
  }

  await runAnims(movementStarters, () => renderBase(turn));
}

function recordTacticalFeedback(feedback) {
  const bonus = feedback.details?.breakdown?.bonus;
  if (typeof bonus === 'number') {
    if (bonus > 0) recordBonus(bonus);
    if (bonus < 0) recordMalus(Math.abs(bonus));
  }

  if (feedback.flags?.isBackhandTargeted) recordBackhandHit();
  if (feedback.flags?.isBodyHit) recordBodyHit();
}

function recordPlacementFeedback(feedback) {
  const dist = feedback.details?.realDistance;
  if (typeof dist === 'number') {
    recordPartnerDistance(dist);
  }
}

async function resolvePositioningTimeout(turn) {
  const fallbackPos = { ...turn.players.ally1 };
  await animatePlacementResolution(turn, fallbackPos);

  const feedback = evaluatePlacementTurn(turn, payloadToLogic(buildPlacementPayload(fallbackPos, turn)));
  const isCorrect = feedback.totalScore >= (turn.passingScore ?? 70);
  recordPlacementFeedback(feedback);

  renderFeedbackFrame(turn, {
    correctionFrom: fallbackPos,
    correctionTo: feedback.idealPositionRender,
  });
  if (!isCorrect) zones.drawClickMarker(fallbackPos.x, fallbackPos.y);
  else            zones.drawCheckmark(fallbackPos.x, fallbackPos.y);

  await runAnims(
    [() => anim.flashFeedback(isCorrect ? 'correct' : 'wrong')],
    () => {
      renderFeedbackFrame(turn, {
        correctionFrom: fallbackPos,
        correctionTo: feedback.idealPositionRender,
      });
      if (!isCorrect) zones.drawClickMarker(fallbackPos.x, fallbackPos.y);
      else            zones.drawCheckmark(fallbackPos.x, fallbackPos.y);
    },
  );

  const timeoutLines = ['Temps ecoule : ta position initiale a ete conservee.'];
  if (feedback.message) timeoutLines.push(feedback.message);

  await hud.showMessages(
    buildScoreLines(feedback.totalScore, timeoutLines),
    isCorrect ? '#34d399' : '#f87171',
    2200,
  );

  applyScore(feedback.totalScore, isCorrect);
  nextTurn();
}

async function resolveShotTimeout(turn) {
  const shuttlePos = turn.shuttlecock?.position ?? null;
  const winner = shuttlePos && shuttlePos.y < 0.5 ? 'player' : 'opp';

  renderBase(turn);
  if (shuttlePos) zones.drawClickMarker(shuttlePos.x, shuttlePos.y);

  await runAnims(
    [() => anim.flashFeedback('wrong')],
    () => {
      renderBase(turn);
      if (shuttlePos) zones.drawClickMarker(shuttlePos.x, shuttlePos.y);
    },
  );

  await showPointResult({ winner, reason: 'TIME' });
  await hud.showMessages(
    buildScoreLines(0, ['Temps ecoule : le volant tombe au sol avant ta frappe.']),
    '#f87171',
    2200,
  );

  applyScore(0, false);
  nextTurn();
}

async function handleTurnTimeout(context) {
  const turn = currentRally?.[context.turnIndex];
  if (!turn || !turnActive) return;
  if (context.requestId !== startRequestId || context.turnIndex !== turnIndex) return;

  stopTurnTimer();
  cleanupTurnListeners();
  turnActive = false;

  if (turn.type === 'positioning') await resolvePositioningTimeout(turn);
  else                             await resolveShotTimeout(turn);
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
  startTurnTimer(turn);
}

function onPositionHover(e) {
  const turn = currentRally[turnIndex];
  const rect = canvas.getBoundingClientRect();
  const raw  = court.toNormalized(e.clientX - rect.left, e.clientY - rect.top);
  const snapped = snapToGrid(Math.max(0, Math.min(1, raw.x)), Math.max(0, Math.min(1, raw.y)));
  const pos = constrainPlacementPos(turn, snapped);
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
  const snapped = snapToGrid(Math.max(0, Math.min(1, raw.x)), Math.max(0, Math.min(1, raw.y)));

  // Reject clicks on opponent half
  if (snapped.y < 0.5) {
    renderBase(turn);
    zones.drawWrongZones([getZoneAt(snapped.x, snapped.y)].filter(Boolean));
    await hud.showExplanation('⚠ Clique sur ta moitié du terrain !', '#f97316', 1200);
    canvas.addEventListener('pointermove', onPositionHover);
    canvas.addEventListener('pointerup', onPositionClick, { once: true });
    canvas.style.cursor = 'crosshair';
    return;
  }

  stopTurnTimer();
  const pos = constrainPlacementPos(turn, snapped);

  await animatePlacementResolution(turn, pos);

  const feedback = evaluatePlacementTurn(turn, payloadToLogic(buildPlacementPayload(pos, turn)));
  const isCorrect = feedback.totalScore >= (turn.passingScore ?? 70);
  recordPlacementFeedback(feedback);

  // Freeze result frame
  renderFeedbackFrame(turn, {
    correctionFrom: pos,
    correctionTo: feedback.idealPositionRender,
  });
  if (!isCorrect) zones.drawClickMarker(pos.x, pos.y);
  else            zones.drawCheckmark(pos.x, pos.y);

  await runAnims(
    [() => anim.flashFeedback(isCorrect ? 'correct' : 'wrong')],
    () => {
      renderFeedbackFrame(turn, {
        correctionFrom: pos,
        correctionTo: feedback.idealPositionRender,
      });
      if (!isCorrect) zones.drawClickMarker(pos.x, pos.y);
      else            zones.drawCheckmark(pos.x, pos.y);
    },
  );

  await hud.showMessages(
    buildScoreLines(feedback.totalScore, feedback.message ? [feedback.message] : []),
    isCorrect ? '#34d399' : '#f87171',
  );

  applyScore(feedback.totalScore, isCorrect);
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
  canvas.addEventListener('pointerdown', onShotPointerDown, { once: true, passive: true });
  drag.activate(turn.shuttlecock.position);
  startTurnTimer(turn);
}

// NOTE: declared as function declaration for hoisting (DragShooter constructor
// receives this as a callback before the function expressions below are reached)
async function onShotFired(shot) {
  if (!turnActive) return;
  stopTurnTimer();
  stopDragLoop();
  drag.deactivate();
  const turn = currentRally[turnIndex];

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

  const feedback = evaluateTacticalTurn(turn, payloadToLogic(buildTacticalPayload(shot, turn)));
  const isCorrect = feedback.totalScore >= (turn.passingScore ?? 70);
  recordTacticalFeedback(feedback);

  // Freeze result frame
  renderFeedbackFrame(turn, {
    showShuttle: false,
    correctionFrom: turn.shuttlecock.position,
    correctionTo: feedback.correctionRenderPos,
  });
  if (!isCorrect) zones.drawClickMarker(shot.aimPoint.x, shot.aimPoint.y);
  else            zones.drawCheckmark(shot.aimPoint.x, shot.aimPoint.y);

  await runAnims(
    [() => anim.flashFeedback(isCorrect ? 'correct' : 'wrong')],
    () => {
      renderFeedbackFrame(turn, {
        showShuttle: false,
        correctionFrom: turn.shuttlecock.position,
        correctionTo: feedback.correctionRenderPos,
      });
      if (!isCorrect) zones.drawClickMarker(shot.aimPoint.x, shot.aimPoint.y);
      else            zones.drawCheckmark(shot.aimPoint.x, shot.aimPoint.y);
    },
  );

  if (feedback.flags?.isBackhandTargeted) await hud.showPopup('backhand', 900);
  if (feedback.flags?.isBodyHit) await hud.showPopup('body', 900);

  await hud.showMessages(
    buildScoreLines(feedback.totalScore, feedback.messages),
    isCorrect ? '#34d399' : '#f87171',
    2200,
  );

  applyScore(feedback.totalScore, isCorrect);
  nextTurn();
}

function applyScore(pts, isCorrect) {
  score += pts;
  if (isCorrect) { combo++; correct++; } else { combo = 0; }
  hud.update(score, turnIndex, currentRally.length, combo);

  const turn = currentRally?.[turnIndex];
  if (turn?.type === 'shot') {
    scoreTacticalSum += pts; countTactical++;
  } else if (turn?.type === 'positioning') {
    scorePlacementSum += pts; countPlacement++;
  }
}

// ─── Extended stat recorders (called by Logic engine integration) ──────────

export function recordBonus(pts) { totalBonus += pts; }
export function recordMalus(pts) { totalMalus += pts; }
export function recordBackhandHit() { countBackhand++; }
export function recordBodyHit() { countBody++; }
export function recordPartnerDistance(dist) {
  if (dist < 2.5) countTooClose++;
  else if (dist > 3.5) countTooFar++;
}

// ─── STOP signal handler ──────────────────────────────────────────────────

function showPointResult(signal) {
  let el = document.getElementById('point-result');
  if (!el) {
    el = document.createElement('div');
    el.id = 'point-result';
    Object.assign(el.style, {
      position: 'fixed', top: '50%', left: '50%',
      transform: 'translate(-50%,-50%)', padding: '16px 32px',
      borderRadius: '10px', font: 'bold 24px system-ui',
      color: 'white', zIndex: '200', pointerEvents: 'none',
      transition: 'opacity 0.3s ease', display: 'none',
    });
    document.body.appendChild(el);
  }

  let text, bg;
  if (signal.winner === 'player') {
    text = signal.reason === 'TIME' ? '✓ Temps ecoule, point gagne' : '✓ Point gagne !';
    bg = '#16a34a';
  } else {
    bg = '#dc2626';
    text = signal.reason === 'NET'   ? '✗ Filet'
         : signal.reason === 'OUT'   ? '✗ Dehors'
         : signal.reason === 'TIME'  ? '✗ Temps ecoule'
         : '✗ Faute';
  }
  el.textContent = text;
  el.style.background = bg;
  el.style.opacity = '1';
  el.style.display = 'block';

  return new Promise(resolve => {
    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => { el.style.display = 'none'; resolve(); }, 300);
    }, 1500);
  });
}

export async function handleStopSignal(signal) {
  if (!turnActive) return;
  stopTurnTimer();
  cleanupTurnListeners();
  turnActive = false;
  await showPointResult(signal);
  applyScore(0, false);
  nextTurn();
}

// INTEGRATION POINT: Call handleStopSignal(signal) from match.js when Logic engine sends STOP

// ─── Turn sequencing ────────────────────────────────────────────────────────

function nextTurn() {
  stopTurnTimer();
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
  const avgTactical   = countTactical   > 0 ? Math.round(scoreTacticalSum  / countTactical)   : '—';
  const avgPlacement  = countPlacement  > 0 ? Math.round(scorePlacementSum / countPlacement)  : '—';

  document.getElementById('end-title').textContent  = `${stars}  Fin du rally !`;
  document.getElementById('end-score').textContent  = `Score : ${score} pts`;

  const details = [
    `${correct} / ${currentRally.length} bonnes réponses`,
    `Tir : ${avgTactical !== '—' ? avgTactical + ' pts' : '—'}  |  Placement : ${avgPlacement !== '—' ? avgPlacement + ' pts' : '—'}`,
    ...(totalBonus  > 0 ? [`Bonus : +${totalBonus}`]    : []),
    ...(totalMalus  > 0 ? [`Malus : -${totalMalus}`]    : []),
    ...(countBackhand > 0 ? [`Revers visés : ${countBackhand}`] : []),
    ...(countBody     > 0 ? [`Au corps : ${countBody}`]          : []),
    ...(countTooClose > 0 ? [`Trop près du partenaire : ${countTooClose}`] : []),
    ...(countTooFar   > 0 ? [`Trop loin du partenaire : ${countTooFar}`]   : []),
  ];
  document.getElementById('end-detail').style.whiteSpace = 'pre-line';
  document.getElementById('end-detail').textContent = details.join('\n');
  document.getElementById('end-screen').style.display = 'flex';

  void recordGameSessionAsync({
    drillId: currentDrillId,
    workshop: currentWorkshop,
    matchId: currentRally[0]?.matchId ?? null,
    score,
    correct,
    totalTurns: currentRally.length,
    durationSeconds: gameStartedAt ? Math.max(0, Math.round((Date.now() - gameStartedAt) / 1000)) : 0,
    tacticalAverage: typeof avgTactical === 'number' ? avgTactical : null,
    placementAverage: typeof avgPlacement === 'number' ? avgPlacement : null,
    completedAt: new Date().toISOString(),
  }).catch(error => {
    console.warn('Sauvegarde de session impossible', error);
  });
}

// ─── Screen routing ─────────────────────────────────────────────────────────

async function startGame(workshop) {
  const requestId = ++startRequestId;
  currentWorkshop = workshop;
  currentDrillId = workshop === 'defense' ? 'd5' : workshop === 'attack' ? 'd1' : null;
  currentRally = null;
  gameStartedAt = Date.now();
  stopTurnTimer();
  cleanupTurnListeners();
  turnIndex = 0; score = 0; combo = 0; correct = 0;
  scoreTacticalSum = 0; scorePlacementSum = 0;
  countTactical = 0; countPlacement = 0;
  totalBonus = 0; totalMalus = 0;
  countBackhand = 0; countBody = 0;
  countTooClose = 0; countTooFar = 0;
  turnActive = false;

  // Hide end screen if visible
  document.getElementById('end-screen').style.display = 'none';

  screens.show('exercise');
  hud.show();
  hud.setLevel(DEFAULT_PLAYER_PROFILE.level);
  hud.setXP(DEFAULT_PLAYER_PROFILE.points, 100);
  hud.setInstruction({ type: 'positioning', label: 'Chargement', text: 'Chargement des scenarios...' });
  hud.update(score, 0, 1, 0);
  court.draw();

  try {
    const rally = await loadWorkshopRally(workshop);
    if (requestId !== startRequestId) return;
    currentRally = rally.map(prepareTurnForRuntime);
  } catch (error) {
    console.error('Impossible de charger le rally', error);
    if (requestId !== startRequestId) return;
    const message = error instanceof Error ? error.message : 'Erreur de chargement des scenarios.';
    await hud.showExplanation(message, '#f87171', 2200);
    resetAndShowMenu();
    return;
  }

  hud.update(score, 0, currentRally.length, 0);
  runTurn(0);
}

function resetAndShowMenu() {
  startRequestId++;
  stopTurnTimer();
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
screens.on('workshop:select',  ({ workshop }) => { void startGame(workshop); });
screens.on('end:replay',       ()             => { if (currentWorkshop) void startGame(currentWorkshop); });
screens.on('end:menu',         ()             => resetAndShowMenu());

// ─── Startup ────────────────────────────────────────────────────────────────

// Draw a blank court in the background for visual context behind the menu
court.draw();

hud.hide();
screens.show('menu');
void warmScenarioCatalog().catch(error => {
  console.error('Prechargement des scenarios impossible', error);
});

window.addEventListener('resize', () => {
  court._resize();
  if (currentRally && turnIndex < currentRally.length) {
    renderBase(currentRally[turnIndex]);
  } else {
    court.draw();
  }
});
