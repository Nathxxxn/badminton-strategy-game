// Expects full-court coords (Y=0.5 = net). Do NOT call with Logic half-court coords.
export function deriveShuttleType(shot) {
  const { power, aimPoint } = shot;
  if (aimPoint.y >= 0.5) return 'NET_DROP';
  if (power < 0.25) return aimPoint.y < 0.15 ? 'NET_DROP' : 'DROP';
  if (power < 0.45) return 'DROP';
  if (power < 0.60) return 'DRIVE';
  if (power < 0.75) return 'KILL';
  if (power < 0.90) return 'SMASH';
  return 'CLEAR';
}

export function buildTacticalPayload(shot, turn) {
  const opp1      = turn.players?.opponent1 ?? null;
  const opp2      = turn.players?.opponent2 ?? null;
  const equipment = turn.equipment ?? {};
  const impact    = turn.shuttlecock?.position ?? null;

  return {
    shuttleType:  deriveShuttleType(shot),
    shuttleEndPos: { x: shot.aimPoint.x, y: shot.aimPoint.y },
    impactPoint:  impact ? { x: impact.x, y: impact.y } : null,
    opponentsPos: {
      opp1: opp1 ? { x: opp1.x, y: opp1.y } : null,
      opp2: opp2 ? { x: opp2.x, y: opp2.y } : null,
    },
    oppShotType: turn.shuttlecock?.type ?? turn.incomingShuttle?.type ?? null,
    oppHands: {
      opp1: equipment.opp1?.hand ?? null,
      opp2: equipment.opp2?.hand ?? null,
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
      type: shuttle.type,
    },
    isHitter: turn.isHitter ?? false,
  };
}
