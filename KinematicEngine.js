/**
 * Gère les capacités de déplacement (Rayon de mouvement autorisé)
 * après un coup joué par notre équipe.
 */
class KinematicEngine {
    constructor() {
        this.WIDTH = 6.10;
        this.HALF_LENGTH = 6.70;

        // RAYONS DE DÉPLACEMENT (en mètres)
        // Distance qu'un joueur peut parcourir pour se replacer
        // selon le coup que NOTRE équipe vient de jouer.
        this.MOVING_RADII = {
            SMASH: 1.5,    // Très court : le retour arrive vite
            KILL: 0.8,     // Infime : on est déjà au filet, réaction immédiate requise
            DRIVE: 2.0,    // Moyen : jeu à plat rapide
            DROP: 3.5,     // Long : le volant met du temps à tomber
            NET_DROP: 2.5, // Moyen/Long : coup de finesse au filet
            CLEAR: 3     // COURT : exception, on doit se fixer car on attend un smash
        };
    }

    /**
     * Calcule la distance de déplacement réelle effectuée par le joueur
     * @param {Object} startPos - {x, y} Position au moment de la frappe
     * @param {Object} endPos - {x, y} Position finale de replacement
     */
    getTraveledDistance(startPos, endPos) {
        const dx = (endPos.x - startPos.x) * this.WIDTH;
        const dy = (endPos.y - startPos.y) * this.HALF_LENGTH;
        return Math.sqrt(dx * dx + dy * dy);
    }

    movementPossibility (shotType){
        const allowedRadius = this.MOVING_RADII[shotType] || 2.0;
        return {allowedRadius:allowedRadius}

    }

    /**
     * Évalue si le replacement choisi est physiquement possible
     * @param {string} shotType - Le coup que NOTRE équipe vient de faire
     * @param {Object} startPos - {x, y}
     * @param {Object} endPos - {x, y}
     */
    evaluateMovementPossibility(shotType, startPos, endPos) {
        const distance = this.getTraveledDistance(startPos, endPos);
        const allowedRadius = this.MOVING_RADII[shotType] || 2.0;

        // Le mouvement est-il dans le rayon autorisé ?
        const isPossible = distance <= allowedRadius;

        // Calcul d'un score de "faisabilité"
        // 100 si dans le rayon, décroissance rapide au-delà
        let mobilityScore = 1;
        if (distance > allowedRadius) {
            const diff = distance - allowedRadius;
            mobilityScore = 0; 
        }

        return {
            isPossible: isPossible,
            mobilityScore: mobilityScore,
            distanceMeters: distance.toFixed(2),
            allowedRadius: allowedRadius,
            excess: (distance > allowedRadius) ? (distance - allowedRadius).toFixed(2) : 0
        };
    }
}