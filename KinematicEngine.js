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
        this.SHOT_PARAMS = {
            SMASH:      { id: 'SMASH',reach: 2.0, allowed: ['NET_DROP', 'DRIVE', 'CLEAR'] },
            KILL:       { id: 'KILL', reach: 0.5, allowed: ['NET_DROP'] },
            DRIVE:      { id: 'DRIVE',  reach: 2.5, allowed: ['NET_DROP', 'DRIVE', 'CLEAR', 'DROP'] },
            DROP:       { id: 'DROP',  reach: 3.5, allowed: ['NET_DROP', 'DRIVE', 'CLEAR'] },
            NET_DROP:   { id: 'NET_DROP',  reach: 2.0, allowed: ['CLEAR', 'NET_DROP', 'DRIVE', 'KILL'] },
            CLEAR:      { id: 'CLEAR',  reach: 5.0, allowed: ['SMASH', 'KILL', 'DROP', 'DRIVE', 'CLEAR', 'NET_DROP'] }
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

    shotPossibility (shotType){
        const allowedReach = this.SHOT_PARAM[shotType].reach;
        const allowedShots = this.SHOT_PARAM[shotType].allowed;

        return {allowedReach : allowedReach,
                allowedShots : allowedShots
            }

    }

    movementPossibility (shotType){
        const allowedRadius = this.MOVING_RADII[shotType] || 2.0;
        return {allowedRadius:allowedRadius}

    }

}