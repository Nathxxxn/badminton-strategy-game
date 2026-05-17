/**
 * Seuils de points pour les classements FFBAD
 * Structure : [Nom du rang, Points minimum]
 */
export const RATING_THRESHOLDS = {
    'NC': 0,
    'P12': 1,
    'P11': 75,
    'P10': 165,
    'D9':  270,
    'D8':  390,
    'D7':  525,
    'R6':  675,
    'R5':  840,
    'R4':  1020,
    'N3':  1215,
    'N2':  1425,
    'N1':  1650
};

// Bonus : Couleurs associées pour DEV A
export const RATING_COLORS = {
    'NC': '#888888', //Gris
    'P':  '#facc15', // Jaune
    'D':  '#4ade80', // Vert
    'R':  '#60a5fa', // Bleu
    'N':  '#f87171'  // Rouge
};



/**
 * Calcule le gain de points de classement après une victoire
 */
export class RatingEngine{
    calculateRankingGain(winnerPoints, loserPoints) {
        this.ELO_K_FACTOR = 500; // Facteur de lissage pour le gain de points
        const base = 15;
        const diff = loserPoints - winnerPoints;
        return Math.max(1, Math.round(base * (1 + diff / this.ELO_K_FACTOR)));
    };


    /**
     * Retourne le rang FFBaD correspondant à un rating donné.
     * Utilise RATING_THRESHOLDS depuis RatingEngine.
     */
    getRankFromRating(rating) {
       // On trie les seuils du plus grand au plus petit (ex: [['N1', 1650], ['N2', 1425]...])
        const thresholds = Object.entries(RATING_THRESHOLDS).sort((a, b) => b[1] - a[1]);
        
        for (let [rank, minPoints] of thresholds) {
            if (rating >= minPoints) {
                return rank;
            }
        }
        return 'NC'; // Sécurité
    }
}