import { MOCK_EXERCISES, MOCK_RALLIES } from './mock-data.js';
import { KinematicEngine } from './logic/KinematicEngine.js';
import { PlacementEngine } from './logic/PlacementEngine.js';
import { TacticalEngine } from './logic/TacticalEngine.js';
import { ScenarioGenerator } from './logic/ScenarioGenerator.js';
import { AISpawnEngine } from './logic/AISpawnEngine.js';
import { toFullCourtAlly, toFullCourtOpp } from './coord-adapter.js';

const DATA_FILES = {
  positioning: 'data/positioning.json',
  shots: 'data/shots.json',
  matches: 'data/matches.json',
};

const SHOT_TYPES = new Set(['SMASH', 'KILL', 'DRIVE', 'DROP', 'NET_DROP', 'CLEAR', 'NET_CLEAR']);
const EXERCISE_TYPES = new Set(['shot', 'positioning']);
const HANDS = new Set(['left', 'right']);
const COORD_EPSILON = 1e-6;
const DEFAULT_TIME_PRESSURE = {
  enabled: true,
  secondsPerTurn: null,
};

class CatalogLoadError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'CatalogLoadError';
  }
}

class CatalogValidationError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'CatalogValidationError';
  }
}

let catalogPromise = null;

async function fetchJson(path) {
  let response;
  try {
    response = await fetch(path, { cache: 'no-store' });
  } catch (error) {
    throw new CatalogLoadError(`Unable to load ${path}`, { cause: error });
  }

  if (!response.ok) {
    throw new CatalogLoadError(`Unable to load ${path} (${response.status})`);
  }

  try {
    return await response.json();
  } catch (error) {
    throw new CatalogValidationError(`Invalid JSON in ${path}`, { cause: error });
  }
}

function fail(message) {
  throw new CatalogValidationError(message);
}

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
}

function assertArray(value, label) {
  if (!Array.isArray(value)) {
    fail(`${label} must be an array`);
  }
}

function assertString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(`${label} must be a non-empty string`);
  }
}

function assertBoolean(value, label) {
  if (typeof value !== 'boolean') {
    fail(`${label} must be a boolean`);
  }
}

function assertNumber(value, label, { min = -Infinity, max = Infinity, integer = false } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(`${label} must be a number`);
  }
  if (value < min || value > max) {
    fail(`${label} must be between ${min} and ${max}`);
  }
  if (integer && !Number.isInteger(value)) {
    fail(`${label} must be an integer`);
  }
}

function assertEnum(value, allowed, label) {
  if (!allowed.has(value)) {
    fail(`${label} must be one of ${Array.from(allowed).join(', ')}`);
  }
}

function validatePosition(pos, label) {
  assertObject(pos, label);
  assertNumber(pos.x, `${label}.x`, { min: -COORD_EPSILON, max: 1 + COORD_EPSILON });
  assertNumber(pos.y, `${label}.y`, { min: -COORD_EPSILON, max: 1 + COORD_EPSILON });
}

function validateMovement(entry, label) {
  assertObject(entry, label);
  validatePosition(entry.from, `${label}.from`);
  validatePosition(entry.to, `${label}.to`);
}

function validatePlayerEntry(entry, label) {
  assertObject(entry, label);
  validatePosition(entry, label);
  if (entry.movingTo !== undefined) validatePosition(entry.movingTo, `${label}.movingTo`);
  if (entry.label !== undefined) assertString(entry.label, `${label}.label`);
}

function validateEquipmentSpec(spec, label) {
  assertObject(spec, label);
  assertEnum(spec.hand, HANDS, `${label}.hand`);
}

function validateEquipment(equipment, label) {
  assertObject(equipment, label);
  ['player', 'partner', 'opp1', 'opp2'].forEach(key => {
    validateEquipmentSpec(equipment[key], `${label}.${key}`);
  });
}

function validatePositions(positions, label) {
  assertObject(positions, label);
  validatePlayerEntry(positions.player, `${label}.player`);
  validatePlayerEntry(positions.partner, `${label}.partner`);
  validatePlayerEntry(positions.opp1, `${label}.opp1`);
  validatePlayerEntry(positions.opp2, `${label}.opp2`);
}

function validateShot(shuttle, label) {
  assertObject(shuttle, label);
  validatePosition(shuttle.startPos, `${label}.startPos`);
  validatePosition(shuttle.endPos, `${label}.endPos`);
  assertEnum(shuttle.type, SHOT_TYPES, `${label}.type`);
}

function validateOpponentsMovement(opponentsMovement, label) {
  if (opponentsMovement === undefined) return;
  assertObject(opponentsMovement, label);
  if (opponentsMovement.opp1 !== undefined) {
    const opp1Label = `${label}.opp1`;
    assertObject(opponentsMovement.opp1, opp1Label);
    if ('to' in opponentsMovement.opp1) {
      if (opponentsMovement.opp1.from !== undefined) validatePosition(opponentsMovement.opp1.from, `${opp1Label}.from`);
      validatePosition(opponentsMovement.opp1.to, `${opp1Label}.to`);
    } else {
      validatePosition(opponentsMovement.opp1, opp1Label);
    }
  }
  if (opponentsMovement.opp2 !== undefined) {
    const opp2Label = `${label}.opp2`;
    assertObject(opponentsMovement.opp2, opp2Label);
    if ('to' in opponentsMovement.opp2) {
      if (opponentsMovement.opp2.from !== undefined) validatePosition(opponentsMovement.opp2.from, `${opp2Label}.from`);
      validatePosition(opponentsMovement.opp2.to, `${opp2Label}.to`);
    } else {
      validatePosition(opponentsMovement.opp2, opp2Label);
    }
  }
}

function validateScenarioCommon(exercise, label) {
  assertObject(exercise, label);
  assertString(exercise.id, `${label}.id`);
  assertEnum(exercise.type, EXERCISE_TYPES, `${label}.type`);
  assertString(exercise.workshop, `${label}.workshop`);
  assertString(exercise.label, `${label}.label`);
  assertString(exercise.text, `${label}.text`);
  validatePositions(exercise.positions, `${label}.positions`);
  validateEquipment(exercise.equipment, `${label}.equipment`);

  if (exercise.explanation !== undefined) assertString(exercise.explanation, `${label}.explanation`);
  if (exercise.passingScore !== undefined) assertNumber(exercise.passingScore, `${label}.passingScore`, { min: 0, max: 100 });
}

function validateShotScenario(exercise, label) {
  validateScenarioCommon(exercise, label);
  validateShot(exercise.incomingShuttle, `${label}.incomingShuttle`);
  validateOpponentsMovement(exercise.opponentsMovement, `${label}.opponentsMovement`);
  assertNumber(exercise.playerReach, `${label}.playerReach`, { min: 0 });
}

function validatePositioningScenario(exercise, label) {
  validateScenarioCommon(exercise, label);
  validateShot(exercise.playedShuttle, `${label}.playedShuttle`);
  validateMovement(exercise.partnerMovement, `${label}.partnerMovement`);
  assertBoolean(exercise.isHitter, `${label}.isHitter`);
  assertNumber(exercise.moveRadius, `${label}.moveRadius`, { min: 0 });
  if (exercise.idealPosition !== undefined) validatePosition(exercise.idealPosition, `${label}.idealPosition`);
}

function validateExerciseCollection(exercises, label) {
  assertArray(exercises, label);
  if (exercises.length === 0) fail(`${label} must contain at least one scenario`);
  const byId = new Map();

  exercises.forEach((exercise, index) => {
    const itemLabel = `${label}[${index}]`;
    if (exercise?.type === 'shot') validateShotScenario(exercise, itemLabel);
    else if (exercise?.type === 'positioning') validatePositioningScenario(exercise, itemLabel);
    else validateScenarioCommon(exercise, itemLabel);

    if (byId.has(exercise.id)) {
      fail(`Duplicate scenario: ${exercise.id}`);
    }
    byId.set(exercise.id, exercise);
  });

  return byId;
}

function normalizeMatches(rawMatches) {
  if (Array.isArray(rawMatches)) return rawMatches;
  if (Array.isArray(rawMatches?.matches)) return rawMatches.matches;
  return [];
}

function validateTimePressure(timePressure, label) {
  if (timePressure === undefined || timePressure === null) return;
  assertObject(timePressure, label);
  if (timePressure.enabled !== undefined) assertBoolean(timePressure.enabled, `${label}.enabled`);
  if (timePressure.secondsPerTurn !== undefined && timePressure.secondsPerTurn !== null) {
    assertNumber(timePressure.secondsPerTurn, `${label}.secondsPerTurn`, { min: 1 });
  }
}

function validateRallyTurn(turn, index, matchLabel, exercisesById) {
  const label = `${matchLabel}.rally[${index}]`;
  assertObject(turn, label);
  assertString(turn.exerciseRef, `${label}.exerciseRef`);

  if (turn.turn !== undefined) {
    assertNumber(turn.turn, `${label}.turn`, { min: 1, integer: true });
  }
  if (turn.type !== undefined) {
    assertEnum(turn.type, EXERCISE_TYPES, `${label}.type`);
  }

  const exercise = exercisesById.get(turn.exerciseRef);
  if (!exercise) {
    fail(`${label}.exerciseRef references an unknown scenario: ${turn.exerciseRef}`);
  }
  if (turn.type && turn.type !== exercise.type) {
    fail(`${label}.type does not match scenario ${turn.exerciseRef}`);
  }
}

function validateMatches(matches, exercisesById, label) {
  assertArray(matches, label);
  if (matches.length === 0) fail(`${label} must contain at least one match`);
  const seenIds = new Set();

  matches.forEach((match, index) => {
    const matchLabel = `${label}[${index}]`;
    assertObject(match, matchLabel);
    assertString(match.id, `${matchLabel}.id`);
    assertString(match.workshop, `${matchLabel}.workshop`);
    assertString(match.title, `${matchLabel}.title`);
    assertArray(match.rally, `${matchLabel}.rally`);
    validateTimePressure(match.timePressure, `${matchLabel}.timePressure`);

    if (seenIds.has(match.id)) {
      fail(`Duplicate match: ${match.id}`);
    }
    seenIds.add(match.id);

    if (match.rally.length === 0) {
      fail(`${matchLabel}.rally must contain at least one turn`);
    }

    match.rally.forEach((turn, rallyIndex) => {
      validateRallyTurn(turn, rallyIndex, matchLabel, exercisesById);
    });
  });
}

function buildCatalog(exercises, matches, source) {
  const byId = new Map(exercises.map(exercise => [exercise.id, exercise]));
  const normalizedMatches = normalizeMatches(matches);

  return {
    source,
    exercisesById: byId,
    matches: normalizedMatches,
  };
}

function buildFallbackCatalog() {
  const fallbackExercises = MOCK_EXERCISES.map(exercise => ({ ...exercise }));
  const fallbackMatches = [
    {
      id: 'MATCH_ATTACK_FALLBACK',
      workshop: 'attack',
      title: 'Attack Workshop',
      rally: MOCK_RALLIES.attack.map((exercise, index) => ({
        turn: index + 1,
        type: exercise.type,
        exerciseRef: exercise.id,
      })),
      timePressure: { ...DEFAULT_TIME_PRESSURE },
    },
    {
      id: 'MATCH_DEFENSE_FALLBACK',
      workshop: 'defense',
      title: 'Defense Workshop',
      rally: MOCK_RALLIES.defense.map((exercise, index) => ({
        turn: index + 1,
        type: exercise.type,
        exerciseRef: exercise.id,
      })),
      timePressure: { ...DEFAULT_TIME_PRESSURE },
    },
    {
      id: 'MATCH_MVP_FALLBACK',
      workshop: 'match',
      title: 'Ranked Match MVP',
      opponentRank: 'D8',
      rally: [
        ...MOCK_RALLIES.attack.slice(0, 2),
        ...MOCK_RALLIES.defense.slice(0, 2),
      ].map((exercise, index) => ({
        turn: index + 1,
        type: exercise.type,
        exerciseRef: exercise.id,
      })),
      timePressure: { ...DEFAULT_TIME_PRESSURE },
    },
  ];

  return buildCatalog(fallbackExercises, fallbackMatches, 'mock');
}

function validateAndBuildCatalog(positioning, shots, rawMatches) {
  const exercises = [...positioning, ...shots];
  const exercisesById = validateExerciseCollection(exercises, 'scenarios');
  const matches = normalizeMatches(rawMatches);
  validateMatches(matches, exercisesById, 'matches');
  return buildCatalog(exercises, matches, 'data');
}

async function loadCatalogFromDataFiles() {
  const [positioning, shots, matches] = await Promise.all([
    fetchJson(DATA_FILES.positioning),
    fetchJson(DATA_FILES.shots),
    fetchJson(DATA_FILES.matches),
  ]);

  return validateAndBuildCatalog(positioning, shots, matches);
}

// ─── Dynamic scenario generation ──────────────────────────────────────────────

let _generator = null;
let _genEngines = null;

function getGenerator() {
  if (_generator) return _generator;
  const kinematic = new KinematicEngine();
  const tactical  = new TacticalEngine();
  const placement = new PlacementEngine(kinematic);
  const aiSpawn   = new AISpawnEngine(tactical, placement, kinematic);
  _genEngines = { kinematic, placement };
  _generator  = new ScenarioGenerator(tactical, placement, aiSpawn,kinematic);
  return _generator;
}

function shotSpeed(type) {
  return { SMASH: 'fast', KILL: 'fast', DRIVE: 'fast', CLEAR: 'medium', DROP: 'slow', NET_DROP: 'slow', NET_CLEAR: 'slow' }[type] ?? 'medium';
}

function shotInstructionText(type) {
  const map = {
    SMASH:    'The opponent smashes. Choose the best response.',
    CLEAR:    'The opponent lifts deep. Choose the best response.',
    DROP:     'The opponent plays a drop. Choose the best response.',
    DRIVE:    'The opponent drives flat. Choose the best response.',
    NET_DROP: 'The opponent net-drops. Choose the best response.',
  };
  return map[type] ?? 'Choose the best shot.';
}

function placementInstructionText(type) {
  const label = type.toLowerCase().replace('_', ' ');
  return `You just played a ${label}. Move to the best position.`;
}

function adaptTacticalScenario(gen, workshop, kinematic) {
  const { incoming, players } = gen;
  const { user, partner, opponents } = players;

  const positions = {
    player:  user.pos,
    partner: partner.pos,
    opp1:    opponents[0].posStart,
    opp2:    opponents[1].posStart,
  };

  const equipment = {
    player:  { hand: user.hand        ?? 'right' },
    partner: { hand: partner.hand     ?? 'right' },
    opp1:    { hand: opponents[0].hand ?? 'right' },
    opp2:    { hand: opponents[1].hand ?? 'right' },
  };

  const incomingShuttle = {
    type:     incoming.type,
    startPos: incoming.startPos,
    endPos:   incoming.endPos,
  };

  const playerReach = kinematic.shotPossibility(incoming.type).allowedReach;

  return {
    id:           `GEN-T-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type:         'shot',
    workshop,
    label:        'Tactical',
    text:         shotInstructionText(incoming.type),
    passingScore: 70,
    positions,
    equipment,
    incomingShuttle,
    playerReach,
    players: {
      ally1:     { ...toFullCourtAlly(user.pos), label: 'YOU' },
      ally2:     toFullCourtAlly(partner.pos),
      opponent1: { ...toFullCourtOpp(opponents[0].posStart), movingTo: toFullCourtOpp(opponents[0].posEnd) },
      opponent2: { ...toFullCourtOpp(opponents[1].posStart), movingTo: toFullCourtOpp(opponents[1].posEnd) },
    },
    shuttlecock: {
      position: toFullCourtAlly(user.pos),
      from:     toFullCourtOpp(incoming.startPos),
      type:     incoming.type,
      speed:    shotSpeed(incoming.type),
    },
  };
}

function adaptPlacementScenario(gen, workshop, kinematic, placement) {
  const { playerStart, shotPlayed, partnerStart, opponents, isUserStriker } = gen;

  const positions = {
    player:  playerStart,
    partner: partnerStart,
    opp1:    opponents[0].posStart,
    opp2:    opponents[1].posStart,
  };

  const equipment = {
    player:  { hand: 'right' },
    partner: { hand: 'right' },
    opp1:    { hand: opponents[0].hand ?? 'right' },
    opp2:    { hand: opponents[1].hand ?? 'right' },
  };

  const playedShuttle = {
    type:     shotPlayed.type,
    startPos: playerStart,
    endPos:   shotPlayed.endPos,
  };

  const partnerIdeal = placement.evaluateGlobalPlacement(
    partnerStart, playerStart,
    { type: shotPlayed.type, endPos: shotPlayed.endPos },
    false,
  ).ideal;

  const playerIdeal = placement.evaluateGlobalPlacement(
    playerStart, partnerStart,
    { type: shotPlayed.type, endPos: shotPlayed.endPos },
    isUserStriker,
  ).ideal;

  const partnerMovement = { from: partnerStart, to: partnerIdeal };
  const moveRadius = kinematic.movementPossibility(shotPlayed.type).allowedRadius;

  return {
    id:           `GEN-P-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type:         'positioning',
    workshop,
    label:        'Placement',
    text:         placementInstructionText(shotPlayed.type),
    passingScore: 70,
    positions,
    equipment,
    playedShuttle,
    partnerMovement,
    isHitter:     isUserStriker,
    moveRadius,
    idealPosition: playerIdeal,
    players: {
      ally1:     { ...toFullCourtAlly(playerStart), label: 'YOU' },
      ally2:     { ...toFullCourtAlly(partnerStart), movingTo: toFullCourtAlly(partnerIdeal) },
      opponent1: toFullCourtOpp(opponents[0].posStart),
      opponent2: toFullCourtOpp(opponents[1].posStart),
    },
    shuttlecock: {
      position: toFullCourtOpp(shotPlayed.endPos),
      from:     toFullCourtAlly(playerStart),
      type:     shotPlayed.type,
      speed:    shotSpeed(shotPlayed.type),
    },
  };
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function workshopTitle(workshop) {
  return { attack: 'Tactic Training', defense: 'Placement Training', match: 'Match Mode' }[workshop] ?? 'Training';
}

function generateWorkshopRally(workshop) {
  const gen = getGenerator();
  const { kinematic, placement } = _genEngines;

  // attack  = shot turns only   (Tactic Training)
  // defense = positioning turns only (Placement Training)
  // match   = alternating pairs of both
  const counts =
    workshop === 'attack'  ? { tactical: 10, placement: 0 } :
    workshop === 'defense' ? { tactical: 0,  placement: 10 } :
                             { tactical: 4,  placement: 4 };

  const exercises = [];

  for (let i = 0; i < counts.tactical; i++) {
    const raw = gen.generateTacticalScenario(Math.random() < 0.1 ? 'left' : 'right');
    if (raw) exercises.push(adaptTacticalScenario(raw, workshop, kinematic));
  }
  for (let i = 0; i < counts.placement; i++) {
    const raw = gen.generatePlacementScenario();
    if (raw) exercises.push(adaptPlacementScenario(raw, workshop, kinematic, placement));
  }

  // match: interleave tactical + placement for realistic rally flow
  if (workshop === 'match') {
    const tactical  = exercises.filter(e => e.type === 'shot');
    const posit     = exercises.filter(e => e.type === 'positioning');
    exercises.length = 0;
    for (let i = 0; i < Math.max(tactical.length, posit.length); i++) {
      if (tactical[i])  exercises.push(tactical[i]);
      if (posit[i])     exercises.push(posit[i]);
    }
  }

  const matchId = `${workshop}-${Date.now()}`;
  return exercises.map((ex, idx) => ({
    ...ex,
    turn:             idx + 1,
    matchId,
    matchTitle:       workshopTitle(workshop),
    opponentRank:     null,
    timeLimitMs:      null,
    timeLimitSeconds: null,
    timePressure:     { enabled: false },
  }));
}

export async function loadScenarioCatalog({ forceRefresh = false } = {}) {
  if (!catalogPromise || forceRefresh) {
    catalogPromise = (async () => {
      try {
        return await loadCatalogFromDataFiles();
      } catch (error) {
        if (error instanceof CatalogLoadError) {
          console.warn('exercises.js: falling back to local mocks', error);
          return buildFallbackCatalog();
        }
        catalogPromise = null;
        throw error;
      }
    })();
  }

  return catalogPromise;
}

export async function warmScenarioCatalog() {
  return loadScenarioCatalog();
}

async function loadWorkshopRallyFromCatalog(workshop) {
  const catalog = await loadScenarioCatalog();
  let match = catalog.matches.find(entry => entry.workshop === workshop);

  if (!match && workshop === 'match') {
    const mixedRally = catalog.matches
      .filter(entry => entry.workshop === 'attack' || entry.workshop === 'defense')
      .flatMap(entry => entry.rally)
      .slice(0, 4)
      .map((turn, index) => ({ ...turn, turn: index + 1 }));

    if (mixedRally.length > 0) {
      match = {
        id: 'MATCH_MIXED_FALLBACK',
        workshop: 'match',
        title: 'Ranked Match MVP',
        opponentRank: 'D8',
        rally: mixedRally,
        timePressure: { ...DEFAULT_TIME_PRESSURE },
      };
    }
  }

  if (!match) {
    throw new Error(`No rally defined for workshop "${workshop}"`);
  }

  return match.rally.map(turn => {
    const exercise = catalog.exercisesById.get(turn.exerciseRef);
    if (!exercise) {
      throw new Error(`Scenario not found: ${turn.exerciseRef}`);
    }

    return {
      ...exercise,
      type: turn.type ?? exercise.type,
      turn: turn.turn ?? null,
      matchId: match.id,
      matchTitle: match.title ?? null,
      opponentRank: match.opponentRank ?? null,
      timeLimitMs: turn.timeLimitMs ?? match.timeLimitMs ?? null,
      timeLimitSeconds: turn.timeLimitSeconds ?? match.timeLimitSeconds ?? null,
      timePressure: match.timePressure ?? { ...DEFAULT_TIME_PRESSURE },
    };
  });
}

export async function loadWorkshopRally(workshop) {
  try {
    return generateWorkshopRally(workshop);
  } catch (error) {
    console.warn('exercises.js: generator failed, falling back to JSON catalog', error);
    return loadWorkshopRallyFromCatalog(workshop);
  }
}
