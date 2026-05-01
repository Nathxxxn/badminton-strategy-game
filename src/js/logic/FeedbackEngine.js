/**
 * Moteur de Feedback - Badminton
 * Interprète les résultats des moteurs logiques pour l'interface utilisateur (UI)
 */
export class FeedbackEngine {
    /**
     * Prépare l'affichage complet pour un exercice de placement
     * @param {Object} results - Sortie de PlacementEngine.evaluateGlobalPlacement
     */
    getPlacementFeedback(results) {
        let partnerMessage = "";
        const dist = parseFloat(results.realDistance);

        // Gestion des messages liés à la distance du partenaire
        if (dist < 2.5) {
            partnerMessage = "Careful, you are too close to your partner.";
        } else if (dist > 3.5) {
            partnerMessage = "Careful, you are too far from your partner.";
        }

        return {
            totalScore: results.total,
            idealPosition: results.ideal?.pos ?? results.ideal, // {x, y} pour que le Dev A affiche une cible
            message: partnerMessage,
            details: {
                breakdown: results.breakdown, // {partner, formation}
                realDistance: results.realDistance,
                distanceToPartner: results.realDistance
            }
        };
    }

    /**
     * Prépare l'affichage complet pour un exercice de tactique
     * @param {Object} analysis - Sortie de TacticalEngine.getCompleteAnalysis
     */
    getTacticalFeedback(analysis) {
        const player = analysis.player;
        const best = analysis.best;
        let messages = [];

        // 1. Analyse des bonus (Pop-ups ou messages positifs)
        if (player.isReversTargeted && player.type === 'CLEAR') {
            messages.push("Good shot! You targeted the opponent's backhand.");
        }
        if (player.isBodyHit) {
            messages.push("Excellent! Body smash or kill.");
        }

        // 2. Analyse des erreurs de Clear (isTooClose et isTooShort rajoutés dans TacticalEngine)
        if (player.isTooClose) {
            messages.push("Poor clear: the shuttle is too close to the opponent.");
        }
        if (player.isTooShort) {
            messages.push("Poor clear: the shuttle is not deep enough.");
        }

        return {
            totalScore: player.score ?? analysis.score ?? 0,
            correction: {
                type: best.type,
                endPos: best.endPos,
            },
            messages: messages, // Liste de chaînes à afficher par le Dev A
            details: {
                reachMeters: player.reachMeters,
                breakdown: player.details, // {placement, bonus}
            }
        };
    }
}
