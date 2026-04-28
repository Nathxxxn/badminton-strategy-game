const matchReport = {
    winner: "PLAYER", // ou "AI"
    initialStats: { points: 1200, rank: "D8" },
    finalStats: { points: 1250, rank: "D7" },
    
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
    'NC':  0,
    'P12': 0.01,
    'P11': 2,
    'P10': 8,
    'D9':  32,
    'D8':  64,
    'D7':  128,
    'R6':  256,
    'R5':  512,
    'R4':  1024,
    'N3':  2048,
    'N2':  4096,
    'N1':  8192
};

// Bonus : Couleurs associées pour DEV A
export const RATING_COLORS = {
    'NC': '#9ca3af', // Gris
    'P':  '#facc15', // Jaune
    'D':  '#4ade80', // Vert
    'R':  '#60a5fa', // Bleu
    'N':  '#f87171'  // Rouge
};