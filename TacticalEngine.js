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

        // 3. SCALING ATTAQUE OU SCORE DE BASE
        if (user.type === 'KILL') {
            totalScore = 75 + (distanceScore / 90) * (90 - 75) + 10;
        } else if (user.type === 'SMASH') {
            totalScore = 60 + (distanceScore / 90) * (90 - 60) + rules.bonus;
        } else if (user.type === 'DROP') {
            totalScore = 45 + (distanceScore / 90) * (90 - 45) + rules.bonus;
        } else {
            totalScore = distanceScore + rules.bonus;
        }

        // 4. MALUS & BONUS SPÉCIFIQUES (Avant le test de seuil)
        const isRightSide = user.endPos.x > targetOpponent.x;
        const isRevers = (targetOpponent.hand === 'right' && !isRightSide) || 
                         (targetOpponent.hand === 'left' && isRightSide);

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
            if (minDistanceMeters < 2.0) totalScore -= 20;
            if (user.endPos.y < (5.0 / 6.70)) totalScore -= 20;
        }

        // 5. TEST DE SEUIL FINAL (Le "Coup Gagnant")
        // Si le score cumulé dépasse le seuil, on s'assure que le bonus de coup est au max
        const threshold = (user.type === 'CLEAR') ? 85 : 80;
        if (totalScore >= threshold && user.type !== 'CLEAR') {
            // On ajuste pour que le bonus de coup contribue à hauteur de 10
            totalScore = Math.max(totalScore, distanceScore + 10);
        }

        return {
            score: Math.min(100, Math.max(0, Math.round(totalScore))),
            isReversTargeted: isRevers,
            isBodyHit: hittingBody,
            reachMeters: rules.reach,
            details: { 
                placement: distanceScore, 
                totalPreBonus: totalScore 
            }
        };
    }
}