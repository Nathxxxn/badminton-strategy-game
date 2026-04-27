export class FeedbackEngine {
  getPlacementFeedback(results) {
    let partnerMessage = '';

    if (results.realDistance < 2.5) {
      partnerMessage = 'Careful, you are too close to your partner!';
    } else if (results.realDistance > 3.5) {
      partnerMessage = 'Careful, you are too far from your partner!';
    }

    return {
      totalScore: results.total,
      idealPosition: results.ideal,
      message: partnerMessage,
      details: {
        breakdown: results.breakdown,
        realDistance: results.realDistance,
      },
    };
  }

  getTacticalFeedback(analysis) {
    const player = analysis.player;
    const best = analysis.best;
    const messages = [];

    if (player.message) messages.push(player.message);
    if (player.isReversTargeted && player.type === 'CLEAR') {
      messages.push('Well played! Opponent backhand targeted.');
    }
    if (player.isBodyHit) {
      messages.push('Excellent! Body smash or kill.');
    }
    if (player.isTooClose) {
      messages.push('Poor clear: the shuttle is too close to the opponent.');
    }
    if (player.isTooShort) {
      messages.push('Poor clear: the shuttle is not deep enough.');
    }
    if (messages.length === 0) {
      messages.push(
        player.score >= 80
          ? 'Good tactical decision.'
          : `Playable shot, but ${best.type.toLowerCase()} would have been better.`,
      );
    }

    return {
      totalScore: player.score,
      correction: {
        type: best.type,
        endPos: best.endPos,
        score: best.score,
      },
      messages,
      details: {
        reachMeters: player.reachMeters,
        breakdown: player.details,
        bestShotScore: best.score,
      },
    };
  }
}
