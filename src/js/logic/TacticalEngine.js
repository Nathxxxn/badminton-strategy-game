/**
 * Moteur Tactique Badminton - Version 3.0 (Physique & Réalisme)
 */

import { KinematicEngine } from './KinematicEngine.js';

export const SHOT_PARAMS = new KinematicEngine().SHOT_PARAMS;

function faultResult(type, message, rules = null) {
    return {
        type,
        score: 0,
        message,
        isReversTargeted: false,
        isBodyHit: false,
        isTooClose: false,
        isTooShort: false,
        reachMeters: rules?.reach ?? null,
        details: { placement: 0, bonus: 0 }
    };
}

export class TacticalEngine {
    constructor() {
        this.SHOT_PARAMS = SHOT_PARAMS;
        this.HALF_LENGTH = 6.70; 
        this.WIDTH = 6.10;       
        this.RIVIERE_LIMITE = 1.98 / 6.70; // ~0.29
        this.FIRST_THIRD = 0.33;           // Limite du premier tiers
    }

    /**
     * @param {Object} incoming - Le coup adverse subit {type, endPos}
     * @param {Object} user - Le coup qu'on évalue {type, endPos}
     * @param {Array} opponents - Positions des adversaires
     * @param {Object} impactPos - Position OÙ le joueur frappe le volant {x, y}
     */
    evaluateSituation(incoming, user, opponents, impactPos = {x: 0.5, y: 0.5}) {
        const rules = SHOT_PARAMS[user.type];
        const incomingRules = SHOT_PARAMS[incoming.type];

        if (!rules || !incomingRules) {
            return faultResult(user.type ?? null, "Unknown shot type", rules);
        }

        // 1. VÉRIFICATION DES FAUTES DE "ZONE" (NOUVEAU)
        
        // KILL : Autorisé seulement dans le 1er tiers

        if (user.type === 'KILL' && user.endPos.y > 0.65) {
            user.type = 'DRIVE';
        }
        // KILL sur CLEAR : Seulement si le Clear adverse est court (1er tiers)
        if (user.type === 'KILL' && incoming.type === 'NET_CLEAR' && incoming.endPos.y > this.FIRST_THIRD) {
            return faultResult(user.type, "Impossible: you cannot kill a long shuttle.", rules);
        }

        if (user.type === 'KILL' && user.endPos.y < 0.25) {
            return faultResult(user.type, "Fault: in the net.", rules);
        }
        

        // SMASH : Interdit dans le 1er tiers (risque de filet ou trajectoire impossible)
        if (user.type === 'SMASH' && impactPos.y < this.FIRST_THIRD) {
            return faultResult(user.type, "Fault: too close to smash.", rules);
        }

        // OUT & VALIDITÉ GÉNÉRALE
        if (user.endPos.x < 0 || user.endPos.x > 1 || user.endPos.y < 0 || user.endPos.y > 1) {
            return faultResult(user.type, "OUT !", rules);
        }
        if (!incomingRules.allowed.includes(user.type)) {
            return faultResult(user.type, "Shot type is not possible here", rules);
        }

        // 2. CALCUL DE DISTANCE AUX ADVERSAIRES
        let minDistanceMeters = Infinity;
        let targetOpponent = null;

        opponents.forEach(opp => {
            const dx = (user.endPos.x - opp.x) * this.WIDTH;
            const dy = (user.endPos.y - opp.y) * this.HALF_LENGTH;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDistanceMeters) {
                minDistanceMeters = dist;
                targetOpponent = opp;
            }
        });

        let distanceScore = Math.min(90, (minDistanceMeters / 4.0) * 90);
        let totalScore = 0;
        let hittingBody = false;
        let tooClose = false;
        let tooShort = false;

        // 3. SCALING PAR TYPE DE COUP
        if (user.type === 'KILL') {
            totalScore = 75 + (distanceScore / 90) * 15 + 10;
        } else if (user.type === 'SMASH') {
            totalScore = 60 + (distanceScore / 90) * 30 + rules.bonus;
        } else if (user.type === 'DROP') {
            totalScore = 45 + (distanceScore / 90) * 45 + rules.bonus;
        } else {
            totalScore = distanceScore + rules.bonus;
        }

        // 4. MALUS & BONUS SPÉCIFIQUES
        const isRightSide = user.endPos.x > targetOpponent.x;
        const isRevers = (targetOpponent.hand === 'right' && !isRightSide) || 
                         (targetOpponent.hand === 'left' && isRightSide);

        // Réalisme NET_DROP : Malus si ça tombe après la ligne de service
        if (user.type === 'NET_DROP' || user.type === 'NET_CLEAR') {
            if (user.endPos.y > this.RIVIERE_LIMITE) {
                const penalty = (user.endPos.y - this.RIVIERE_LIMITE) * 150; 
                totalScore -= penalty; // Décroît très vite après 1.98m
            }
            // Si frappé du fond du court, c'est un "Clear raté"
            if (impactPos.y > 0.6) {
                totalScore = 5; // Quasi inutile tactiquement
            }
        }
        if (user.type === 'CLEAR') {
            if (minDistanceMeters < 2.0) {
                totalScore -= 20;
                tooClose = true;
            }
            if (user.endPos.y < (5.0 / 6.70)) {
                totalScore -= 20;
                tooShort = true;
            }
        }

        // Bonus Smash au corps
        if (user.type === 'SMASH') {
            const dxMeters = (user.endPos.x - targetOpponent.x) * this.WIDTH;
            const dyMeters = (user.endPos.y - targetOpponent.y) * this.HALF_LENGTH;
            const distToCoupDroit = Math.abs(dxMeters - (targetOpponent.hand === 'right' ? 0.3 : -0.3));
            if (distToCoupDroit < 0.5 && Math.abs(dyMeters) < 0.5) {
                totalScore += 10;
                hittingBody = true;
            }
        }

        // 5. SEUIL DE RÉUSSITE
        const threshold = (user.type === 'CLEAR') ? 85 : 80;
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
                bonus : Math.round(totalScore - distanceScore)
            }
        };
    }

    findBestShotExhaustive(incoming, opponents, impactPos) {
        const shotTypes = Object.keys(SHOT_PARAMS);
        let best = { score: -1, type: '', endPos: { x: 0.5, y: 0.5 } };

        // On définit un pas de recherche
        const stepX = 0.1;
        const stepY = 0.1;

        shotTypes.forEach(type => {
            // 1. Est-ce que ce type de coup est autorisé par le coup adverse ?
            if (!SHOT_PARAMS[incoming.type]?.allowed.includes(type)) return;

            for (let x = 0.05; x <= 0.95; x += stepX) {
                for (let y = 0.05; y <= 0.95; y += stepY) {
                    // 2. On passe l'impactPos pour que evaluateSituation applique les règles Kill/Smash
                    const res = this.evaluateSituation(incoming, { type, endPos: {x, y} }, opponents, impactPos);
                    
                    if (res.score > best.score) {
                        best = { score: res.score, type: type, endPos: {x, y}, details: res };
                    }
                }
            }
        });
        return best;
    }
    /**
     * @param {Object} incoming - {type, endPos}
     * @param {Object} user - {type, endPos}
     * @param {Array} opponents - [{x, y, hand}]
     * @param {Object} impactPos - {x, y} Point où le joueur a frappé
     */
    // TacticalEngine.js

    getCompleteAnalysis(incoming, user, opponents, impactPos) {
    const playerAnalysis = this.evaluateSituation(incoming, user, opponents, impactPos);
    const bestPossible = this.findBestShotExhaustive(incoming, opponents, impactPos);
    
    const bestScore = bestPossible.score;
    // Si le bestScore est 0 (cas improbable mais par sécurité), on évite la division par zéro
    const ratio = bestScore > 0 ? 100 / bestScore : 1;

    // Application de la normalisation et arrondi à l'entier supérieur
    const scoreFinal = Math.ceil(playerAnalysis.score * ratio);
    
    // placementFinal = placement * ratio + (ratio - 1) * bonus
    const placementOriginal = playerAnalysis.details?.placement ?? 0;
    const bonusOriginal = playerAnalysis.details?.bonus ?? 0;
    const placementFinal = Math.ceil(placementOriginal * ratio + (ratio - 1) * bonusOriginal);

    return {
        score: scoreFinal,
        player: {
            ...playerAnalysis,
            score: scoreFinal,
            details: {
                placement: 0,
                bonus: 0,
                ...playerAnalysis.details,
                placement: placementFinal,
                // Le bonus reste identique en valeur absolue pour l'affichage
            }
        },
        // On ne renvoie plus le bestScore brut au Dev A comme demandé,
        // mais on peut renvoyer la correction normalisée à 100
        best: {
            type: bestPossible.type,
            endPos: bestPossible.endPos,
            score: 100 
        }
    };
}
    }
