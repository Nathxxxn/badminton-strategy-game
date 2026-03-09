/**
 * Moteur Tactique Badminton
 * Coordonnées normalisées (0.0 à 1.0) sur un demi-terrain de 6.70m x 6.10m
 */

const SHOT_PARAMS = {
    SMASH:      { id: 'SMASH',      bonus: 10, reach: 2.0, allowed: ['NET_DROP', 'DRIVE', 'CLEAR'] },
    KILL:       { id: 'KILL',       bonus: 10, reach: 0.5, allowed: ['NET_DROP'] },
    DRIVE:      { id: 'DRIVE',      bonus: 3,  reach: 2.5, allowed: ['NET_DROP', 'DRIVE', 'CLEAR', 'DROP'] },
    DROP:       { id: 'DROP',       bonus: 7,  reach: 3.5, allowed: ['NET_DROP', 'DRIVE', 'CLEAR'] },
    NET_DROP:   { id: 'NET_DROP',   bonus: 4,  reach: 2.0, allowed: ['CLEAR', 'NET_DROP', 'DRIVE', 'KILL'] },
    CLEAR:      { id: 'CLEAR',      bonus: 0,  reach: 5.0, allowed: ['SMASH', 'KILL', 'DROP', 'DRIVE', 'CLEAR', 'NET_DROP'] }
};

class BadmintonEngine {
    constructor() {
        this.HALF_LENGTH = 6.70; // axe Y (fond vers filet)
        this.WIDTH = 6.10;       // axe X (largeur)
        this.RIVIERE_LIMITE = 1.98 / 6.70; // La ligne de service court (~2m du filet)
    }

    /**
     * @param {Object} incoming - { type, startPos: {x,y}, endPos: {x,y} }
     * @param {Object} user - { type, startPos: {x,y}, endPos: {x,y} }
     * @param {Array} opponents - [{x, y}, {x, y}]
     */
    evaluateSituation(incoming, user, opponents) {
        const rules = SHOT_PARAMS[user.type];
        const incomingRules = SHOT_PARAMS[incoming.type];

        // 1. VERIFICATION DES DROITS DE REPONSE
        if (!incomingRules.allowed.includes(user.type)) {
            return { score: 0, message: "Type de coup invalide pour cette situation" };
        }

        // 2. LOGIQUE SPECIFIQUE (Rivière / Fond)
        // La "rivière" est proche du filet (y proche de 0 dans notre repère de demi-terrain)
        const isFromRiviere = incoming.endPos.y <= this.RIVIERE_LIMITE;
        

        if (user.type === 'DRIVE' && !isFromRiviere) {
            return { score: 0, message: "Le drive n'est possible que si le volant est dans la rivière" };
        }
        if (user.type === 'KILL' && isFromRiviere) {
            return { score: 0, message: "Le kill n'est possible que si le volant vient du fond de court" };
        }

        // 3. CALCUL DU SCORE DE BASE
        let score = 50 + rules.bonus;

        // 4. DISTANCE AUX ADVERSAIRES
        // On convertit les coordonnées normalisées en mètres pour un calcul de distance réel
        let minDistanceMeters = Infinity;
        opponents.forEach(opp => {
            const dx = (user.endPos.x - opp.x) * this.WIDTH;
            const dy = (user.endPos.y - opp.y) * this.HALF_LENGTH;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < minDistanceMeters) minDistanceMeters = dist;
        });

        // Plus le volant tombe loin de l'adversaire, plus on gagne de points
        // On considère qu'à 4m de distance, on a le bonus max
        score += Math.min(40, (minDistanceMeters / 4) * 40);

        // 5. MALUS SPECIFIQUES AU CLEAR
        if (user.type === 'CLEAR') {
            // Malus si à moins de 2m d'un joueur
            if (minDistanceMeters < 2.0) score -= 10;
            // Malus si à moins de 5m du filet (profondeur)
            // Dans notre repère, y=0 est le filet, donc on veut y > (5 / 6.70)
            if (user.endPos.y < (5.0 / 6.70)) score -= 10;
        }

        return {
            score: Math.min(100, Math.max(0, Math.round(score))),
            reachMeters: rules.reach
        };
    }
}