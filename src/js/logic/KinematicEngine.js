/**
 * Gère les capacités de déplacement (Rayon de mouvement autorisé)
 * après un coup joué par notre équipe.
 */
export class KinematicEngine {
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
            NET_DROP: 2.0, // Moyen/Long : coup de finesse au filet
            CLEAR: 3,     // COURT : exception, on doit se fixer car on attend un smash
            NET_CLEAR: 2.0 
        };
        this.SHOT_PARAMS = {
            SMASH:      { id: 'SMASH',      bonus: 10, reach: 2.0, allowed: ['NET_DROP', 'DRIVE', 'CLEAR'] },
            KILL:       { id: 'KILL',       bonus: 10, reach: 2.0, allowed: ['NET_DROP','DRIVE','CLEAR'] },
            DRIVE:      { id: 'DRIVE',      bonus: 3,  reach: 2.5, allowed: ['NET_DROP', 'DRIVE', 'CLEAR', 'DROP'] },
            DROP:       { id: 'DROP',       bonus: 7,  reach: 3.5, allowed: ['NET_DROP', 'DRIVE', 'CLEAR'] },
            NET_DROP:   { id: 'NET_DROP',   bonus: 4,  reach: 2.0, allowed: ['CLEAR', 'NET_DROP', 'DRIVE'] },
            CLEAR:      { id: 'CLEAR',      bonus: 0,  reach: 5.0, allowed: ['SMASH', 'KILL', 'DROP', 'DRIVE', 'CLEAR', 'NET_DROP'] },
            NET_CLEAR:  { id: 'NET_CLEAR',  bonus:-10, reach: 3.0, allowed: ['KILL', 'DROP', 'DRIVE', 'CLEAR', 'NET_DROP'] }
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

    shotPossibility(shotType, impactPos = {x: 0.5 , y:0.5}, opponents = {opp1 : {x: 0.5 , y:0.5}, opp2 : {x: 0.5 , y:0.5}}) {
        // 2. Récupération des paramètres de base
        let allowedReach = this.SHOT_PARAMS[shotType].reach;
        let allowedShots = [...this.SHOT_PARAMS[shotType].allowed];

        if (shotType === 'NET_CLEAR'){
            // 1. Calcul de la distance réelle avec l'adversaire le plus proche
            let minOpponentDist = Infinity;
            
            opponents.forEach(opp => {
                const dx = (impactPos.x - opp.x) * 6.10; // WIDTH
                const dy = (impactPos.y - opp.y) * 6.70; // HALF_LENGTH[cite: 16]
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < minOpponentDist) minOpponentDist = dist;
            });

            // 3. Test de proximité : si l'adversaire est à plus de 2m, on adapte
            if (minOpponentDist > 2.0) {
                allowedShots = allowedShots.filter(type => type !== 'KILL');
            }
        }

        return {
            allowedReach: allowedReach,
            allowedShots: allowedShots
        };
    }

    movementPossibility(shotType, impactPos = {x: 0.5 , y:0.5}, opponents = {opp1 : {x: 0.5 , y:0.5}, opp2 : {x: 0.5 , y:0.5}}) {
        

        // 2. Détermination du rayon autorisé
        let allowedRadius = this.MOVING_RADII[shotType] || 2.0;

        if (shotType === 'NET_CLEAR'){
            // 1. Calcul de la distance réelle (identique à shotPossibility)
            let minOpponentDist = Infinity;
            opponents.forEach(opp => {
                const dx = (impactPos.x - opp.x) * 6.10;
                const dy = (impactPos.y - opp.y) * 6.70;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < minOpponentDist) minOpponentDist = dist;
            });
            // 3. Si l'adversaire est loin, on augmente la tolérance de mouvement
            if (minOpponentDist > 2.0) {
                allowedRadius = 3.0;
            }
        }
        return { 
            allowedRadius: allowedRadius 
        };
    }

}