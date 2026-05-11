const BASE_PROBS_N1 = {
            // 1. Grosses fautes (Bois complet, raté) - [Incoming][Chosen]
            GROSS_ERROR: {
                'CLEAR':    { 'CLEAR': 0.001, 'SMASH': 0.00, 'DROP': 0.00, 'DRIVE': 0.01, 'KILL': 1.00, 'NET_DROP': 0.05, 'NET_CLEAR': 0.01 },
                'SMASH':    { 'CLEAR': 0.07, 'SMASH': 1.00, 'DROP': 1.00, 'DRIVE': 0.09, 'KILL': 1.00, 'NET_DROP': 0.05, 'NET_CLEAR': 0.01 },
                'DROP':     { 'CLEAR': 0.005, 'SMASH': 1.00, 'DROP': 1.00, 'DRIVE': 0.01, 'KILL': 1.00, 'NET_DROP': 0.005, 'NET_CLEAR': 0.01 },
                'NET_DROP': { 'CLEAR': 0.005, 'SMASH': 1.00, 'DROP': 1.00, 'DRIVE': 0.02, 'KILL': 1.00, 'NET_DROP': 0.001, 'NET_CLEAR': 0.01 },
                'DRIVE':    { 'CLEAR': 0.06, 'SMASH': 1.00, 'DROP': 0.005, 'DRIVE': 0.01, 'KILL': 1.00, 'NET_DROP': 0.03, 'NET_CLEAR': 0.01 },
                'KILL':     { 'CLEAR': 0.10, 'SMASH': 1.00, 'DROP': 1.00, 'DRIVE': 0.12, 'KILL': 1.00, 'NET_DROP': 0.08, 'NET_CLEAR': 0.01 },
                'NET_CLEAR':{ 'CLEAR': 0.00, 'SMASH': 1.00, 'DROP': 0.00, 'DRIVE': 0.001, 'KILL': 0.001, 'NET_DROP': 0.00, 'NET_CLEAR': 0.01 }
            },
            // 2. Fautes de filet - [Incoming][Chosen]
            NET_FAULT: {
                'CLEAR':    { 'CLEAR': 0.00, 'SMASH': 0.03, 'DROP': 0.02, 'DRIVE': 0.04, 'KILL': 1.00, 'NET_DROP': 0.15, 'NET_CLEAR': 0.00 },
                'SMASH':    { 'CLEAR': 0.00, 'SMASH': 1.00, 'DROP': 0.06, 'DRIVE': 0.08, 'KILL': 1.00, 'NET_DROP': 0.03, 'NET_CLEAR': 0.00 },
                'DROP':     { 'CLEAR': 0.00, 'SMASH': 1.00, 'DROP': 1.00, 'DRIVE': 0.10, 'KILL': 1.00, 'NET_DROP': 0.003, 'NET_CLEAR': 0.00 },
                'NET_DROP': { 'CLEAR': 0.00, 'SMASH': 1.00, 'DROP': 1.00, 'DRIVE': 0.08, 'KILL': 1.00, 'NET_DROP': 0.005, 'NET_CLEAR': 0.00 },
                'DRIVE':    { 'CLEAR': 0.00, 'SMASH': 1.00, 'DROP': 0.02, 'DRIVE': 0.005, 'KILL': 1.00, 'NET_DROP': 0.05, 'NET_CLEAR': 0.00 },
                'KILL':     { 'CLEAR': 0.00, 'SMASH': 1.00, 'DROP': 1.00, 'DRIVE': 0.10, 'KILL': 1.00, 'NET_DROP': 0.05, 'NET_CLEAR': 0.00 },
                'NET_CLEAR':{ 'CLEAR': 0.00, 'SMASH': 1.00, 'DROP': 0.01, 'DRIVE': 0.00, 'KILL': 0.005, 'NET_DROP': 0.02, 'NET_CLEAR': 0.00 }
            },
            // 3. Bois (Mishit) - [Chosen]
            WOOD: { 'CLEAR': 0, 'SMASH': 0.01, 'DROP': 0.01, 'NET_DROP': 0.02, 'DRIVE': 0.03, 'KILL': 0.04, 'NET_CLEAR': 0 },
            // 4. Net Clear (S'envole au filet) - [Chosen]
            NET_CLEAR_CHANCE: { 'DROP': 0.02, 'NET_DROP': 0.04, 'CLEAR': 0, 'SMASH': 0, 'DRIVE': 0, 'KILL': 0, 'NET_CLEAR': 0 }
        };

class ExecutionEngine {
    constructor() {
        // 1. Définition des listes de référence
        this.RANKS = ['N1', 'N2', 'N3', 'R4', 'R5', 'R6', 'D7', 'D8', 'D9', 'P10', 'P11', 'P12', 'NC'];
        this.SHOT_TYPES = ['CLEAR', 'SMASH', 'DROP', 'NET_DROP', 'DRIVE', 'KILL', 'NET_CLEAR'];

        // 2. Dimensions physiques pour les calculs de déviation
        this.COURT_WIDTH = 6.10;
        this.HALF_COURT_LENGTH = 6.70;

        // 3. Incertitudes de base (Niveau N) pour la Gaussienne (en mètres)
        this.BASE_DEV_METERS = {
            'SMASH': { x: 0.15, y: 0.15 },
            'DROP': { x: 0.10, y: 0.20 },
            'CLEAR': { x: 0.15, y: 0.10 },
            'KILL': { x: 0.15, y: 0.15 },
            'NET_DROP': { x: 0.10, y: 0.05 },
            'DRIVE': { x: 0.10, y: 0.15 },
            'NET_CLEAR': { x: 0.15, y: 0.15 }
        };

        // 4. Appel du moteur d'initialisation des probabilités
        // C'est cette fonction qui va remplir GROSS_ERROR_PROB, NET_FAULT_PROB, etc.
        this._initializeAllTables();
    
    }
    /**
     * Calcule le déplacement réel effectué par un joueur.
     * @param {Object} intendedPos {x, y} - La destination voulue.
     * @param {number} fatigue - Entre 0.0 et 1.0.
     * @param {Object} currentPos {x, y} - Position actuelle du joueur.
     * @returns {Object} { actualPos: {x, y}, distanceCovered: number }
     */
    executeMovement(intendedPos, fatigue, currentPos) {
        const dx = intendedPos.x - currentPos.x;
        const dy = intendedPos.y - currentPos.y;
        const intendedDistance = Math.sqrt(dx * dx + dy * dy);

        if (intendedDistance === 0) return { actualPos: intendedPos, distanceCovered: 0 };

        // Logique de fatigue : 
        // On ne commence à avoir un risque de "rater" son placement qu'au delà de 0.75 de fatigue
        // et pour des distances supérieures à 4 mètres.
        let distanceFactor = 1.0;
        
        if (fatigue > 0.70 && intendedDistance > 4.0) {
            // Probabilité de réussite baisse avec la fatigue
            const failChance = (fatigue - 0.70) * 0.5; // ex: à 0.8 de fatigue, 10% de chance de rater
            if (Math.random() < failChance) {
                // Le joueur arrive entre 85% et 95% de la distance prévue
                distanceFactor = 0.85 + Math.random() * 0.10;
            }
        }

        const actualDistance = intendedDistance * distanceFactor;
        const ratio = actualDistance / intendedDistance;

        return {
            actualPos: {
                x: currentPos.x + dx * ratio,
                y: currentPos.y + dy * ratio
            },
            distanceCovered: actualDistance
        };
    }

    /**
     * Moteur principal qui transforme l'intention en coup réel
     */
    executeShot(intent, playerState, incomingShotType, incomingSpin) {
        let finalShot = { 
            type: intent.type, 
            endPos: { ...intent.endPos },
            startPos: { ...intent.startPos },
            spin: intent.spin || false,
            status: 'OK',
            wasMishit: false 
        };

        const rank = playerState.rank || 'NC';
        const fatigue = playerState.fatigue || 0.0; // Désormais de 0.0 à 1.0
        
        const expFatiguePenalty = this._getExponentialFatigue(fatigue);
        const spinRankPenalty = this._getSpinPenalty(rank, incomingSpin);

        // ==========================================
        // TEST 1 : Autocorrection (Kill trop long)
        // ==========================================
        if (finalShot.type === 'KILL' && finalShot.endPos.y > 0.65) {
            finalShot.type = 'DRIVE';
        }

        // ==========================================
        // TEST 2 : Faute grossière (Bois monumental, raté complet)
        // ==========================================
        let grossErrorBase = this.GROSS_ERROR_PROB[rank][incomingShotType][finalShot.type];
        if (Math.random() < grossErrorBase + expFatiguePenalty) {
            finalShot.status = 'FAULT_GROSS';
            return finalShot; 
        }

        // ==========================================
        // TEST 3 : Faute dans le filet
        // ==========================================
        let netFaultProb = this.NET_FAULT_PROB[rank][incomingShotType][finalShot.type] + expFatiguePenalty;
        
        if (finalShot.type === 'CLEAR' && finalShot.startPos.y <= 0.15) {
            netFaultProb += this._getClearNetProb(finalShot.startPos.y, rank);
        }

        if (Math.random() < netFaultProb) {
            finalShot.status = 'FAULT_NET';
            return finalShot; 
        }

        // ==========================================
        // TEST 4 : Raté tactique (Bois "jouable", mauvaise exécution)
        // ==========================================
        finalShot = this._applyTypeShift(finalShot, rank, expFatiguePenalty, spinRankPenalty);

        // ==========================================
        // TEST 5 : Imprécision de trajectoire (X, Y)
        // ==========================================
        if (!finalShot.wasMishit) {
            finalShot.endPos = this._calculateDeviation(finalShot, playerState, incomingSpin);
        }

        // ==========================================
        // POST-TRAITEMENT : Nettoyage du Spin
        // ==========================================
        if (finalShot.type === 'NET_CLEAR' || (finalShot.type === 'NET_DROP' && finalShot.endPos.y > 0.2)) {
            finalShot.spin = false;
        }

        return finalShot;
    }

    /**
     * TEST 4 : Modifie le type et la trajectoire (Wood et/ou NET_CLEAR)
     */
    _applyTypeShift(shot, rank, expFatiguePenalty, spinRankPenalty) {
        let probWood = this.WOOD_PROB[rank][shot.type] + expFatiguePenalty + spinRankPenalty;
        let probNetClear = this.NET_CLEAR_PROB[rank][shot.type] + expFatiguePenalty + (spinRankPenalty > 0 ? 0.03 : 0);

        const applyWoodModifier = (shotObj) => {
            shotObj.endPos.y -= 0.2; 
            shotObj.endPos.x += (Math.random() * 0.3) - 0.15; // ±0.15
            shotObj.wasMishit = true;
        };

        const originalType = shot.type; // On garde en mémoire pour le 2e test
        const doWood = Math.random() < probWood;

        // --- 1er jet : Le Bois (Mutuellement exclusif sur les types) ---
        if (originalType === 'SMASH' && doWood) {
            shot.type = Math.random() < 0.5 ? 'DROP' : 'DRIVE';
            applyWoodModifier(shot);
        } 
        else if (originalType === 'DRIVE' && doWood) {
            shot.type = 'DROP';
            applyWoodModifier(shot);
        }
        else if (originalType === 'KILL' && doWood) {
            shot.type = 'NET_DROP';
            applyWoodModifier(shot);
        }
        else if ((originalType === 'NET_DROP' || originalType === 'DROP') && doWood) {
            // Le type reste le même pour l'instant, on applique juste la trajectoire moisie
            applyWoodModifier(shot);
        }

        // --- 2e jet indépendant : Le NET_CLEAR ---
        // On vérifie sur originalType car si le bois l'a déjà transformé, on ne veut pas l'annuler
        if ((originalType === 'NET_DROP' || originalType === 'DROP') && Math.random() < probNetClear) {
            shot.type = 'NET_CLEAR';
            shot.endPos.y += (originalType === 'DROP') ? 0.10 : 0.05; 
            shot.wasMishit = true;
        }

        return shot;
    }

    /**
     * TEST 5 : Incertitude finale de trajectoire via Gaussienne Tronquée
     */
    _calculateDeviation(shot, playerState, incomingSpin) {
        const rankParams = this._parseRankDeviation(playerState.rank || 'NC');
        const baseDev = this.BASE_DEV_METERS[shot.type] || this.BASE_DEV_METERS['CLEAR'];

        // 1. Calcul de l'erreur MAX absolue en mètres (Base * Multiplicateur P/D/R/N)
        const maxX_m = baseDev.x * rankParams.multiplier;
        const maxY_m = baseDev.y * rankParams.multiplier;

        // 2. Calcul de l'écart-type (sigma) pour régler la forme de la gaussienne
        // Formule : sigma = (Taille de la zone ciblée) / 0.674
        const sigmaX = (rankParams.fraction * maxX_m) / 0.674;
        const sigmaY = (rankParams.fraction * maxY_m) / 0.674;

        // 3. Tirage de la déviation en mètres avec notre algorithme Box-Muller
        let devX_m = this._getGaussian(0, sigmaX, maxX_m);
        let devY_m = this._getGaussian(0, sigmaY, maxY_m);

        // ==========================================
        // Modificateurs de trajectoire (Fatigue & Spin)
        // ==========================================
        
        // Fatigue : Un joueur fatigué joue de plus en plus court (Jusqu'à 1.5m max en moins)
        if (shot.type === 'CLEAR') {
            const fatigueRatio = Math.min(Math.max((playerState.fatigue || 0.0), 0.0), 1.0); 
            devY_m -= (fatigueRatio * 1.5); 
        }

        // Spin : Le spin adverse bouscule l'imprécision sur la profondeur (ex: ajoute un flottement aléatoire de ±10cm)
        if (incomingSpin) {
            devY_m += (Math.random() * 0.20) - 0.10; 
        }

        // ==========================================
        // Conversion : Mètres -> Coordonnées normalisées
        // ==========================================
        const devX_norm = devX_m / this.COURT_WIDTH;
        const devY_norm = devY_m / this.HALF_COURT_LENGTH;

        return {
            x: shot.endPos.x + devX_norm,
            y: shot.endPos.y + devY_norm
        };
    }

    // ==========================================
    // UTILITAIRES
    // ==========================================

    _getExponentialFatigue(fatigue) {
        // Fatigue est entre 0.0 et 1.0
        const normalized = Math.min(Math.max(fatigue, 0.0), 1.0);
        return 0.1 * Math.pow(normalized, 2);
    }

    _getSpinPenalty(rank, hasSpin) {
        if (!hasSpin) return 0;
        return 0.05; 
    }

    _getClearNetProb(y, rank) {
        const baseProbAtNet = 0.2; 
        const probAtLimit = 0.01;
        const ratio = Math.max(0, 1 - (y / 0.15));
        return probAtLimit + (baseProbAtNet - probAtLimit) * ratio;
    }

    /**
     * Initialise tous les tableaux de probabilités en fonction des bases N1
     */
    _initializeAllTables() {
        this.GROSS_ERROR_PROB = {};
        this.NET_FAULT_PROB = {};
        this.WOOD_PROB = {};
        this.NET_CLEAR_PROB = {};

        this.RANKS.forEach((rank, index) => {
            // Calcul du multiplicateur : N1 (index 0) = 1.0, P12 (index 11) = 4.0
            // Formule linéaire : 1 + (index / 11) * 3
            // On sature à index 11 pour que NC (index 12) soit traité à part ou comme P12
            let rankIdx = Math.min(index, 11);
            let multiplier = 1 + (rankIdx / 11) * 3;
            
            // Cas particulier NC : on a dit stats de D9 (index 8)
            if (rank === 'NC') {
                multiplier = 1 + (8 / 11) * 3;
            }

            // Génération 3D (Gross Error & Net Fault)
            this.GROSS_ERROR_PROB[rank] = this._fill3D(BASE_PROBS_N1.GROSS_ERROR, multiplier);
            this.NET_FAULT_PROB[rank] = this._fill3D(BASE_PROBS_N1.NET_FAULT, multiplier);

            // Génération 2D (Wood & Net Clear)
            this.WOOD_PROB[rank] = this._fill2D(BASE_PROBS_N1.WOOD, multiplier);
            this.NET_CLEAR_PROB[rank] = this._fill2D(BASE_PROBS_N1.NET_CLEAR_CHANCE, multiplier);
        });
    }

    _fill3D(baseN1, mult) {
        let table = {};
        for (let incoming in baseN1) {
            table[incoming] = {};
            for (let chosen in baseN1[incoming]) {
                let p = baseN1[incoming][chosen] * mult;
                table[incoming][chosen] = Math.min(p, 1.0); // On ne dépasse pas 100%
            }
        }
        return table;
    }

    _fill2D(baseN1, mult) {
        let table = {};
        for (let chosen in baseN1) {
            let p = baseN1[chosen] * mult;
            table[chosen] = Math.min(p, 1.0);
        }
        return table;
    }
    /**
     * Analyse le classement pour renvoyer le multiplicateur de zone et la fraction de régularité
     */
    _parseRankDeviation(rank) {
        if (rank === 'NC') rank = 'D9'; // Règle d'or pour le 1er match d'un NC

        const letter = rank.charAt(0);
        const number = parseInt(rank.substring(1), 10);

        // 1. Multiplicateur de zone (La lettre)
        let multiplier = 1;
        if (letter === 'R') multiplier = 2;
        else if (letter === 'D') multiplier = 3;
        else if (letter === 'P') multiplier = 4;

        // 2. Fraction pour la régularité (Le chiffre : 1, 2 ou 3)
        let level = 3; 
        if ([1, 4, 7, 10].includes(number)) level = 1;
        else if ([2, 5, 8, 11].includes(number)) level = 2;

        let fraction = 2/3; // Par défaut niveau 3
        if (level === 1) fraction = 1/3;
        else if (level === 2) fraction = 1/2;

        return { multiplier, fraction };
    }

    /**
     * Génère un nombre aléatoire selon une Loi Normale (Transformation de Box-Muller)
     * La fonction est "tronquée" : on relance le dé si on dépasse l'erreur max absolue
     */
    _getGaussian(mean, stdDev, maxVal) {
        let u1, u2, z, val;
        let attempts = 0;
        
        do {
            u1 = Math.random();
            u2 = Math.random();
            if (u1 === 0) u1 = 0.0001; // Évite l'erreur mathématique ln(0)
            
            // Box-Muller
            z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
            val = mean + z * stdDev;
            
            attempts++;
        } while (Math.abs(val) > maxVal && attempts < 5); // On relance si hors limites (max 5 fois)

        // Si vraiment pas de chance, on bloque la valeur sur la ligne de maxDev
        if (val > maxVal) return maxVal;
        if (val < -maxVal) return -maxVal;
        
        return val;
    }
}