export class FeedbackEngine {
  getPlacementFeedback(results) {
    let partnerMessage = '';

    if (results.realDistance < 2.5) {
      partnerMessage = 'Attention, tu es trop proche de ton partenaire !';
    } else if (results.realDistance > 3.5) {
      partnerMessage = 'Attention, tu es trop loin de ton partenaire !';
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
      messages.push('Bien joue ! Revers adverse vise.');
    }
    if (player.isBodyHit) {
      messages.push('Excellent ! Smash ou kill au corps.');
    }
    if (player.isTooClose) {
      messages.push("Mauvais clear : le volant est trop proche de l'adversaire.");
    }
    if (player.isTooShort) {
      messages.push("Mauvais clear : le volant n'est pas assez profond.");
    }
    if (messages.length === 0) {
      messages.push(
        player.score >= 80
          ? 'Bonne decision tactique.'
          : `Coup jouable, mais ${best.type.toLowerCase()} aurait ete meilleur.`,
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
