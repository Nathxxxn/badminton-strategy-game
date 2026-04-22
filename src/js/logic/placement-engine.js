import { COURT_WIDTH_M, HALF_COURT_LENGTH_M } from './kinematic-engine.js';

export class PlacementEngine {
  getIdealDefensePos(shuttleLand, isPlayerLeft) {
    const ideal = { x: 0, y: 0.5 };
    const centerDist = shuttleLand.x - 0.5;

    if (isPlayerLeft) {
      if (centerDist < 0) {
        const t = Math.abs(centerDist) / 0.4;
        ideal.x = Math.max(0.1, 0.25 - (t * 0.10));
      } else {
        const t = Math.abs(centerDist) / 0.4;
        ideal.x = Math.min(0.5, 0.25 + (t * 0.25));
      }
    } else if (centerDist > 0) {
      const t = Math.abs(centerDist) / 0.4;
      ideal.x = Math.min(0.90, 0.75 + (t * 0.10));
    } else {
      const t = Math.abs(centerDist) / 0.4;
      ideal.x = Math.max(0.5, 0.75 - (t * 0.25));
    }

    const isDiagonal = (shuttleLand.x < 0.5 && !isPlayerLeft)
      || (shuttleLand.x > 0.5 && isPlayerLeft);
    if (isDiagonal) {
      ideal.y = 0.5 - (0.65 / HALF_COURT_LENGTH_M);
    }

    return ideal;
  }

  getIdealKillPos(shuttleLand, isHitter) {
    const ideal = { x: 0.5, y: 0.3 };

    if (isHitter) {
      ideal.x = Math.max(0.2, Math.min(0.8, shuttleLand.x));
      ideal.y = 1.98 / HALF_COURT_LENGTH_M;
    } else {
      ideal.x = shuttleLand.x < 0.5
        ? Math.max(0.25, shuttleLand.x)
        : Math.min(0.75, shuttleLand.x);
      ideal.y = 4.5 / HALF_COURT_LENGTH_M;
    }

    return ideal;
  }

  getIdealDrivePos(shuttleLand, isHitter) {
    const ideal = { x: 0.5, y: 0.5 };

    if (isHitter) {
      ideal.x = Math.max(0.2, Math.min(0.8, shuttleLand.x));
      ideal.y = 3.75 / HALF_COURT_LENGTH_M;
    } else {
      const isCentralDrive = Math.abs(shuttleLand.x - 0.5) < 0.2;
      if (isCentralDrive) {
        ideal.x = shuttleLand.x;
        ideal.y = 1.75 / HALF_COURT_LENGTH_M;
      } else {
        const towardCenter = shuttleLand.x < 0.5
          ? -(Math.min(0.15, 0.3 - shuttleLand.x))
          : Math.min(0.15, shuttleLand.x - 0.7);
        ideal.x = 0.5 + towardCenter;
        ideal.y = 2.25 / HALF_COURT_LENGTH_M;
      }
    }

    return ideal;
  }

  getIdealSmashPos(shuttleLand, isHitter) {
    const ideal = { x: 0.5, y: 0.5 };

    if (isHitter) {
      ideal.x = 0.5 + (shuttleLand.x < 0.5 ? -0.125 : 0.125);
      ideal.y = 4.5 / HALF_COURT_LENGTH_M;
    } else {
      ideal.x = Math.max(0.15, Math.min(0.85, shuttleLand.x));
      ideal.y = 2.98 / HALF_COURT_LENGTH_M;
    }

    return ideal;
  }

  getIdealDropPos(shuttleLand, isHitter) {
    const ideal = { x: 0.5, y: 0.5 };

    if (isHitter) {
      ideal.x = 0.5 + (shuttleLand.x < 0.5 ? -0.125 : 0.125);
      ideal.y = 4.0 / HALF_COURT_LENGTH_M;
    } else {
      ideal.x = Math.max(0.2, Math.min(0.8, shuttleLand.x));
      ideal.y = 1.98 / HALF_COURT_LENGTH_M;
    }

    return ideal;
  }

  getIdealNetDropPos(shuttleLand, isHitter) {
    const ideal = { x: 0.5, y: 0.5 };

    if (isHitter) {
      const shiftTowardCenter = shuttleLand.x < 0.5 ? 0.08 : -0.08;
      ideal.x = Math.max(0.15, Math.min(0.85, shuttleLand.x + shiftTowardCenter));
      ideal.y = 1.70 / HALF_COURT_LENGTH_M;
    } else {
      const isExcentric = Math.abs(shuttleLand.x - 0.5) > 0.25;
      ideal.x = isExcentric
        ? 0.5 + (shuttleLand.x < 0.5 ? -0.1 : 0.1)
        : 0.5;
      ideal.y = 4.70 / HALF_COURT_LENGTH_M;
    }

    return ideal;
  }

  calculateDistMeters(pos1, pos2) {
    const dx = (pos1.x - pos2.x) * COURT_WIDTH_M;
    const dy = (pos1.y - pos2.y) * HALF_COURT_LENGTH_M;
    return Math.hypot(dx, dy);
  }

  calculateFormationScore(currentPos, idealPos, toleranceX, toleranceY) {
    const dx = Math.abs(currentPos.x - idealPos.x) * COURT_WIDTH_M;
    const dy = Math.abs(currentPos.y - idealPos.y) * HALF_COURT_LENGTH_M;

    if (dx <= toleranceX && dy <= toleranceY) return 100;

    const errX = Math.max(0, dx - toleranceX);
    const errY = Math.max(0, dy - toleranceY);
    const totalError = Math.hypot(errX, errY);

    return Math.max(0, Math.round(100 - (totalError * 30)));
  }

  getPartnerDistanceScore(playerPos, partnerPos) {
    const distance = this.calculateDistMeters(playerPos, partnerPos);

    if (distance < 1.7) return 0;
    if (distance < 2.5) {
      const t = (distance - 1.7) / 0.8;
      return Math.round(t * 100);
    }
    if (distance <= 3.5) return 100;
    if (distance <= 6.0) {
      const t = (distance - 3.5) / 2.5;
      return Math.round(100 - (t * 100));
    }

    return 0;
  }

  evaluateGlobalPlacement(playerPos, partnerPos, shotContext, isHitter) {
    const partnerScore = this.getPartnerDistanceScore(playerPos, partnerPos);
    const shotType = shotContext.type;
    const shuttleEndPos = shotContext.endPos;

    let idealPos;
    const isPlayerLeft = playerPos.x < partnerPos.x;

    switch (shotType) {
      case 'CLEAR':
        idealPos = this.getIdealDefensePos(shuttleEndPos, isPlayerLeft);
        break;
      case 'KILL':
        idealPos = this.getIdealKillPos(shuttleEndPos, isHitter);
        break;
      case 'DRIVE':
        idealPos = this.getIdealDrivePos(shuttleEndPos, isHitter);
        break;
      case 'SMASH':
        idealPos = this.getIdealSmashPos(shuttleEndPos, isHitter);
        break;
      case 'DROP':
        idealPos = this.getIdealDropPos(shuttleEndPos, isHitter);
        break;
      case 'NET_DROP':
        idealPos = this.getIdealNetDropPos(shuttleEndPos, isHitter);
        break;
      default:
        idealPos = { x: 0.5, y: 0.5 };
    }

    let tolX = 0.5;
    let tolY = 1.0;

    if (shotType === 'KILL' || shotType === 'DRIVE') {
      tolX = 0.4;
      tolY = 0.6;
    }

    if (shotType === 'SMASH' || shotType === 'DROP') {
      tolX = 1.0;
      tolY = 0.5;
    }

    const formationScore = this.calculateFormationScore(playerPos, idealPos, tolX, tolY);
    const finalScore = (partnerScore * 0.3) + (formationScore * 0.7);

    return {
      total: Math.round(finalScore),
      breakdown: {
        partner: partnerScore,
        formation: formationScore,
      },
      realDistance: Number(this.calculateDistMeters(playerPos, partnerPos).toFixed(2)),
      ideal: {
        x: idealPos.x,
        y: idealPos.y,
      },
    };
  }
}
