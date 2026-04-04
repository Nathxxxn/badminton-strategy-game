/**
 * Moteur de Feedback - Badminton
 * Interprète les résultats des moteurs logiques pour l'interface utilisateur (UI)
 */
class FeedbackEngine {
    /**
     * Prépare l'affichage complet pour un exercice de placement
     * @param {Object} results - Sortie de PlacementEngine.evaluateGlobalPlacement
     */
    getPlacementFeedback(results) {
        let partnerMessage = "";
        const dist = parseFloat(results.realDistance);

        // Gestion des messages liés à la distance du partenaire
        if (dist < 2.5) {
            partnerMessage = "Attention, tu es trop proche de ton partenaire !";
        } else if (dist > 3.5) {
            partnerMessage = "Attention, tu es trop loin de ton partenaire !";
        }

        return {
            totalScore: results.total,
            idealPosition: results.ideal, // {x, y} pour que le Dev A affiche une cible
            message: partnerMessage,
            details: {
                breakdown: results.breakdown, // {partner, formation}
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
            messages.push("Bien joué ! Revers adverse visé.");
        }
        if (player.isBodyHit) {
            messages.push("Excellent ! Smash ou Kill au corps.");
        }

        // 2. Analyse des erreurs de Clear (isTooClose et isTooShort rajoutés dans TacticalEngine)
        if (player.isTooClose) {
            messages.push("Mauvais Clear : Le volant est trop proche de l'adversaire.");
        }
        if (player.isTooShort) {
            messages.push("Mauvais Clear : Le volant n'est pas assez profond.");
        }

        return {
            totalScore: player.score,
            correction: {
                type: best.type,
                endPos: best.endPos,
                score: best.score
            },
            messages: messages, // Liste de chaînes à afficher par le Dev A
            details: {
                reachMeters: player.reachMeters,
                breakdown: player.details, // {placement, bonus}
                bestShotScore: best.score
            }
        };
    }
}