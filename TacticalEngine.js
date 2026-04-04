/**
 * Moteur Tactique Badminton - Version 2.0
 */

const SHOT_PARAMS = {
    SMASH:      { id: 'SMASH',      bonus: 10, reach: 2.0, allowed: ['NET_DROP', 'DRIVE', 'CLEAR'] },
    KILL:       { id: 'KILL',       bonus: 10, reach: 0.5, allowed: ['NET_DROP'] },
    DRIVE:      { id: 'DRIVE',      bonus: 3,  reach: 2.5, allowed: ['NET_DROP', 'DRIVE', 'CLEAR', 'DROP'] },
    DROP:       { id: 'DROP',       bonus: 7,  reach: 3.5, allowed: ['NET_DROP', 'DRIVE', 'CLEAR'] },
    NET_DROP:   { id: 'NET_DROP',   bonus: 4,  reach: 2.0, allowed: ['CLEAR', 'NET_DROP', 'DRIVE', 'KILL'] },
    CLEAR:      { id: 'CLEAR',      bonus: 0,  reach: 5.0, allowed: ['SMASH', 'KILL', 'DROP', 'DRIVE', 'CLEAR', 'NET_DROP'] }
};

class TacticalEngine {
    constructor() {
        this.HALF_LENGTH = 6.70; 
        this.WIDTH = 6.10;       
        this.RIVIERE_LIMITE = 1.98 / 6.70; 
    }

    evaluateSituation(incoming, user, opponents) {
        const rules = SHOT_PARAMS[user.type];
        const incomingRules = SHOT_PARAMS[incoming.type];

        // 1. VERIFICATION OUT & VALIDITÉ
        if (user.endPos.x < 0 || user.endPos.x > 1 || user.endPos.y < 0 || user.endPos.y > 1) {
            return { score: 0, message: "OUT !" };
        }
        if (!incomingRules.allowed.includes(user.type)) {
            return { score: 0, message: "Type de coup invalide" };
        }

        // 2. DISTANCE ET ADVERSAIRE CIBLE
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

        // 3. SCALING
        if (user.type === 'KILL') {
            totalScore = 75 + (distanceScore / 90) * (90 - 75) + 10;
        } else if (user.type === 'SMASH') {
            totalScore = 60 + (distanceScore / 90) * (90 - 60) + rules.bonus;
        } else if (user.type === 'DROP') {
            totalScore = 45 + (distanceScore / 90) * (90 - 45) + rules.bonus;
        } else {
            totalScore = distanceScore + rules.bonus;
        }

        // 4. MALUS & BONUS
        const isRightSide = user.endPos.x > targetOpponent.x;
        const isRevers = (targetOpponent.hand === 'right' && !isRightSide) || 
                         (targetOpponent.hand === 'left' && isRightSide);
        const tooClose = false;
        const tooShort = false;

        if (user.type === 'SMASH') {
            const dxMeters = (user.endPos.x - targetOpponent.x) * this.WIDTH;
            const dyMeters = (user.endPos.y - targetOpponent.y) * this.HALF_LENGTH;
            const distToCoupDroit = Math.abs(dxMeters - (targetOpponent.hand === 'right' ? 0.3 : -0.3));
            if (distToCoupDroit < 0.5 && Math.abs(dyMeters) < 0.5) {
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
            if (user.endPos.y < (5.0 / 6.70)) {
                totalScore -= 20;
                tooShort = true;
            }
        }

        // 5. SEUIL
        const threshold = (user.type === 'CLEAR') ? 85 : 80;
        if (totalScore >= threshold) {
            totalScore = Math.max(totalScore, distanceScore + 10);
        }

        return {
            score: Math.min(100, Math.max(0, Math.round(totalScore))),
            isReversTargeted: isRevers,
            isBodyHit: hittingBody,
            isTooClose : tooClose,
            isTooShort : tooShort,
            reachMeters: rules.reach,
            details: { 
                placement: distanceScore, 
                bonus : Math.round(totalScore - distanceScore)
            }
        };
    }

    findBestShotExhaustive(incoming, opponents) {
        const shotTypes = Object.keys(SHOT_PARAMS);
        let best = { score: -1, type: '', endPos: { x: 0.5, y: 0.5 } };

        const stepX = 0.5 / this.WIDTH;
        const stepY = 0.5 / this.HALF_LENGTH;

        shotTypes.forEach(type => {
            if (!SHOT_PARAMS[incoming.type].allowed.includes(type)) return;

            for (let x = 0.05; x <= 0.95; x += stepX) {
                for (let y = 0.05; y <= 0.95; y += stepY) {
                    const res = this.evaluateSituation(incoming, { type, endPos: {x, y} }, opponents);
                    if (res.score > best.score) {
                        best = { score: res.score, type: type, endPos: {x, y}, details: res };
                    }
                }
            }
        });
        return best;
    }
    /**
     * Analyse complète : Évalue le coup du joueur ET cherche la meilleure solution
     * @param {Object} incoming - {type, endPos}
     * @param {Object} user - {type, endPos}
     * @param {Array} opponents - [{x, y, hand}]
     */
    getCompleteAnalysis(incoming, user, opponents) {
        // 1. Évaluer ce que le joueur a fait
        const playerAnalysis = this.evaluateSituation(incoming, user, opponents);

        // 2. Chercher ce qu'il aurait dû faire (le "corrigé")
        // On ne passe que incoming et opponents car cette fonction teste tous les types de coups
        const bestPossible = this.findBestShotExhaustive(incoming, opponents);

        return {
            player: playerAnalysis,
            best: {
                type: bestPossible.type,
                endPos: bestPossible.endPos,
                score: bestPossible.score,
                message: `Le meilleur coup était un ${bestPossible.type}`
            }
        };
    }
}