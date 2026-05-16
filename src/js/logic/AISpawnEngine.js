/**
 * AISpawnEngine - Version Corrigée
 */
export class AISpawnEngine {
    constructor(tacticalEngine, placementEngine,kinematicEngine) {
        this.tactical = tacticalEngine;
        this.placement = placementEngine;
        this.kinematic = kinematicEngine

        this.WIDTH = 6.10;
        this.HALF_LENGTH = 6.70;

        // Fenêtres d'impact [début, fin] de la trajectoire (0.0 départ, 1.0 sol)
        this.SHOT_WINDOWS = {
            SMASH:    [{start: 0.5, end: 1.0}], 
            KILL:     [{start: 0.8, end: 1.0}], 
            DRIVE:    [{start: 0.4, end: 1.0}], 
            DROP:     [{start: 0.5, end: 1.0}], 
            NET_DROP: [{start: 0.5, end: 1.0}], 
            NET_CLEAR: [{start: 0.5, end: 1.0}],
            CLEAR:    [{start: 0.0, end: 0.1}, {start: 0.8, end: 1.0}] 
        };
    }

    /**
     * Centralise l'accès aux positions idéales du PlacementEngine
     */
    getIdealPos(shotType, shuttleEndPos, isHitter, playerPos, partnerPos) {
        const isPlayerLeft = (playerPos.x < partnerPos.x);

        switch (shotType) {
            case 'CLEAR':    return this.placement.getIdealDefensePos(shuttleEndPos, isPlayerLeft);
            case 'KILL':     return this.placement.getIdealKillPos(shuttleEndPos, isHitter);
            case 'DRIVE':    return this.placement.getIdealDrivePos(shuttleEndPos, isHitter);
            case 'SMASH':    return this.placement.getIdealSmashPos(shuttleEndPos, isHitter);
            case 'DROP':     return this.placement.getIdealDropPos(shuttleEndPos, isHitter);
            case 'NET_DROP': return this.placement.getIdealNetDropPos(shuttleEndPos, isHitter);
            case 'NET_CLEAR': return this.placement.getIdealDefensePos(shuttleEndPos, isPlayerLeft);
            default:         return { x: 0.5, y: 0.5 };
        }
    }

    /**
     * Fenêtre Top-N élargie pour permettre des erreurs grossières aux bas niveaux
     */
    getRankWindowSize(rank) {
        const ranks = ["N1","N2","N3","R4","R5","R6","D7","D8","D9","P10","P11","P12"];
        const idx = ranks.indexOf(rank);
        if (idx === -1) return 300; 
        // N1: Top 10 | P12: Top 300+ (sur un grid search de ~400 points, c'est presque tout le terrain)
        return 10 + (idx * 30); 
    }

    /**
     * GÉNÉRATION DE COUP IA
     */
    
    generateBestShot(incoming, opponents, rank, startPos = {x: 0.5, y: 0.5}) {
        const windowSize = this.getRankWindowSize(rank);
        const allPossibleShots = [];
        const step = 0.1; 
        const types = Object.keys(this.tactical.SHOT_PARAMS);

        
        const spinProbabilities = {
            'P12': 0.00, 'P11': 0.01, 'P10': 0.02,
            'D9': 0.05,  'D8': 0.08,  'D7': 0.11,
            'R6': 0.17,  'R5': 0.23,  'R4': 0.29,
            'N3': 0.38,  'N2': 0.47,  'N1': 0.56
        };


        types.forEach(type => {
            for (let x = 0.05; x <= 0.95; x += step) {
                for (let y = 0.05; y <= 0.95; y += step) {
                    const res = this.tactical.evaluateSituation(incoming, { type, endPos: {x, y} }, opponents, startPos);
                    // Application
                    const rankProb = spinProbabilities[strikerRank] || 0.0;
                    const hasSpin = (type === 'NET_DROP') ? (Math.random() < rankProb) : false;
                    allPossibleShots.push({ type, startPos : startPos, endPos: {x, y}, score: res.score, hasSpin : hasSpin });
                }
            }
        });

        allPossibleShots.sort((a, b) => b.score - a.score);
        const topN = allPossibleShots.slice(0, Math.min(windowSize, allPossibleShots.length));
        return topN[Math.floor(Math.random() * topN.length)];
    }

    /**
     * GÉNÉRATION DE PLACEMENT IA - Version avec contraintes cinématiques
     */
    generateBestPlacement(shotContext, playerPos, partnerPos, isHitter, rank, opponents) {
        const windowSize = this.getRankWindowSize(rank);
        const candidates = [];
        
        // 1. Récupérer la range autorisée (définie dans KinematicEngine selon le coup joué)
        // On suppose que kinematicEngine est accessible via this.kinematic
        const maxDist = this.kinematic.movementPossibility(shotContext, opponents) || 3.0;

        // Calcul de la position idéale théorique pour le fallback
        const ideal = this.getIdealPos(shotContext.type, shotContext.endPos, isHitter, playerPos, partnerPos);

        if (not (isHitter)) {
            // GÉNÉRATION DU NUAGE (Hitter)
            for (let i = 0; i < 200; i++) {
                const p = {
                    x: Math.max(0, Math.min(1, ideal.x + (Math.random() - 0.5) * 0.4)),
                    y: Math.max(0, Math.min(1, ideal.y + (Math.random() - 0.5) * 0.4))
                };
                
                // Calcul de la distance de déplacement réelle (en mètres)
                const moveDist = this.placement.calculateDistMeters(playerPos, p);
                
                let score = 0;
                // Contrainte : Si hors de portée, le score tombe à 0 avant le tri
                if (moveDist <= maxDist) {
                    score = this.placement.calculateFormationScore(p, ideal, 0.5, 0.8);
                }
                
                candidates.push({ pos: p, score: score });
            }
        } else {
            // BALAYAGE GRID (Équipier)
            for (let x = 0.05; x <= 0.95; x += 0.1) {
                for (let y = 0.05; y <= 0.95; y += 0.1) {
                    const p = { x, y };
                    const moveDist = this.placement.calculateDistMeters(playerPos, p);
                    
                    let score = 0;
                    if (moveDist <= maxDist) {
                        const res = this.placement.evaluateGlobalPlacement(p, partnerPos, shotContext, false,opponents);
                        score = res.total;
                    }
                    candidates.push({ pos: p, score: score });
                }
            }
        }

        // 2. Tri par score décroissant
        candidates.sort((a, b) => b.score - a.score);

        // 3. Gestion du Fallback : Si même le meilleur candidat a un score de 0
        // (cela signifie qu'aucun point testé n'est dans la range maxDist)
        if (candidates[0].score === 0) {
            const distToIdeal = this.placement.calculateDistMeters(playerPos, ideal);
            if (distToIdeal === 0) return playerPos; // Déjà sur place

            // On calcule le point à la limite de la range dans la direction de l'idéal
            const ratio = maxDist / distToIdeal;
            return {
                x: playerPos.x + (ideal.x - playerPos.x) * ratio,
                y: playerPos.y + (ideal.y - playerPos.y) * ratio
            };
        }

        // 4. Sélection aléatoire dans le Top-N (parmi ceux qui ont un score > 0)
        const validCandidates = candidates.filter(c => c.score > 0);
        const topN = validCandidates.slice(0, Math.min(windowSize, validCandidates.length));
        
        return topN[Math.floor(Math.random() * topN.length)].pos;
    }

    /**
     * CALCUL DU POINT D'IMPACT (Méthode par échantillonnage)
     */
    getValidImpactPoints(shotContext, playerPos, reachMeters, fatigue = 1.0) {
        const shuttleStart = shotContext.startPos;
        const shuttleEnd = shotContext.endPos;
        const shotType = shotContext.type;
        const windows = this.SHOT_WINDOWS[shotType];
        if (!windows) return [];

        // La fatigue réduit la fenêtre de frappe (on est moins précis/rapide)
        const safeFatigue = Number.isFinite(fatigue) && fatigue > 0 ? fatigue : 1.0;
        const fatigueFactor = 1 / safeFatigue;

        const adjustedWindows = windows.map(w => ({
            start: w.start + (1 - fatigueFactor) * 0.1, // La fenêtre rétrécit
            end: w.end - (1 - fatigueFactor) * 0.1
        }));

        const validPoints = [];
        const numSamples = 100; // Précision du découpage de la trajectoire

        for (let i = 0; i <= numSamples; i++) {
            const t = i / numSamples;
            
            // 1. Est-ce dans la fenêtre temporelle du coup ?
            const inWindow = adjustedWindows.some(w => t >= w.start && t <= w.end);
            if (!inWindow) continue;

            // 2. Coordonnées du point à l'instant t
            const currentPosX = shuttleStart.x + t * (shuttleEnd.x - shuttleStart.x);
            const currentPosY = shuttleStart.y + t * (shuttleEnd.y - shuttleStart.y);

            // 3. Calcul de la distance réelle au joueur (en mètres)
            const dist = this.placement.calculateDistMeters(
                { x: currentPosX, y: currentPosY },
                playerPos
            );

            // 4. Si c'est dans la reach, on stocke
            if (dist <= reachMeters) {
                validPoints.push({
                    x: Number(currentPosX.toFixed(6)),
                    y: Number(currentPosY.toFixed(6)),
                    t: Number(t.toFixed(2))
                });
            }
        }

        return validPoints;
    }

    getValidImpactPoint(shotContext, playerPos, reachMeters, fatigue = 1.0) {
        const validPoints = this.getValidImpactPoints(shotContext, playerPos, reachMeters, fatigue) ?? [];

        // Renvoie un point aléatoire parmi les points valides
        if (validPoints.length === 0) return null;
        return validPoints[Math.floor(Math.random() * validPoints.length)];
    }
}
