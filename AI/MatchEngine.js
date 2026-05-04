export const MATCH_REPORT_EXAMPLE = {
    winner: "PLAYER", // ou "AI"
    initialStats: { rating: 1020, rank: "D8" },
    finalStats: { rating: 1140, rank: "D7" },
    
    globalScores: {
        tactical: 82,    // Moyenne
        placement: 75,   // Moyenne
        totalBonus: 450,
        totalMalus: -120
    },
    
    counters: {
        backhandHits: 12,
        bodyHits: 4,
        proximityAlerts: 3, // Trop près du partenaire
        distanceAlerts: 5   // Trop loin
    },
    
    rallyHistory: [ /* scores de chaque point pour le graphique */ ]
};

/**
 * Seuils de points pour les classements FFBAD
 * Structure : [Nom du rang, Points minimum]
 */
export const RATING_THRESHOLDS = {
    'P12': 0,
    'P11': 660,
    'P10': 720,
    'D9':  900,
    'D8':  1020,
    'D7':  1140,
    'R6':  1260,
    'R5':  1380,
    'R4':  1500,
    'N3':  1620,
    'N2':  1740,
    'N1':  1860
};

// Bonus : Couleurs associées pour DEV A
export const RATING_COLORS = {
    'P':  '#facc15', // Jaune
    'D':  '#4ade80', // Vert
    'R':  '#60a5fa', // Bleu
    'N':  '#f87171'  // Rouge
};



/**
 * Temps de réaction de base (ms).
 * N1 reçoit un KILL = 1600ms.
 */
export const BASE_REACTION_TIMES = {
    'P12': { CLEAR: 5500, DROP: 4600, DRIVE: 3900, SMASH: 3200, KILL: 2800, NET_DROP: 4200, NET_CLEAR: 5500 },
    'P11': { CLEAR: 5200, DROP: 4300, DRIVE: 3600, SMASH: 3000, KILL: 2650, NET_DROP: 4000, NET_CLEAR: 5200 },
    'P10': { CLEAR: 4900, DROP: 4000, DRIVE: 3400, SMASH: 2850, KILL: 2500, NET_DROP: 3800, NET_CLEAR: 4900 },
    'D9':  { CLEAR: 4500, DROP: 3700, DRIVE: 3100, SMASH: 2600, KILL: 2350, NET_DROP: 3500, NET_CLEAR: 4500 },
    'D8':  { CLEAR: 4200, DROP: 3400, DRIVE: 2900, SMASH: 2450, KILL: 2200, NET_DROP: 3300, NET_CLEAR: 4200 },
    'D7':  { CLEAR: 3900, DROP: 3200, DRIVE: 2700, SMASH: 2300, KILL: 2050, NET_DROP: 3100, NET_CLEAR: 3900 },
    'R6':  { CLEAR: 3500, DROP: 2900, DRIVE: 2450, SMASH: 2100, KILL: 1900, NET_DROP: 2800, NET_CLEAR: 3500 },
    'R5':  { CLEAR: 3200, DROP: 2700, DRIVE: 2250, SMASH: 1950, KILL: 1850, NET_DROP: 2650, NET_CLEAR: 3200 },
    'R4':  { CLEAR: 3000, DROP: 2500, DRIVE: 2100, SMASH: 1850, KILL: 1780, NET_DROP: 2500, NET_CLEAR: 3000 },
    'N3':  { CLEAR: 2700, DROP: 2250, DRIVE: 1950, SMASH: 1750, KILL: 1720, NET_DROP: 2300, NET_CLEAR: 2700 },
    'N2':  { CLEAR: 2500, DROP: 2100, DRIVE: 1800, SMASH: 1650, KILL: 1660, NET_DROP: 2150, NET_CLEAR: 2500 },
    'N1':  { CLEAR: 2300, DROP: 1950, DRIVE: 1700, SMASH: 1600, KILL: 1600, NET_DROP: 2000, NET_CLEAR: 2300 }
};

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


class MatchEngine {
    constructor(player1, player2, executionEngine) {
        this.executionEngine = executionEngine;
        
        // Initialisation des joueurs avec un état de base
        this.players = {
            1: { ...player1, fatigue: 0.0, position: { x: 0, y: 0 } },
            2: { ...player2, fatigue: 0.0, position: { x: 0, y: 0 } }
        };

        this.matchState = {
            scoreP1: 0,
            scoreP2: 0,
            setsP1: 0,
            setsP2: 0,
            currentServer: 1,
            rallyInProgress: false,
            incomingShotType: null,
            incomingSpin: false,
            intervalTaken: false // Pour savoir si la pause a déjà été faite dans le set
        };

        // Initialisation du rapport de match
        this.matchReport = {
            winner: null,
            initialStats: { 
                player1: { rating: player1.rating, rank: player1.rank },
                player2: { rating: player2.rating, rank: player2.rank }
            },
            finalStats: {},
            globalScores: { tactical: 0, placement: 0, totalBonus: 0, totalMalus: 0 },
            counters: {
                backhandHits: 0,
                bodyHits: 0,
                proximityAlerts: 0,
                distanceAlerts: 0
            },
            rallyHistory: [] // On poussera un objet à chaque fin de point
        };

        // Dictionnaire de résistance à la fatigue selon le classement
        // Plus le multiplicateur est bas, moins le joueur se fatigue
        this.FATIGUE_RESISTANCE = this._initFatigueResistance();
    }
    // ==========================================
    // CONFIGURATION DU MATCH
    // ==========================================

    /**
     * @param {number} format Format du set (5, 11, 15, 21)
     */
    setMatchFormat(format = 5) {
        const formats = {
            5: { pointsToWin: 5, interval: 3, maxPoints: 11 },
            11: { pointsToWin: 11, interval: 6, maxPoints: 15 },
            15: { pointsToWin: 15, interval: 8, maxPoints: 21 },
            21: { pointsToWin: 21, interval: 11, maxPoints: 30 }
        };

        this.rules = formats[format] || formats[21];
        // On joue toujours au meilleur des 3 sets (2 sets gagnants)
        this.rules.setsToWin = 2; 
    }

    // ==========================================
    // GESTION DE LA FATIGUE (Mise à jour)
    // ==========================================

    addFatigue(playerId, distanceMoved, shotType = null) {
        const player = this.players[playerId];
        const rank = player.rank || 'NC';
        const resistanceModifier = this.FATIGUE_RESISTANCE[rank];

        let movementCost = distanceMoved * 0.001;
        let shotCost = shotType ? this._getShotFatigueCost(shotType) : 0;

        let totalFatigueAdded = (movementCost + shotCost) * resistanceModifier;
        player.fatigue = Math.min(player.fatigue + totalFatigueAdded, 1.0);
    }

    _initFatigueResistance() {
        const ranks = ['N1', 'N2', 'N3', 'R4', 'R5', 'R6', 'D7', 'D8', 'D9', 'P10', 'P11', 'P12', 'NC'];
        let resistance = {};
        
        ranks.forEach((rank, index) => {
            let rankIdx = Math.min(index, 11); 
            if (rank === 'NC') rankIdx = 8; 
            
            // N1 = 1.0, P12 = 4.0 (Rapport de 4)
            resistance[rank] = 1.0 + (rankIdx / 11) * 3.0; 
        });
        return resistance;
    }

    /**
     * @param {string} type 'POINT', 'INTERVAL' (mi-set), 'SET'
     */
    recoverFatigue(type) {
        let factor = 1.0;
        if (type === 'POINT') factor = 0.95;       // -5%
        else if (type === 'INTERVAL') factor = 0.75; // -25%
        else if (type === 'SET') factor = 0.50;      // -50%

        [1, 2].forEach(id => {
            this.players[id].fatigue = this.players[id].fatigue * factor;
        });
    }

    // ==========================================
    // BOUCLE DE JEU (Squelette)
    // ==========================================

    /**
     * Démarre un nouvel échange (Rally)
     */
    startRally() {
        this.matchState.rallyInProgress = true;
        this.matchState.incomingShotType = 'SERVE'; // On simulera un service
        this.matchState.incomingSpin = false;
        
        // Reset des positions au centre ou en position de service (à implémenter)
        // this._resetPositionsForServe();
    }

    /**
     * Joue le tour d'un joueur (sera appelé en boucle)
     */
    playTurn(playerId, intent) {
        if (!this.matchState.rallyInProgress) return;

        const player = this.players[playerId];

        // 1. Le joueur se déplace vers le volant (KinematicEngine - à lier plus tard)
        let distanceMoved = 2.5; // Fausse valeur pour l'instant

        // 2. Le joueur frappe le volant
        const shotResult = this.executionEngine.executeShot(
            intent, 
            player, 
            this.matchState.incomingShotType, 
            this.matchState.incomingSpin
        );

        // 3. On applique la fatigue de ce tour
        this.addFatigue(playerId, shotResult.type, distanceMoved);

        // 4. Analyse du résultat (Faute ou on continue ?)
        if (shotResult.status !== 'OK') {
            this._endRally(playerId === 1 ? 2 : 1, shotResult.status); // L'autre joueur gagne le point
            return shotResult;
        }

        // 5. Mise à jour de l'état pour le prochain coup
        this.matchState.incomingShotType = shotResult.type;
        this.matchState.incomingSpin = shotResult.spin;

        return shotResult;
    }

    /**
     * Termine l'échange et donne le point
     */
    _endRally(winnerId, reason) {
        this.matchState.rallyInProgress = false;
        
        if (winnerId === 1) this.matchState.scoreP1++;
        else this.matchState.scoreP2++;

        // Récupération de souffle entre chaque point (ex: -10% de fatigue)
        this.recoverFatigue(0.10);

        // TODO: Vérifier si le set est gagné
        console.log(`Point pour Joueur ${winnerId} ! (${reason}) - Score: ${this.matchState.scoreP1}-${this.matchState.scoreP2}`);
    }
}