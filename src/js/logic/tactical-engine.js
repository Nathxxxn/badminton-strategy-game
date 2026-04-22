import { COURT_WIDTH_M, HALF_COURT_LENGTH_M, SHOT_PROFILES } from './kinematic-engine.js';

export class TacticalEngine {
  evaluateSituation(incoming, user, opponents) {
    const rules = SHOT_PROFILES[user.type];
    const incomingRules = SHOT_PROFILES[incoming.type];

    if (!rules || !incomingRules) {
      return {
        type: user.type ?? null,
        score: 0,
        message: 'Type de coup inconnu',
        isReversTargeted: false,
        isBodyHit: false,
        isTooClose: false,
        isTooShort: false,
        reachMeters: null,
        details: { placement: 0, bonus: 0 },
      };
    }

    if (user.endPos.x < 0 || user.endPos.x > 1 || user.endPos.y < 0 || user.endPos.y > 1) {
      return {
        type: user.type,
        score: 0,
        message: 'OUT !',
        isReversTargeted: false,
        isBodyHit: false,
        isTooClose: false,
        isTooShort: false,
        reachMeters: rules.reach,
        details: { placement: 0, bonus: 0 },
      };
    }

    if (!incomingRules.allowed.includes(user.type)) {
      return {
        type: user.type,
        score: 0,
        message: 'Type de coup invalide',
        isReversTargeted: false,
        isBodyHit: false,
        isTooClose: false,
        isTooShort: false,
        reachMeters: rules.reach,
        details: { placement: 0, bonus: 0 },
      };
    }

    let minDistanceMeters = Infinity;
    let targetOpponent = null;

    opponents.forEach(opp => {
      const dx = (user.endPos.x - opp.x) * COURT_WIDTH_M;
      const dy = (user.endPos.y - opp.y) * HALF_COURT_LENGTH_M;
      const dist = Math.hypot(dx, dy);
      if (dist < minDistanceMeters) {
        minDistanceMeters = dist;
        targetOpponent = opp;
      }
    });

    if (!targetOpponent) {
      return {
        type: user.type,
        score: 0,
        message: 'Aucun adversaire fourni',
        isReversTargeted: false,
        isBodyHit: false,
        isTooClose: false,
        isTooShort: false,
        reachMeters: rules.reach,
        details: { placement: 0, bonus: 0 },
      };
    }

    const distanceScore = Math.min(90, (minDistanceMeters / 4.0) * 90);
    let totalScore = 0;
    let hittingBody = false;
    let tooClose = false;
    let tooShort = false;

    if (user.type === 'KILL') {
      totalScore = 75 + (distanceScore / 90) * 15 + 10;
    } else if (user.type === 'SMASH') {
      totalScore = 60 + (distanceScore / 90) * 30 + rules.bonus;
    } else if (user.type === 'DROP') {
      totalScore = 45 + (distanceScore / 90) * 45 + rules.bonus;
    } else {
      totalScore = distanceScore + rules.bonus;
    }

    const isRightSide = user.endPos.x > targetOpponent.x;
    const isRevers = (targetOpponent.hand === 'right' && !isRightSide)
      || (targetOpponent.hand === 'left' && isRightSide);

    if (user.type === 'SMASH' || user.type === 'KILL') {
      const dxMeters = (user.endPos.x - targetOpponent.x) * COURT_WIDTH_M;
      const dyMeters = (user.endPos.y - targetOpponent.y) * HALF_COURT_LENGTH_M;
      const handBias = targetOpponent.hand === 'right' ? 0.3 : -0.3;
      const distToForehand = Math.abs(dxMeters - handBias);
      if (distToForehand < 0.5 && Math.abs(dyMeters) < 0.5) {
        totalScore += 10;
        hittingBody = true;
      }
    }

    if (user.type === 'CLEAR') {
      if (isRevers) totalScore += 5;
      if (minDistanceMeters < 2.0) {
        totalScore -= 20;
        tooClose = true;
      }
      if (user.endPos.y < (5.0 / HALF_COURT_LENGTH_M)) {
        totalScore -= 20;
        tooShort = true;
      }
    }

    const threshold = user.type === 'CLEAR' ? 85 : 80;
    if (totalScore >= threshold) {
      totalScore = Math.max(totalScore, distanceScore + 10);
    }

    return {
      type: user.type,
      score: Math.min(100, Math.max(0, Math.round(totalScore))),
      isReversTargeted: isRevers,
      isBodyHit: hittingBody,
      isTooClose: tooClose,
      isTooShort: tooShort,
      reachMeters: rules.reach,
      details: {
        placement: Math.round(distanceScore),
        bonus: Math.round(totalScore - distanceScore),
      },
    };
  }

  findBestShotExhaustive(incoming, opponents) {
    const shotTypes = Object.keys(SHOT_PROFILES);
    let best = { score: -1, type: '', endPos: { x: 0.5, y: 0.5 } };

    const stepX = 0.5 / COURT_WIDTH_M;
    const stepY = 0.5 / HALF_COURT_LENGTH_M;

    shotTypes.forEach(type => {
      if (!SHOT_PROFILES[incoming.type]?.allowed.includes(type)) return;

      for (let x = 0.05; x <= 0.95; x += stepX) {
        for (let y = 0.05; y <= 0.95; y += stepY) {
          const res = this.evaluateSituation(incoming, { type, endPos: { x, y } }, opponents);
          if (res.score > best.score) {
            best = { score: res.score, type, endPos: { x, y }, details: res };
          }
        }
      }
    });

    return best;
  }

  getCompleteAnalysis(incoming, user, opponents) {
    const playerAnalysis = this.evaluateSituation(incoming, user, opponents);
    const bestPossible = this.findBestShotExhaustive(incoming, opponents);

    return {
      player: playerAnalysis,
      best: {
        type: bestPossible.type,
        endPos: bestPossible.endPos,
        score: bestPossible.score,
        message: `Le meilleur coup était un ${bestPossible.type}`,
      },
    };
  }
}
