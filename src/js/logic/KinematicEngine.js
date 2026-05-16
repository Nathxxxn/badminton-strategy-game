/**
 * Gère les capacités de déplacement (Rayon de mouvement autorisé)
 * après un coup joué par notre équipe.
 */

/**
 * Génère le tableau des temps de réaction avec une progression linéaire
 * entre N1 (Base) et P12 (Base x 4)
 */
export const generateReactionTimes = () => {
    const ranks = ['N1', 'N2', 'N3', 'R4', 'R5', 'R6', 'D7', 'D8', 'D9', 'P10', 'P11', 'P12'];
    
    // Valeurs de référence pour N1 (le niveau le plus rapide)
    const n1Base = {
        CLEAR: 3000,
        DROP: 2625,
        DRIVE: 2400,
        SMASH: 2150,
        KILL: 1600,
        NET_DROP: 2000,
        NET_CLEAR: 2500
    };

    const table = {};
    const maxMultiplier = 4;
    const steps = ranks.length - 1; // 11 intervalles pour 12 rangs

    ranks.forEach((rank, index) => {
        // Calcul du multiplicateur linéaire : 1.0 à l'index 0 (N1), 4.0 à l'index 11 (P12)
        const multiplier = 1 + (index * (maxMultiplier - 1) / steps);
        
        table[rank] = {};
        for (let shot in n1Base) {
            // On arrondit pour avoir des ms propres
            table[rank][shot] = Math.round(n1Base[shot] * multiplier);
        }
    });
    table['NC'] = table['D9'];

    return table;
};

export const BASE_REACTION_TIMES = generateReactionTimes();

/**
 * Calcule le temps accordé au joueur pour ce tour.
 * @param {number} baseTime - Le temps issu de BASE_REACTION_TIMES
 * @param {number} previousScore - Le score relatif du coup précédent (0-100)
 */
export function calculateAdjustedTime(baseTime, previousScore) {
    const score = Math.max(0, Math.min(100, previousScore));
    let multiplier = 1.0;

    if (score < 50) {
        // Zone de Malus : De 0.25 (score 0) à 1.0 (score 50)
        // Pente : (1 - 0.25) / 50 = 0.015
        multiplier = 0.25 + (score * 0.015);
    } 
    else if (score <= 80) {
        // Zone de Confort : Pas de changement
        multiplier = 1.0;
    } 
    else {
        // Zone de Bonus : De 1.0 (score 80) à 1.20 (score 100)
        // Pente : (1.2 - 1.0) / (100 - 80) = 0.01
        multiplier = 1.0 + ((score - 80) * 0.01);
    }

    return Math.round(baseTime * multiplier);
}

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
            CLEAR:      { id: 'CLEAR',      bonus: 0,  reach: 5.0, allowed: ['SMASH', 'DROP', 'DRIVE', 'CLEAR', 'NET_DROP'] },
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

    _normalizeOpponents(opponents = [{x: 0.5, y: 0.5}]) {
        if (Array.isArray(opponents)) return opponents.filter(Boolean);
        return Object.values(opponents ?? {}).filter(Boolean);
    }

    shotPossibility(shotType, startPos = {x: 0.5, y: 0.5}, opponents = {opp1: {x: 0.5, y: 0.5}, opp2: {x: 0.5, y: 0.5}}, fatigue = 0.0) {
        // 2. Récupération des paramètres de base
        const profile = this.SHOT_PARAMS[shotType] ?? this.SHOT_PARAMS.DRIVE;
        let allowedReach = profile.reach;
        let allowedShots = [...profile.allowed];

        // LOGIQUE DE FATIGUE : Réduction de la reach sur les coups lointains (Clear)
        if (shotType === 'CLEAR' && fatigue > 0.70) {
            // Réduction aléatoire entre 5% et 15%
            const reduction = 0.05 + (Math.random() * 0.10);
            allowedReach = allowedReach * (1.0 - reduction);
        }

        if (shotType === 'NET_CLEAR') {
            // 1. Calcul de la distance réelle avec l'adversaire le plus proche
            let minOpponentDist = Infinity;
            
            this._normalizeOpponents(opponents).forEach(opp => {
                const dx = (startPos.x - opp.x) * 6.10; // WIDTH
                const dy = (startPos.y - opp.y) * 6.70; // HALF_LENGTH
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

    movementPossibility(shotContext, opponents = [{x: 0.5, y: 0.5}]) {
        const shotType = shotContext.type ;
        const startPos = shotContext.startPos ;

        // 2. Détermination du rayon autorisé
        let allowedRadius = this.MOVING_RADII[shotType] || 2.0;

        if (shotType === 'NET_CLEAR'){
            // 1. Calcul de la distance réelle (identique à shotPossibility)
            let minOpponentDist = Infinity;
            this._normalizeOpponents(opponents).forEach(opp => {
                const dx = (startPos.x - opp.x) * 6.10;
                const dy = (startPos.y - opp.y) * 6.70;
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
