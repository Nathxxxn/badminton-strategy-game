// Expects full-court coords (Y=0.5 = net). Do NOT call with Logic half-court coords.
export function deriveShuttleType(shot) {
  const { power, aimPoint } = shot;
  if (aimPoint.y >= 0.5) return 'NET_DROP';

  // Opponent half runs from y=0.0 (back court) to y=0.5 (net).
  // Depth therefore matters as much as raw drag power.
  if (aimPoint.y >= 0.34) {
    if (power >= 0.55) return 'KILL';
    if (power >= 0.30) return 'DROP';
    return 'NET_DROP';
  }

  if (aimPoint.y >= 0.17) {
    if (power >= 0.72) return 'SMASH';
    if (power >= 0.30) return 'DRIVE';
    return 'DROP';
  }

  if (power >= 0.90) return 'CLEAR';
  return 'DRIVE';
}

export function buildTacticalPayload(shot, turn, { forcedType = null } = {}) {
  const opp1      = turn.players?.opponent1 ?? null;
  const opp2      = turn.players?.opponent2 ?? null;
  const equipment = turn.equipment ?? {};
  const impact    = shot.impactPoint ?? turn.shuttlecock?.position ?? null;
  const opp1Hand  = equipment.opp1?.hand ?? equipment.opponent1?.hand ?? null;
  const opp2Hand  = equipment.opp2?.hand ?? equipment.opponent2?.hand ?? null;

  return {
    shuttleType:  forcedType ?? deriveShuttleType(shot),
    shuttleEndPos: { x: shot.aimPoint.x, y: shot.aimPoint.y },
    impactPoint:  impact ? { x: impact.x, y: impact.y } : null,
    opponentsPos: {
      opp1: opp1 ? { x: opp1.x, y: opp1.y } : null,
      opp2: opp2 ? { x: opp2.x, y: opp2.y } : null,
    },
    oppShotType: turn.shuttlecock?.type ?? turn.incomingShuttle?.type ?? null,
    oppHands: {
      opp1: opp1Hand,
      opp2: opp2Hand,
    },
  };
}

export function buildPlacementPayload(chosenPos, turn) {
  const ally2 = turn.players?.ally2 ?? null;
  const partnerRaw = ally2?.movingTo ?? ally2 ?? null;
  const shuttle = turn.shuttlecock;

  const origin   = shuttle.trajectory?.[0] ?? shuttle.position;
  const endpoint = shuttle.position;

  return {
    playerFinalPos:  { x: chosenPos.x, y: chosenPos.y },
    partnerFinalPos: partnerRaw ? { x: partnerRaw.x, y: partnerRaw.y } : null,
    playedShuttle: {
      startPos: origin   ? { x: origin.x,   y: origin.y   } : null,
      endPos:   endpoint ? { x: endpoint.x, y: endpoint.y } : null,
      type: turn.playedShuttle?.type ?? shuttle.type ?? turn.scenario?.playedShotType ?? null,
    },
    isHitter: turn.isHitter ?? false,
  };
}
