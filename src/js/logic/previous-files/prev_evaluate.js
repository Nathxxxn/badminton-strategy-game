import {
  COURT_WIDTH_M,
  HALF_COURT_LENGTH_M,
  KinematicEngine,
  SHOT_PROFILES,
} from './logic/previous-files/kinematic-engine.js';
import { PlacementEngine } from './logic/previous-files/placement-engine.js';
import { TacticalEngine } from './logic/previous-files/tactical-engine.js';
import { FeedbackEngine } from './logic/previous-files/feedback-engine.js';
import {
  adaptExercise,
  toFullCourtAlly,
  toFullCourtOpp,
  toLogicPos,
} from './coord-adapter.js';

const DEFAULT_PASSING_SCORE = 70;
const DEFAULT_HAND = 'right';

const tacticalEngine = new TacticalEngine();
const placementEngine = new PlacementEngine();
const kinematicEngine = new KinematicEngine();
const feedbackEngine = new FeedbackEngine();

function cloneHandSpec(spec = {}) {
  return { hand: spec.hand ?? DEFAULT_HAND };
}

function normalizeEquipment(input = {}, fallback = {}) {
  const mapped = {
    player: cloneHandSpec(input.player ?? input.ally1 ?? fallback.player ?? fallback.ally1),
    partner: cloneHandSpec(input.partner ?? input.ally2 ?? fallback.partner ?? fallback.ally2),
    opp1: cloneHandSpec(input.opp1 ?? input.opponent1 ?? fallback.opp1 ?? fallback.opponent1),
    opp2: cloneHandSpec(input.opp2 ?? input.opponent2 ?? fallback.opp2 ?? fallback.opponent2),
  };

  return mapped;
}

function deriveLogicPositions(players = {}) {
  return {
    player: players.ally1 ? toLogicPos(players.ally1, 'ally') : undefined,
    partner: players.ally2 ? toLogicPos(players.ally2, 'ally') : undefined,
    opp1: players.opponent1 ? toLogicPos(players.opponent1, 'opponent') : undefined,
    opp2: players.opponent2 ? toLogicPos(players.opponent2, 'opponent') : undefined,
  };
}

function deriveIncomingShuttle(turn, incomingShotType) {
  if (!turn.shuttlecock?.position) return null;

  const fallbackStart = turn.shuttlecock.from ?? {
    x: turn.shuttlecock.position.x,
    y: Math.max(0.05, turn.shuttlecock.position.y - 0.18),
  };

  return {
    startPos: toLogicPos(fallbackStart, 'opponent'),
    endPos: toLogicPos(turn.shuttlecock.position, 'ally'),
    type: incomingShotType,
  };
}

function derivePlayedShuttle(turn, playedShotType, isHitter) {
  if (!turn.shuttlecock?.position || !turn.players?.ally1) return null;

  const hitter = isHitter
    ? turn.players.ally1
    : (turn.players.ally2 ?? turn.players.ally1);

  return {
    startPos: toLogicPos(hitter, 'ally'),
    endPos: toLogicPos(turn.shuttlecock.position, 'opponent'),
    type: playedShotType,
  };
}

function derivePartnerMovement(turn) {
  const from = turn.players?.ally2;
  const to = turn.players?.ally2?.movingTo;
  if (!from || !to) return null;

  return {
    from: toLogicPos(from, 'ally'),
    to: toLogicPos(to, 'ally'),
  };
}

function metricDistanceHalfCourt(a, b) {
  const dx = (a.x - b.x) * COURT_WIDTH_M;
  const dy = (a.y - b.y) * HALF_COURT_LENGTH_M;
  return Math.hypot(dx, dy);
}

function inferPlacementContext(turn, positions) {
  if (!turn.shuttlecock?.position || !positions.player || !positions.partner || !turn.optimalPosition) {
    return { playedShotType: 'DRIVE', isHitter: false };
  }

  const shuttleEndPos = toLogicPos(turn.shuttlecock.position, 'opponent');
  const targetIdeal = toLogicPos(turn.optimalPosition, 'ally');

  let best = { score: Infinity, playedShotType: 'DRIVE', isHitter: false };

  Object.keys(SHOT_PROFILES).forEach(shotType => {
    [false, true].forEach(isHitter => {
      const result = placementEngine.evaluateGlobalPlacement(
        positions.player,
        positions.partner,
        { type: shotType, endPos: shuttleEndPos },
        isHitter,
      );

      const dist = metricDistanceHalfCourt(result.ideal, targetIdeal);
      if (dist < best.score) {
        best = { score: dist, playedShotType: shotType, isHitter };
      }
    });
  });

  return best;
}

function ensureRenderTurn(rawTurn) {
  if (rawTurn.players && rawTurn.shuttlecock) return { ...rawTurn };
  if (rawTurn.positions) return adaptExercise(rawTurn);
  return { ...rawTurn };
}

export function prepareTurnForRuntime(rawTurn) {
  const source = ensureRenderTurn(rawTurn);
  const turn = typeof structuredClone === 'function'
    ? structuredClone(source)
    : JSON.parse(JSON.stringify(source));
  const scenario = turn.scenario ?? {};
  const positions = turn.positions ?? deriveLogicPositions(turn.players);
  const equipment = normalizeEquipment(turn.equipment, scenario.equipment);
  const prepared = {
    ...turn,
    positions,
    equipment,
    passingScore: turn.passingScore ?? DEFAULT_PASSING_SCORE,
  };

  if (prepared.type === 'shot') {
    const incomingShotType = prepared.incomingShuttle?.type ?? scenario.incomingShotType ?? 'DRIVE';
    const incomingShuttle = prepared.incomingShuttle ?? deriveIncomingShuttle(prepared, incomingShotType);
    const shotCaps = kinematicEngine.getShotCapabilities(incomingShotType);

    return {
      ...prepared,
      label: prepared.label ?? 'Shot',
      incomingShuttle,
      playerReach: prepared.playerReach ?? shotCaps.allowedReach,
    };
  }

  if (prepared.type === 'positioning') {
    const inferred = inferPlacementContext(prepared, positions);
    const playedShotType = prepared.playedShuttle?.type
      ?? scenario.playedShotType
      ?? inferred.playedShotType;
    const isHitter = prepared.isHitter ?? scenario.isHitter ?? inferred.isHitter;
    const playedShuttle = prepared.playedShuttle ?? derivePlayedShuttle(prepared, playedShotType, isHitter);
    const partnerMovement = prepared.partnerMovement ?? derivePartnerMovement(prepared);

    return {
      ...prepared,
      label: prepared.label ?? 'Positioning',
      playedShuttle,
      partnerMovement,
      isHitter,
      moveRadius: prepared.moveRadius ?? scenario.moveRadius ?? kinematicEngine.getMovementRadius(playedShotType),
    };
  }

  return prepared;
}

export function evaluateTacticalTurn(turn, logicPayload) {
  const incoming = turn.incomingShuttle ?? { type: logicPayload.oppShotType ?? 'DRIVE' };
  const user = {
    type: logicPayload.shuttleType,
    endPos: logicPayload.shuttleEndPos,
  };
  const opponents = [
    logicPayload.opponentsPos?.opp1 ? { ...logicPayload.opponentsPos.opp1, hand: logicPayload.oppHands?.opp1 ?? DEFAULT_HAND } : null,
    logicPayload.opponentsPos?.opp2 ? { ...logicPayload.opponentsPos.opp2, hand: logicPayload.oppHands?.opp2 ?? DEFAULT_HAND } : null,
  ].filter(Boolean);

  const analysis = tacticalEngine.getCompleteAnalysis(incoming, user, opponents);
  const feedback = feedbackEngine.getTacticalFeedback(analysis);

  return {
    ...feedback,
    correctionRenderPos: feedback.correction?.endPos ? toFullCourtOpp(feedback.correction.endPos) : null,
    flags: {
      isBackhandTargeted: analysis.player.isReversTargeted,
      isBodyHit: analysis.player.isBodyHit,
      isTooClose: analysis.player.isTooClose,
      isTooShort: analysis.player.isTooShort,
    },
  };
}

export function evaluatePlacementTurn(turn, logicPayload) {
  const result = placementEngine.evaluateGlobalPlacement(
    logicPayload.playerFinalPos,
    logicPayload.partnerFinalPos,
    logicPayload.playedShuttle,
    logicPayload.isHitter ?? false,
  );
  const feedback = feedbackEngine.getPlacementFeedback(result);
  const realDistance = feedback.details.realDistance;

  return {
    ...feedback,
    idealPositionRender: feedback.idealPosition ? toFullCourtAlly(feedback.idealPosition) : null,
    flags: {
      isTooClose: realDistance < 2.5,
      isTooFar: realDistance > 3.5,
    },
  };
}

export function getMoveRadiusForShot(shotType) {
  return kinematicEngine.getMovementRadius(shotType);
}
