/**
 * coord-adapter.js — Coordinate system translation layer
 * Developer A · Rendering & UI
 *
 * Translates between Developer B's (Logic) half-court coordinate system
 * and Developer A's (Renderer) full-court coordinate system.
 *
 * ── COORDINATE SYSTEMS ────────────────────────────────────────────────────────
 *
 *  Logic (half-court, per active player):
 *    x: 0.0 = left sideline → 1.0 = right sideline
 *    y: 0.0 = net           → 1.0 = own back boundary
 *
 *  Renderer (full-court):
 *    x: 0.0 = left sideline  → 1.0 = right sideline  (same axis)
 *    y: 0.0 = opponent back  → 0.5 = net              → 1.0 = ally back
 *
 * ── SIDE CONVENTIONS ─────────────────────────────────────────────────────────
 *
 *  Ally (player) side   → bottom half of full court → y ∈ [0.5, 1.0]
 *  Opponent side        → top half of full court    → y ∈ [0.0, 0.5]
 *
 *  incomingShuttle:
 *    startPos — originates from opponent side → full-court y = 0.5 - (logicY × 0.5)
 *    endPos   — lands on ally side            → full-court y = 0.5 + (logicY × 0.5)
 *
 *  playedShuttle:
 *    startPos — originates from ally side     → full-court y = 0.5 + (logicY × 0.5)
 *    endPos   — lands on opponent side        → full-court y = 0.5 - (logicY × 0.5)
 *
 * ── USAGE ─────────────────────────────────────────────────────────────────────
 *
 *  import { adaptExercise, toLogicPos, toFullCourtAlly, toFullCourtOpp } from './coord-adapter.js';
 *
 *  // Adapt a full exercise object received from Developer B's Logic engine:
 *  const renderReady = adaptExercise(logicExercise);
 *
 *  // Convert individual positions:
 *  const fullCourtPos = toFullCourtAlly({ x: 0.5, y: 0.3 });  // ally half
 *  const fullCourtPos = toFullCourtOpp({ x: 0.5, y: 0.3 });   // opponent half
 *  const logicPos     = toLogicPos({ x: 0.5, y: 0.75 }, 'ally');
 */

// ─── Single-point converters ──────────────────────────────────────────────────

/**
 * Convert a Logic half-court position (ally perspective) to a Renderer
 * full-court position. The result lands in the ally (bottom) half.
 *
 * @param {{ x: number, y: number }} pos  Logic coords — y: 0=net, 1=ally back
 * @returns {{ x: number, y: number }}    Full-court coords
 */
export function toFullCourtAlly(pos) {
  return {
    x: pos.x,
    y: 0.5 + pos.y * 0.5,
  };
}

/**
 * Convert a Logic half-court position (opponent perspective) to a Renderer
 * full-court position. The result lands in the opponent (top) half.
 *
 * @param {{ x: number, y: number }} pos  Logic coords — y: 0=net, 1=opp back
 * @returns {{ x: number, y: number }}    Full-court coords
 */
export function toFullCourtOpp(pos) {
  return {
    x: pos.x,
    y: 0.5 - pos.y * 0.5,
  };
}

/**
 * Convert a Renderer full-court position back to a Logic half-court position.
 *
 * @param {{ x: number, y: number }} pos   Full-court coords
 * @param {'ally'|'opponent'}        side  Which player's perspective
 * @returns {{ x: number, y: number }}     Logic coords
 */
export function toLogicPos(pos, side) {
  if (!pos) return undefined;
  if (side === 'ally') {
    return { x: pos.x, y: (pos.y - 0.5) / 0.5 };
  }
  return { x: pos.x, y: (0.5 - pos.y) / 0.5 };
}

// ─── Payload converter (UI → Logic) ──────────────────────────────────────────

export function payloadToLogic(uiPayload) {
  const result = { ...uiPayload };
  // Only convert if aim is in opponent half (y < 0.5); clamp to net otherwise
  if (uiPayload.shuttleEndPos) {
    const sep = uiPayload.shuttleEndPos;
    const clamped = sep.y < 0.5 ? sep : { x: sep.x, y: 0.499 };
    result.shuttleEndPos = toLogicPos(clamped, 'opponent');
  }
  if (uiPayload.impactPoint)     result.impactPoint     = toLogicPos(uiPayload.impactPoint,     'ally');
  if (uiPayload.playerFinalPos)  result.playerFinalPos  = toLogicPos(uiPayload.playerFinalPos,  'ally');
  if (uiPayload.partnerFinalPos) result.partnerFinalPos = toLogicPos(uiPayload.partnerFinalPos, 'ally');
  return result;
}

// ─── Shuttle converters ───────────────────────────────────────────────────────

/**
 * Convert an incomingShuttle object (Logic) to Renderer full-court coords.
 *
 * incomingShuttle travels from the opponent side to the ally side:
 *   startPos → opponent half  (full y = 0.5 - logicY × 0.5)
 *   endPos   → ally half      (full y = 0.5 + logicY × 0.5)
 *
 * @param {{ startPos: {x:number,y:number}, endPos: {x:number,y:number}, type?: string }} shuttle
 * @returns {{ from: {x:number,y:number}, position: {x:number,y:number}, trajectory: Array<{x:number,y:number}>, type?: string }}
 */
export function adaptIncomingShuttle(shuttle) {
  const from     = toFullCourtOpp(shuttle.startPos);
  const position = toFullCourtAlly(shuttle.endPos);
  return {
    from,
    position,
    trajectory: [from, position],
    ...(shuttle.type !== undefined && { type: shuttle.type }),
  };
}

/**
 * Convert a playedShuttle object (Logic) to Renderer full-court coords.
 *
 * playedShuttle travels from the ally side to the opponent side:
 *   startPos → ally half      (full y = 0.5 + logicY × 0.5)
 *   endPos   → opponent half  (full y = 0.5 - logicY × 0.5)
 *
 * @param {{ startPos: {x:number,y:number}, endPos: {x:number,y:number}, type?: string }} shuttle
 * @returns {{ from: {x:number,y:number}, position: {x:number,y:number}, trajectory: Array<{x:number,y:number}>, type?: string }}
 */
export function adaptPlayedShuttle(shuttle) {
  const from     = toFullCourtAlly(shuttle.startPos);
  const position = toFullCourtOpp(shuttle.endPos);
  return {
    from,
    position,
    trajectory: [from, position],
    ...(shuttle.type !== undefined && { type: shuttle.type }),
  };
}

// ─── Player position converters ───────────────────────────────────────────────

/**
 * Convert a Logic positions object (player, partner, opp1, opp2) to the
 * Renderer's `players` format (ally1, ally2, opponent1, opponent2).
 *
 * Logic provides positions from the active player's perspective, so all
 * ally coords use toFullCourtAlly and all opponent coords use toFullCourtOpp.
 * movingTo is forwarded unchanged if present (same coordinate space).
 *
 * @param {{ player: {x:number,y:number,movingTo?:object}, partner: {x:number,y:number,movingTo?:object}, opp1: {x:number,y:number,movingTo?:object}, opp2: {x:number,y:number,movingTo?:object} }} positions
 * @returns {{ ally1: object, ally2: object, opponent1: object, opponent2: object }}
 */
export function adaptPositions(positions) {
  return {
    ally1:     _adaptPlayerPos(positions.player,  toFullCourtAlly),
    ally2:     _adaptPlayerPos(positions.partner, toFullCourtAlly),
    opponent1: _adaptPlayerPos(positions.opp1,    toFullCourtOpp),
    opponent2: _adaptPlayerPos(positions.opp2,    toFullCourtOpp),
  };
}

/**
 * @param {{ x:number, y:number, movingTo?: {x:number,y:number}, label?: string }} entry
 * @param {function} convertFn  toFullCourtAlly or toFullCourtOpp
 * @returns {object}
 */
function _adaptPlayerPos(entry, convertFn) {
  if (!entry) return undefined;
  const converted = convertFn({ x: entry.x, y: entry.y });
  const result = { ...converted };
  if (entry.label !== undefined) result.label = entry.label;
  if (entry.movingTo !== undefined) result.movingTo = convertFn(entry.movingTo);
  return result;
}

// ─── Full exercise adapter ────────────────────────────────────────────────────

/**
 * Adapt a complete Logic exercise object into the shape expected by
 * Developer A's Renderer, main.js, and zone evaluation.
 *
 * Handles both exercise types:
 *   - 'shot'        → has `incomingShuttle`; shuttle arrives on ally side
 *   - 'positioning' → has `playedShuttle`;   shuttle shown as already landed
 *
 * Fields that Developer A doesn't use yet (e.g. `equipment`, `playerReach`,
 * `isHitter`) are passed through as-is for forward compatibility.
 *
 * @param {object} logicExercise  Raw exercise from Developer B's Logic engine
 * @returns {object}              Render-ready exercise object
 */
export function adaptExercise(logicExercise) {
  const { type, positions, incomingShuttle, playedShuttle, partnerMovement, idealPosition, correction, ...rest } = logicExercise;

  const adaptedPlayers = positions ? adaptPositions(positions) : undefined;

  let adaptedShuttlecock;
  if (type === 'shot' && incomingShuttle) {
    adaptedShuttlecock = adaptIncomingShuttle(incomingShuttle);
  } else if (type === 'positioning' && playedShuttle) {
    adaptedShuttlecock = adaptPlayedShuttle(playedShuttle);
  } else if (type !== 'shot' && type !== 'positioning') {
    console.warn(`coord-adapter: unknown exercise type "${type}" — shuttlecock not converted`);
  }

  let adaptedPartnerMovement;
  if (partnerMovement) {
    adaptedPartnerMovement = {
      ...partnerMovement,
      from: toFullCourtAlly(partnerMovement.from),
      to:   toFullCourtAlly(partnerMovement.to),
    };
  }

  const adaptedIdealPosition = idealPosition ? toFullCourtAlly(idealPosition) : undefined;

  let adaptedCorrection;
  if (correction) {
    adaptedCorrection = {
      ...correction,
      ...(correction.endPos && { endPos: toFullCourtOpp(correction.endPos) }),
    };
  }

  return {
    type,
    ...(adaptedPlayers         !== undefined && { players:         adaptedPlayers }),
    ...(adaptedShuttlecock     !== undefined && { shuttlecock:     adaptedShuttlecock }),
    ...(adaptedPartnerMovement !== undefined && { partnerMovement: adaptedPartnerMovement }),
    ...(adaptedIdealPosition   !== undefined && { idealPosition:   adaptedIdealPosition }),
    ...(adaptedCorrection      !== undefined && { correction:      adaptedCorrection }),
    ...rest,
  };
}
