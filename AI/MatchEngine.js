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



class MatchEngine {
    constructor(player1, player2, executionEngine) {
        this.executionEngine = executionEngine;
        
        // teamA = [p1, p2], teamB = [p3, p4]
        this.players = {
            1: { ...teamA[0], fatigue: 0.0, position: { x: 0, y: 0 }, team: 'A' },
            2: { ...teamA[1], fatigue: 0.0, position: { x: 0, y: 0 }, team: 'A' },
            3: { ...teamB[0], fatigue: 0.0, position: { x: 0, y: 0 }, team: 'B' },
            4: { ...teamB[1], fatigue: 0.0, position: { x: 0, y: 0 }, team: 'B' }
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
    // LOGIQUE DE SCORE ET DE MATCH
    // ==========================================

    /**
     * Appelée à la fin de chaque échange par _endRally()
     * Vérifie si on déclenche une pause, une fin de set ou une fin de match.
     */
    checkScore() {
        const { scoreP1, scoreP2 } = this.matchState;
        const { pointsToWin, maxPoints, interval, setsToWin } = this.rules;

        // 1. Vérifier la pause de mi-set
        if (!this.matchState.intervalTaken && (scoreP1 === interval || scoreP2 === interval)) {
            this.matchState.intervalTaken = true;
            this.recoverFatigue('INTERVAL');
            console.log(`[PAUSE] Mi-set atteinte à ${scoreP1}-${scoreP2}. Récupération de 25% de la fatigue accumulée.`);
            return; // On s'arrête ici pour ce point
        }

        // 2. Vérifier la victoire du set
        const maxScore = Math.max(scoreP1, scoreP2);
        const diff = Math.abs(scoreP1 - scoreP2);

        // Règle : Avoir atteint le score cible ET avoir 2 points d'écart, OU atteindre le plafond
        if ((maxScore >= pointsToWin && diff >= 2) || maxScore === maxPoints) {
            this._endSet(scoreP1 > scoreP2 ? 1 : 2);
        } else {
            // Le set continue, récupération normale entre deux points
            this.recoverFatigue('POINT');
        }
    }

    /**
     * Gère la clôture d'un set
     */
    _endSet(winnerId) {
        // Incrémentation des sets
        if (winnerId === 1) this.matchState.setsP1++;
        else this.matchState.setsP2++;

        console.log(`[FIN DU SET] Remporté par Joueur ${winnerId} (${this.matchState.scoreP1}-${this.matchState.scoreP2})`);

        // Vérifier la victoire du match
        if (this.matchState.setsP1 === this.rules.setsToWin || this.matchState.setsP2 === this.rules.setsToWin) {
            this._endMatch(winnerId);
        } else {
            // Préparation du set suivant
            this.matchState.scoreP1 = 0;
            this.matchState.scoreP2 = 0;
            this.matchState.intervalTaken = false;
            
            // Récupération complète (50% de la fatigue)
            this.recoverFatigue('SET');
            
            // En badminton, le vainqueur du set sert au début du set suivant
            this.matchState.currentServer = winnerId;
            
            console.log(`[NOUVEAU SET] Début du set suivant. Le Joueur ${winnerId} sert.`);
        }
    }

    /**
     * Clôture le match et prépare les statistiques
     */
    
    _endMatch(winnerId) {
        this.matchState.matchOver = true;
        this.matchReport.winner = (winnerId <= 2) ? "TEAM_A" : "TEAM_B";

        // TODO plus tard : Calcul des nouveaux classements (rating) via le système Elo ou autre
        // On remplit les stats finales avant de renvoyer
        this.matchReport.finalStats = this._generateFinalStats();
        
        console.log("Match Terminé. Rapport généré.");
        return this.matchReport; // C'est ici qu'on l'extrait pour l'UI
    }


    // ==========================================
    // LOGIQUE DE JEU (Continuité)
    // ==========================================
    /**
     * PHASE A : Le joueur ou son partenaire vient de frapper.
     * Génère le placement du partenaire et calcule le chrono.
     */
    processPostShot(strikerId, shotContext, shotScore) {
        const striker = this.players[strikerId];
        const striker_rank = striker.rank
        const shotType = shotContext.type
        const partnerId = (strikerId === 1) ? 2 : 1; 
        const aiShot = (strikerId === 2 ) ;
        const partner = this.players[partnerId];

        const opponents = {opp1: {x : this.players[3].position.x , y : this.players[3].position.y},
                            opp2 :{x : this.players[4].position.x , y : this.players[4].position.y}};

        // 1. Déplacement du partenaire (via AISpawnEngine)
        const partnerPlacements = this.aiSpawnEngine.generateBestPlacement(shotContext, (aiShot) ? striker.position : partner.position, (aiShot) ? partner.position : striker.position, false, (aiShot) ? striker.rank : partner.rank, opponents);
        const chosenPartnerPlacement = this._pickRandomFromList(partnerPlacements).pos;

        const partnerExec = this.executionEngine.executeMovement(chosenPartnerPlacement, partner.fatigue, partner.position);
        const finalPartnerPlacement = partnerExec.actualPos;

        // 2. Calcul du temps de réflexion pour le joueur humain (ID 1)
        // Note: getAdjustedReactionTime est maintenant dans KinematicEngine
        const reactionTime = this.kinematicEngine.getAdjustedTime(this.kinematicEngine.BASE_REACTION_TIMES[striker_rank][shotType], shotScore);

        return {
            partnerTarget: finalPartnerPlacement,
            reflectionTime: Math.max(reactionTime, 0.4) // Minimum 400ms
        };
    }

    // Utilitaire simple pour piocher dans tes listes générées
    _pickRandomFromList(list) {
        if (!list || list.length === 0) return null;
        const randomIndex = Math.floor(Math.random() * list.length);
        return list[randomIndex];
    }

    /**
     * PHASE B : L'équipe du joueur s'est replacée. 
     * L'IA adverse joue, et on détermine qui réceptionnera de notre côté.
     */
    processPostMovement(shotContext, shotScore) {
        // 1. Qui va frapper chez les IA (Équipe B : IDs 3 et 4) ?
        const aiStrikerId = this._determineNextStriker(3, 4, shotContext);
        // SÉCURITÉ : Si personne ne l'a, le point est fini pour l'équipe du joueur (Victoire !)
        if (aiStrikerId === null) {
            return { rallyOver: true, winnerId: 1, reason: 'UNREACHABLE_BY_AI' };
        }

        const aiStriker = this.players[aiStrikerId];
        const opponents = {opp1: {x : this.players[1].position.x , y : this.players[1].position.y},
                            opp2 :{x : this.players[2].position.x , y : this.players[2].position.y}};
        const aiPartnerId = (aiStrikerId === 3) ? 4 : 3;
        const aiPartner = this.players[aiPartnerId];

        const reachMeters = this.kinematicEngine.movementPossibility(shotContext, opponents)
        const startPos = this.aiSpawnEngine.getValidImpactPoint(shotContext, aiStriker.position, reachMeters, aiStriker.fatigue)

        // 2. Choix du coup de l'IA adverse (via AISpawnEngine)
        const aiShots = this.aiSpawnEngine.generateBestShot(shotContext, opponents, aiStriker.rank, startPos);
        const chosenAiShot = this._pickRandomFromList(aiShots);


        const aiShotExec = this.executionEngine.executeShot(chosenAiShot, aiStriker, shotContext.type, shotContext.hasSpin);
        const finalAiShot = aiShotExec.shot; // Le coup avec ses trajectoires réelles

        const striker_rank = aiStriker.rank
        const shotType = finalAiShot.type



        // 3. Déplacements des deux IA adverses
        // Le striker se place par rapport au volant
        const strikerPlacements = this.aiSpawnEngine.generateBestPlacement(shotContext,aiStriker.position, aiPartner.position, true, aiStriker.rank, opponents);
        const chosenAiStrikerPlacement = this._pickRandomFromList(strikerPlacements).pos;

        const strikerExec = this.executionEngine.executeMovement(chosenAiStrikerPlacement, aiStriker.fatigue, aiStriker.position);
        const finalAiStrikerPlacement = strikerExec.actualPos;

        // Le partenaire se place par rapport au volant ET au striker
        const partnerPlacements = this.aiSpawnEngine.generateBestPlacement(shotContext,aiPartner.position, aiStriker.position, false, aiPartner.rank, opponents);
        const chosenAiPartnerPlacement = this._pickRandomFromList(partnerPlacements).pos;

        const partnerExec = this.executionEngine.executeMovement(chosenAiPartnerPlacement, aiPartner.fatigue, aiPartner.position);
        const finalAiPartnerPlacement = partnerExec.actualPos;

        // AJOUT DE LA FATIGUE POUR L'ÉQUIPE IA
        this.addFatigue(aiStrikerId, strikerExec.distanceCovered, chosenAiShot.type);
        this.addFatigue(aiPartnerId, partnerExec.distanceCovered, null);

        // 4. Déterminer qui devra jouer le prochain coup dans notre équipe (1 ou 2)
        const nextTeamAStrikerId = this._determineNextStriker(1, 2, chosenAiShot);
        // SÉCURITÉ : Si le coup de l'IA est trop bon, l'IA gagne le point
        if (nextTeamAStrikerId === null) {
            return { rallyOver: true, winnerId: 3, reason: 'UNREACHABLE_BY_PLAYER' };
        }

        const reactionTime = this.kinematicEngine.getAdjustedTime(this.kinematicEngine.BASE_REACTION_TIMES[striker_rank][shotType], shotScore);

        return {
            aiIntent: finalAiShot,
            aiMovements: {
                [aiStrikerId]: finalAiStrikerPlacement,
                [aiPartnerId]: finalAiPartnerPlacement
            },
            nextStrikerId: nextTeamAStrikerId,
            reflectionTime: Math.max(reactionTime, 0.4) // Minimum 400ms, s'applique seulement si nextStirker est le partenaire
        };
    }


    _determineNextStriker(playerId1, playerId2, shotContext) {
        const p1 = this.players[playerId1];
        const p2 = this.players[playerId2];

        // 1. Définir les adversaires pour le calcul de la reach
        const opponents = (playerId1 <= 2) ? 
            { opp1: this.players[3].position, opp2: this.players[4].position } : 
            { opp1: this.players[1].position, opp2: this.players[2].position };

        // 2. Obtenir la reach via shotPossibility
        const reachP1 = this.kinematicEngine.shotPossibility(shotContext.type, shotContext.startPos, opponents, p1.fatigue).allowedReach;
        const reachP2 = this.kinematicEngine.shotPossibility(shotContext.type, shotContext.startPos, opponents, p2.fatigue).allowedReach;

        // 3. Vérifier si les joueurs peuvent l'atteindre physiquement
        // On suppose que getValidImpactPoint renvoie un tableau vide ou null si hors de portée
        const impactsP1 = this.aiSpawnEngine.getValidImpactPoint(shotContext, p1.position, reachP1, p1.fatigue);
        const impactsP2 = this.aiSpawnEngine.getValidImpactPoint(shotContext, p2.position, reachP2, p2.fatigue);

        const canP1 = Array.isArray(impactsP1) ? impactsP1.length > 0 : impactsP1 !== null;
        const canP2 = Array.isArray(impactsP2) ? impactsP2.length > 0 : impactsP2 !== null;

        if (!canP1 && !canP2) return null; // Coup gagnant, personne ne l'a
        if (canP1 && !canP2) return playerId1;
        if (!canP1 && canP2) return playerId2;

        // 4. Les deux peuvent l'avoir -> Analyse tactique
        const p1DistToNet = Math.abs(p1.position.y);
        const p2DistToNet = Math.abs(p2.position.y);
        
        const frontPlayerId = (p1DistToNet <= p2DistToNet) ? playerId1 : playerId2;
        const backPlayerId = (p1DistToNet <= p2DistToNet) ? playerId2 : playerId1;

        // Position de Défense (defpos) : Différence de Y inférieure ou égale à 2 mètres (côte à côte)
        const isDefPos = Math.abs(p1.position.y - p2.position.y) <= 2.0;

        // Joueur du côté du volant (en face de l'impact) : Différence en X
        const distXP1 = Math.abs(p1.position.x - shotContext.endPos.x);
        const distXP2 = Math.abs(p2.position.x - shotContext.endPos.x);
        const sidePlayerId = (distXP1 <= distXP2) ? playerId1 : playerId2;

        let targetPlayerId = frontPlayerId; // Cible par défaut
        let proba = 0.5; // Probabilité par défaut

        switch (shotContext.type) {
            case 'NET_DROP':
                if (isDefPos) {
                    targetPlayerId = sidePlayerId;
                    proba = 1.00;
                } else {
                    targetPlayerId = frontPlayerId;
                    proba = 1.00;
                }
                break;
            case 'NET_CLEAR':
                if (isDefPos) {
                    targetPlayerId = sidePlayerId;
                    proba = 1.00;
                } else {
                    targetPlayerId = frontPlayerId;
                    proba = 1.00;
                }
                break;
            case 'KILL':
                targetPlayerId = frontPlayerId;
                proba = 0.50;
                break;
            case 'DROP':
                if (isDefPos) {
                    targetPlayerId = sidePlayerId;
                    proba = 0.90;
                } else {
                    targetPlayerId = frontPlayerId;
                    proba = 0.90;
                }
                break;
            case 'SMASH':
                targetPlayerId = sidePlayerId;
                proba = 0.65;
                break;
            case 'CLEAR':
                if (!isDefPos) {
                    // Si pas en défense, l'arrière prend à 100% (proba 0 pour l'avant)
                    targetPlayerId = backPlayerId;
                    proba = 1.00; 
                } else {
                    // Si en défense, le joueur du côté de l'impact prend avec 85% de chance
                    targetPlayerId = sidePlayerId;
                    proba = 0.85;
                }
                break;
            case 'DRIVE':
                if (isDefPos) {
                    targetPlayerId = sidePlayerId;
                    proba = 0.80;
                } else {
                    targetPlayerId = frontPlayerId;
                    proba = 0.40;
                }
                break;
        }

        // Tirage aléatoire pour appliquer la probabilité au joueur ciblé
        const otherPlayerId = (targetPlayerId === playerId1) ? playerId2 : playerId1;
        return (Math.random() <= proba) ? targetPlayerId : otherPlayerId;
    }


    // ==========================================
    // BOUCLE DE JEU (Squelette)
    // ==========================================

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
     * Termine l'échange et donne le point (Mise à jour)
     */
    _endRally(winnerId, reason) {
        this.matchState.rallyInProgress = false;
        
        if (winnerId === 1) this.matchState.scoreP1++;
        else this.matchState.scoreP2++;

        // Celui qui gagne le point prend le service
        this.matchState.currentServer = winnerId;

        console.log(`Point Joueur ${winnerId} (${reason}) - Score: ${this.matchState.scoreP1}-${this.matchState.scoreP2}`);

        // On vérifie immédiatement les conséquences de ce nouveau score
        this.checkScore();
    }

    /**
     * Démarre un nouvel échange (Rally)
     */
    startRally() {
        if (this.matchState.matchOver) return;

        this.matchState.rallyInProgress = true;
        this.matchState.incomingShotType = 'SERVE'; 
        this.matchState.incomingSpin = false;
        
        // Côté de service (Pair = Droite, Impair = Gauche)
        const serverScore = this.matchState.currentServer === 1 ? this.matchState.scoreP1 : this.matchState.scoreP2;
        const serveSide = (serverScore % 2 === 0) ? 'RIGHT' : 'LEFT';

        // Génération du scénario initial (qui servira de base au KinematicEngine)
        // Note: C'est ici que tu utiliseras generatePlacementScenario()
        this.currentScenario = this._generateInitialScenario(this.matchState.currentServer, serveSide);

        console.log(`[SERVICE] Joueur ${this.matchState.currentServer} sert à ${serveSide}`);
    }

    _generateInitialScenario(serverId, side) {
        // C'est un "stub" (une coquille vide) en attendant d'y brancher ton vrai générateur
        return {
            player1Pos: { x: 0, y: 0 },
            player2Pos: { x: 0, y: 0 },
            shuttlePos: { x: 0, y: 0 },
            // etc...
        };
    }
}