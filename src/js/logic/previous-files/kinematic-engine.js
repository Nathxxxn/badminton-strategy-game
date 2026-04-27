const COURT_WIDTH_M = 6.10;
const HALF_COURT_LENGTH_M = 6.70;
const FULL_COURT_LENGTH_M = 13.40;

const SHOT_PROFILES = {
  SMASH:    { id: 'SMASH', bonus: 10, reach: 2.0, allowed: ['NET_DROP', 'DRIVE', 'CLEAR'] },
  KILL:     { id: 'KILL', bonus: 10, reach: 0.5, allowed: ['NET_DROP'] },
  DRIVE:    { id: 'DRIVE', bonus: 3,  reach: 2.5, allowed: ['NET_DROP', 'DRIVE', 'CLEAR', 'DROP'] },
  DROP:     { id: 'DROP', bonus: 7,  reach: 3.5, allowed: ['NET_DROP', 'DRIVE', 'CLEAR'] },
  NET_DROP: { id: 'NET_DROP', bonus: 4,  reach: 2.0, allowed: ['CLEAR', 'NET_DROP', 'DRIVE', 'KILL'] },
  CLEAR:    { id: 'CLEAR', bonus: 0,  reach: 5.0, allowed: ['SMASH', 'KILL', 'DROP', 'DRIVE', 'CLEAR', 'NET_DROP'] },
};

const MOVE_RADII = {
  SMASH: 1.5,
  KILL: 0.8,
  DRIVE: 2.0,
  DROP: 3.5,
  NET_DROP: 2.5,
  CLEAR: 3.0,
};

export {
  COURT_WIDTH_M,
  HALF_COURT_LENGTH_M,
  FULL_COURT_LENGTH_M,
  MOVE_RADII,
  SHOT_PROFILES,
};

export class KinematicEngine {
  getTraveledDistance(startPos, endPos, courtLengthMetres = HALF_COURT_LENGTH_M) {
    const dx = (endPos.x - startPos.x) * COURT_WIDTH_M;
    const dy = (endPos.y - startPos.y) * courtLengthMetres;
    return Math.hypot(dx, dy);
  }

  getShotCapabilities(shotType) {
    const profile = SHOT_PROFILES[shotType] ?? SHOT_PROFILES.DRIVE;
    return {
      allowedReach: profile.reach,
      allowedShots: [...profile.allowed],
    };
  }

  isShotAllowed(incomingShotType, replyShotType) {
    const incoming = SHOT_PROFILES[incomingShotType] ?? SHOT_PROFILES.DRIVE;
    return incoming.allowed.includes(replyShotType);
  }

  getMovementRadius(shotType) {
    return MOVE_RADII[shotType] ?? 2.0;
  }
}
