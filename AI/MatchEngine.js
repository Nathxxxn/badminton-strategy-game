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
