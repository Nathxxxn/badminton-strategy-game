class MatchEngine {
    constructor(tactical, placement, kinematic, execution, aiSpawn,rating) {
        this.tactical = tactical;
        this.placement = placement;
        this.kinematic = kinematic;
        this.execution = execution;
        this.aiSpawn = aiSpawn;
        this.rating = rating;

        this.players = {};
        
        
        // État global du match en cours
        this.matchState = null;
        this.FATIGUE_RESISTANCE = this._initFatigueResistance();
    }
        /**
         * Initialise un nouveau match
         * @param {Object} playerTeam - Infos du joueur et son partenaire { rank, rating (points), hand} le partenaire aura les mêmes stats que le joueur
         * @param {String} matchType - 'INTERCLUB', 'TOURNAMENT', 'QUICK_MATCH'
         * @param {Object} specificOpponents - (Optionnel) Force les adversaires si Interclub
         */
        initMatch(playerTeam, matchType = 'QUICK_MATCH', format = 21) {
            this.setMatchFormat(format)
            // 1. Détermination des adversaires selon le type de match
            const oppTeam = this._generateOpponents(playerTeam.rating, matchType);
            // 1.1. Initialisation de this.players
            this.players = {
                1: { ...playerTeam[0], fatigue: 0.0, position: { x: 0, y: 0 }, team: 'A', servingPos: 'right' },
                2: { ...playerTeam[1], fatigue: 0.0, position: { x: 0, y: 0 }, team: 'A', servingPos: 'left' },
                3: { ...oppTeam[0], fatigue: 0.0, position: { x: 0, y: 0 }, team: 'B', servingPos: 'right' },
                4: { ...oppTeam[1], fatigue: 0.0, position: { x: 0, y: 0 }, team: 'B', servingPos: 'left' }
            };
            // 2. Initialisation de l'état du match
            this.matchState = {
                type: matchType,
                matchOver : false,
                rallyStatus: 'IN_PROGRESS', // IN_PROGRESS, FINISHED
                score: { 
                    teamA: 0, // Équipe du joueur
                    teamB: 0, // Adversaires
                    setsA: 0, 
                    setsB: 0 
                },
                intervalTaken: false,
                players : this.players, // Format ci-dessus
                teams: { 
                    teamA: playerTeam, 
                    teamB: oppTeam 
                },
                pendingMovements: {},
                // Le serveur initial
                currentServerId: (Math.random() > 0.5)? ((Math.random() > 0.5)? 1 : 2 ) : ((Math.random() > 0.5)? 3 : 4),
                lastShotScore : 0,
                // Statistiques évolutives
                matchReport : {
                        winner: null,
                        initialStats: {rating: this.players[1].rating, rank: this.players[1].rank },
                        finalStats: {},
                        totalRallies : 0,
                        globalScores: { tactical: 0, placement: 0, totalBonus: 0, totalMalus: 0, nbTactical : 0, nbPlacement :0 }, //Somme des scores de tactique et placement de chaque scénario.
                        counters: {
                            backhandHits: 0,
                            bodyHits: 0,
                            proximityAlerts: 0,
                            distanceAlerts: 0,
                            badClears : 0,
                        },
                        rallyHistory: [/* scores de chaque point pour le graphique */] // On poussera un objet à chaque fin de point. Non utilisé pour la v1 du site.
                    } // Format de MatchReport ci-dessous
            };

            return this.matchState;
        }

        /**
         * Génère les adversaires avec le bon niveau et une main aléatoire
         */
        _generateOpponents(playerRating, matchType) {

            if (playerRating === 0){
                const ratingD9 = this.rating.RATING_THRESHOLDS['D9'];
                return [
                    { rank: 'D9', rating: ratingD9, hand: 'right' },
                    { rank: 'D9', rating: ratingD9, hand: 'right' }
                ];


            }

            // On récupère la liste ordonnée des seuils (du plus petit au plus grand)
            const orderedRanks = Object.entries(this.rating.RATING_THRESHOLDS).sort((a, b) => a[1] - b[1]);
            
            // On trouve l'index du rang actuel du joueur
            let playerRankIndex = 0;
            for (let i = orderedRanks.length - 1; i >= 0; i--) {
                if (playerRating >= orderedRanks[i][1]) {
                    playerRankIndex = i;
                    break;
                }
            }

            const playerRank = orderedRanks[playerRankIndex][0];
            let oppRating = 0;

            if (matchType === 'INTERCLUB') {
                if (playerRank === 'N1') {
                    oppRating = playerRating + 50;
                } else if (playerRank === 'N2') {
                    oppRating = 1700;
                } else {
                    // 2 rangs au-dessus
                    const targetIndex = Math.min(playerRankIndex + 2, orderedRanks.length - 1);
                    oppRating = orderedRanks[targetIndex][1]; 
                }
            } else {
                // MATCH NORMAL
                if (playerRank === 'N1') {
                    const min = this.rating.RATING_THRESHOLDS['N2']; // 1425
                    const max = playerRating + 30;
                    oppRating = min + Math.random() * (max - min);
                } else if (playerRank === 'N2') {
                    const diff = (this.rating.RATING_THRESHOLDS['N1'] - this.rating.RATING_THRESHOLDS['N2']) * (4/3);
                    const min = Math.max(0, playerRating - diff);
                    const max = 1680;
                    oppRating = min + Math.random() * (max - min);
                } else {
                    // Classique : de P12 à N3
                    const currentThreshold = orderedRanks[playerRankIndex][1];
                    const nextThreshold = orderedRanks[playerRankIndex + 1][1];
                    const diff = (nextThreshold - currentThreshold) * (4/3);
                    
                    const min = Math.max(0, playerRating - diff);
                    const max = Math.min(playerRating + diff,1600);
                    oppRating = min + Math.random() * (max - min);
                }
            }

            oppRating = Math.round(oppRating); // On arrondit proprement
            const oppRank = this.rating.getRankFromRating(oppRating);


            return [
                { rank: oppRank, rating: oppRating, hand: Math.random() < 0.10 ? 'left' : 'right' },
                { rank: oppRank, rating: oppRating, hand: Math.random() < 0.10 ? 'left' : 'right' }
            ];
        }

        /**
         * Calcule les positions de départ et identifie le réceptionneur.
         * @param {Number} serverId - ID du serveur (1-4)
         * @param {String} side - 'right' ou 'left'
         */
        _generateInitialScenario(serverId, side) {
            const isRight = (side === 'right');
            
            // 1. Définition des zones de service (coordonnées normalisées)
            // Serveur : x=0.25 (droite) ou x=0.75 (gauche) | y=0.4 (fond de zone de service)
            const serverX = isRight ? 0.45 : 0.55;
            const serverY = 0.35; // Juste derrière la ligne de service court

            // Réceptionneur : En diagonale (si serveur à droite (bas), réceptionneur à gauche (haut))
            // Note: Pour l'adversaire (y > 0.5), "droite" est à x=0.75 de son point de vue
            const receiverX = isRight ? 0.75 : 0.25;
            const receiverY = 0.45; // Juste derrière la ligne de service court adverse

            // 2. Attribution du rôle de réceptionneur
            // Si Team A sert, le réceptionneur est dans Team B (3 ou 4)
            // Si Team B sert, le réceptionneur est dans Team A (1 ou 2)
            let receiverId;
            const opponentTeam = (this.players[serverId].team === 'A') ? [3, 4] : [1, 2];
            
            // Le réceptionneur est celui dont la 'servingPos' correspond au côté du service
            receiverId = opponentTeam.find(id => this.players[id].servingPos === (isRight ? 'right' : 'left'));

            // 3. Placement des partenaires (en retrait ou sur le côté)
            const partnerServerId = (serverId % 2 === 0) ? serverId - 1 : serverId + 1;
            const partnerReceiverId = (receiverId % 2 === 0) ? receiverId - 1 : receiverId + 1;

            // On met à jour les positions réelles dans l'objet players
            this.players[serverId].position = { x: serverX, y: serverY };
            this.players[receiverId].position = { x: receiverX, y: receiverY };
            
            // Partenaires : position neutre
            this.players[partnerServerId].position = { x: 0.50, y: 0.70 };
            this.players[partnerReceiverId].position = { x: 1 - receiverX, y: 0.75 };

            // 4. Définition du coup de service (Direction le T du filet adverse)
            const initialShot = {
                type: 'NET_DROP', // On utilise NET_DROP pour simuler un service court
                startPos: { x: serverX, y: serverY },
                endPos: { x: (isRight)? 1 - Math.random() * 0.50 : 0.50 - Math.random() * 0.50, y: 0.30 }, // Tombe juste après la rivière
                hasSpin: false,
                isServe: true
            };

            return {
                receiverId,
                initialShot,
                positions: {
                    [serverId]: this.players[serverId].position,
                    [receiverId]: this.players[receiverId].position,
                    [partnerServerId]: this.players[partnerServerId].position,
                    [partnerReceiverId]: this.players[partnerReceiverId].position
                }
            };
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
        
        const winnerTeam = (winnerId <= 2) ? 'A' : 'B';
        this.matchState.matchReport.winner = winnerTeam;
        const userWon = (winnerTeam === 'A');

        // Points actuels du Joueur (1) et de l'Adversaire (3)
        const userPoints = this.players[1].rating || 0;
        const avgOpponentPoints = this.players[3].rating; 

        // Calcul du gain ou de la perte
        let pointExchange = 0;
        if (userWon) {
            pointExchange = this.rating.calculateRankingGain(userPoints, avgOpponentPoints);
        } else {
            pointExchange = -this.rating.calculateRankingGain(avgOpponentPoints, userPoints);
        }
        
        // Nouveaux classements
        const newRating = this.matchState.matchReport.initialStats.rating + pointExchange;
        const newRank = this.rating.getRankFromRating(newRating);

        // ==========================================
        // GESTION SPÉCIFIQUE DU PREMIER MATCH (NC)
        // ==========================================
        if (this.matchState.matchReport.initialStats.rank === 'NC') {
            const globalScores = this.matchState.matchReport.globalScores;
            
            // Sécurité anti-division par 0
            const tacticalRatio = globalScores.nbTactical > 0 
                ? globalScores.tactical / globalScores.nbTactical 
                : 0;
                
            const placementRatio = globalScores.nbPlacement > 0 
                ? globalScores.placement / globalScores.nbPlacement 
                : 0;
                
            const meanScore = 0.6 * tacticalRatio + 0.4 * placementRatio;

            // Récupération des seuils FFBaD depuis le RatingEngine
            const tP12 = this.rating.RATING_THRESHOLDS['P12']; // 1
            const tP11 = this.rating.RATING_THRESHOLDS['P11']; // 75
            const tP10 = this.rating.RATING_THRESHOLDS['P10']; // 165
            const tD9  = this.rating.RATING_THRESHOLDS['D9'];  // 270

            // Attribution proportionnelle des points selon le meanScore
            if (meanScore < 60) {
                // Entre 0 et 60 de score -> Interpolation de P12 à P11
                newRating = tP12 + (meanScore / 60) * (tP11 - tP12);
            } 
            else if (meanScore < 85) {
                // Entre 60 et 85 de score -> Interpolation de P11 à P10
                newRating = tP11 + ((meanScore - 60) / 25) * (tP10 - tP11);
            } 
            else {
                // Entre 85 et 100 de score -> Interpolation de P10 à D9
                newRating = tP10 + ((meanScore - 85) / 15) * (tD9 - tP10);
            }

            // Arrondi propre et assignation du rang final
            newRating = Math.round(newRating);
            newRank = this.rating.getRankFromRating(newRating);
            
            // On s'assure que le pointExchange reflète bien le gain magique du NC
            pointExchange = newRating - this.matchState.matchReport.initialStats.rating;
        }
        
        this.matchState.matchReport.finalStats = { rating: newRating, rank: newRank, pointsGained: pointsExchange };
        
        console.log(`[MATCH OVER] Vainqueur: Equipe ${winnerTeam}. Gain ELO: ${pointExchange} pts. Nouveau rang: ${newRank}`);
        
        return this.matchState.matchReport; 
    }



    // ==========================================
    // LOGIQUE DE JEU (Continuité)
    // ==========================================


    /**
     * Appelé par le Dev A quand le joueur humain (ID 1) a choisi son coup.
     * @param {Object} shotIntent - {type, endPos, hasSpin}
     * @param {Object} incomingShotContext - Le coup de l'IA qu'il doit renvoyer
     */
    applyTeamShot(strikerId,shotIntent, incomingShotContext) {
        this._flushPendingMovements();
        const striker = this.players[striker];
        const opponents = [this.players[3].position, this.players[4].position]; // Format Array pour TacticalEngine

        // 2. Exécution Physique (A-t-il fait une faute ?)
        const shotResult = this.executionEngine.executeShot(
            shotIntent, 
            striker, 
            incomingShotContext.type, 
            incomingShotContext.hasSpin
        );

        // 3. Application de la fatigue de frappe
        this.addFatigue(strikerId, this.kinematic.getTraveledDistance(striker,shotResult.startPos), shotResult.type);

        const finalShotContext = {
            type: shotResult.type,
            startPos: shotResult.startPos,
            endPos: shotResult.endPos,
            hasSpin: shotResult.spin,
            strikerId: strikerId
        };
        // 4. Gestion des fautes
        if (shotResult.status !== 'OK') {
            this._endRally(3, `Faute de l'équipe A : ${shotResult.status}`); // L'équipe B gagne
            return { rallyOver: true, winnerId: 3, reason: shotResult.status, finalShot: finalShotContext };
        }
        striker.position = finalShotContext.startPos;
        
        // 1. Évaluation Tactique (Le choix était-il intelligent ?)
            const tacticalEval = this.tactical.getCompleteAnalysis(
                incomingShotContext, 
                finalShotContext, 
                opponents, 
                striker.position
            );
        if (strikerId === 1){
            // Mise à jour du Match Report
            this.matchState.matchReport.globalScores.tactical += tacticalEval.score;
            this.matchState.matchReport.globalScores.nbTactical += 1;
            this.matchState.matchReport.counters.backhandHits += (tacticalEval.player.isReversTargeted) ? 1 : 0;
            this.matchState.matchReport.counters.bodyHits += (tacticalEval.player.isBodyHit)? 1 : 0 ;
            this.matchState.matchReport.counters.badClears += (tacticalEval.player.isTooClose || tacticalEval.player.isTooShort)? 1 : 0;
        }

        // Si c'est OUT (vérifié par le TacticalEngine)
        if (tacticalEval.score === 0 && tacticalEval.player.message.includes("OUT")) {
            this._endRally(3, "Volant OUT par l'équipe A");
            return { rallyOver: true, winnerId: 3, reason: 'OUT', finalShot: finalShotContext };
        }

        this.matchState.lastShotScore = tacticalEval.score;

        // 5. On déclenche la suite du scénario (Phase A)
        // On passe le score tactique pour influencer le temps de réaction adverse !
        return this.processPostShot(strikerId, finalShotContext, tacticalEval.score);
    }
    
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
        const partnerPlacements = this.aiSpawnEngine.generateBestPlacement(shotContext, (aiShot) ? striker.position : partner.position, (aiShot) ? partner.position : striker.position, aiShot, (aiShot) ? striker.rank : partner.rank, opponents);
        const chosenPartnerPlacement = this._pickRandomFromList(partnerPlacements).pos;

        const partnerExec = this.executionEngine.executeMovement(chosenPartnerPlacement, (aiShot) ? striker.fatigue : striker.fatigue, (aiShot) ? striker.position : partner.position);
        const finalPartnerPlacement = partnerExec.actualPos;
        this.addFatigue(2, partnerExec.distanceCovered, null);

        // 2. Calcul du temps de réflexion pour le joueur humain (ID 1)
        // Note: getAdjustedReactionTime est maintenant dans KinematicEngine
        const reactionTime = this.kinematicEngine.getAdjustedTime(this.kinematicEngine.BASE_REACTION_TIMES[striker_rank][shotType], shotScore);

        this.matchState.pendingMovements = {
            2 : finalPartnerPlacement,
        }

        return {
            shotContext: finalShotContext,
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
     * Appelé par le Dev A quand le joueur humain (ID 1) a cliqué sur sa destination.
     * @param {Object} intendedPos - La position choisie par le joueur {x, y}
     * @param {Object} shotContext - Le coup qui vient d'être joué: type, startPos, EndPos, isSpin
     */
    applyPlayerMovement(intendedPos, shotContext, strikerId) {
        this._flushPendingMovements();
        const player = this.players[1];
        const partner = this.players[2];
        const opponents = { opp1: this.players[3].position, opp2: this.players[4].position };

        // 1. Exécution physique avec la fatigue
        const moveResult = this.executionEngine.executeMovement(intendedPos, player.fatigue, player.position);
        
        // Mise à jour de la position réelle et ajout de la fatigue
        player.position = moveResult.actualPos;
        this.addFatigue(1, moveResult.distanceCovered, null);

        // 2. Évaluation de la pertinence de ce placement
        // On vérifie si son choix était le bon tactiquement
        const placementEval = this.placement.evaluateGlobalPlacement(
            player.position, 
            partner.position, 
            shotContext, 
            (strikerId === 1), // On assume qu'il vient de frapper pour cette évaluation
            opponents
        );

        // 3. Mise à jour du Match Report
        this.matchState.matchReport.globalScores.placement += placementEval.total;
        this.matchState.matchReport.globalScores.nbPlacement += 1;

        this.matchState.matchReport.counters.proximityAlerts += (placementEval.realDistance < 2.5)? 1 : 0;
        this.matchState.matchReport.counters.distanceAlerts += (placementEval.realDistance > 3.5)? 1 : 0;
        
        // 4. On déclenche la suite du scénario (Phase B)
        return this.processPostMovement(shotContext, this.matchState.lastShotScore);
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
        const aiStrikerStartPos = aiStriker.position;

        const reachMeters = this.kinematicEngine.movementPossibility(shotContext, opponents)
        const startPos = this.aiSpawnEngine.getValidImpactPoint(shotContext, aiStriker.position, reachMeters, aiStriker.fatigue)

        // 2. Choix du coup de l'IA adverse (via AISpawnEngine)
        const aiShots = this.aiSpawnEngine.generateBestShot(shotContext, opponents, aiStriker.rank, startPos);
        const chosenAiShot = this._pickRandomFromList(aiShots);


        const aiShotExec = this.executionEngine.executeShot(chosenAiShot, aiStriker, shotContext.type, shotContext.hasSpin);
        const finalAiShot = aiShotExec.shot; // Le coup avec ses trajectoires réelles

        const striker_rank = aiStriker.rank
        const shotType = finalAiShot.type

        aiStriker.position = startPos;


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
        this.addFatigue(aiStrikerId, strikerExec.distanceCovered + this.kinematic.getTraveledDistance(startPos, aiStrikerStartPos), chosenAiShot.type);
        this.addFatigue(aiPartnerId, partnerExec.distanceCovered, null);

        // 4. Déterminer qui devra jouer le prochain coup dans notre équipe (1 ou 2)
        const nextTeamAStrikerId = this._determineNextStriker(1, 2, chosenAiShot);
        // SÉCURITÉ : Si le coup de l'IA est trop bon, l'IA gagne le point
        if (nextTeamAStrikerId === null) {
            return { rallyOver: true, winnerId: 3, reason: 'UNREACHABLE_BY_PLAYER' };
        }

        const reactionTime = this.kinematicEngine.getAdjustedTime(this.kinematicEngine.BASE_REACTION_TIMES[striker_rank][shotType], shotScore);
        this.matchState.pendingMovements = {
            [aiStrikerId]: finalAiStrikerPlacement,
            [aiPartnerId]: finalAiPartnerPlacement
        };
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

    _flushPendingMovements() {
        for (const [playerId, pos] of Object.entries(this.matchState.pendingMovements)) {
            this.players[playerId].position = pos;
        }
        this.matchState.pendingMovements = {};
    }


    // ==========================================
    // CONTINUITE DES SCENARIOS
    // ==========================================

    /**
     * Transforme le résultat d'une frappe en Scénario de Placement pour l'UI.
     * @param {Object} shotPlayed - Le coup qui vient d'être joué : type, startPos, endPos, hasSpin
     * @param {Object} incomingShotContext - Le coup de l'IA qu'il doit renvoyer
     */
    nextScenarioPostShot(shotPlayed, incomingShotContext) {
        const postShotdata = applyTeamShot(1, shotPlayed, incomingShotContext);
        if (postShotData.rallyOver) return postShotData;

        return {
            mode: 'PLACEMENT',
            isUserStriker: isUserStriker,
            playerStart: this.players[1].position,
            partnerStart: this.players[2].position,
            partnerEnd: postShotData.partnerTarget, // Destination idéale calculée
            shotPlayed: postShotdata.shotContext,
            opponents: [
                // Les adversaires n'ont pas encore bougé à ce stade (réaction au prochain tour)
                { posStart: this.players[3].position, posEnd: this.players[3].position, hand: 'right' },
                { posStart: this.players[4].position, posEnd: this.players[4].position, hand: 'right' }
            ],
            reflectionTime: postShotData.reflectionTime
        };
    }

    /**
     * Transforme le résultat d'un mouvement en Scénario Tactique (ou double scénario si partenaire).
     * @param {Object} intendedPos - Destination choisie par le joueur
     * @param {Object} shotContext - Coup joué par l'équipe antérieur au déplacement choisi
     * @param {Object} strikerId - 1 ou 2 si le partenaire a joué automatiquement le coup précédent
     */
    nextScenarioPostMovement(intendedPos, shotContext, strikerId) {
        const postMoveData = this.applyPlayerMovement(intendedPos, shotContext, strikerId);
        if (postMoveData.rallyOver) return postMoveData;

        // Mise en forme des déplacements adverses calculés par l'IA
        const opponentsData = [
            { posStart: this.players[3].position, posEnd: postMoveData.aiMovements[3], hand: 'right', isHitter: (postMoveData.aiIntent.strikerId === 3) },
            { posStart: this.players[4].position, posEnd: postMoveData.aiMovements[4], hand: 'right', isHitter: (postMoveData.aiIntent.strikerId === 4) }
        ];

        // CAS A : C'est au joueur (1) de frapper
        if (postMoveData.nextStrikerId === 1) {
            return {
                mode: 'TACTICAL',
                partnerPlaying: false,
                incoming: postMoveData.aiIntent,
                players: {
                    user: { pos: this.players[1].position, hand: 'right' },
                    partner: { pos: this.players[2].position, hand: 'right' },
                    opponents: opponentsData
                },
                reflectionTime: postMoveData.reflectionTime
            };
        } 
        // CAS B : C'est au partenaire (2) de frapper
        else {
            const partner = this.players[2];
            const opponentsCoords = [this.players[3].position, this.players[4].position];

            // 1. Calcul du point d'impact et choix du coup IA pour le partenaire
            const reachMeters = this.kinematic.movementPossibility(postMoveData.aiIntent, opponentsCoords).allowedRadius;
            const startPos = this.aiSpawn.getValidImpactPoint(postMoveData.aiIntent, partner.position, reachMeters, partner.fatigue) || partner.position;
            
            const aiShots = this.aiSpawn.generateBestShot(postMoveData.aiIntent, opponentsCoords, partner.rank, startPos);
            const chosenPartnerShot = this._pickRandomFromList(aiShots);

            // 2. Exécution du coup par le partenaire
            const postShotRes = this.applyTeamShot(2, chosenPartnerShot, postMoveData.aiIntent);

            // 3. Construction du Scénario Tactique "Spectateur"
            const tacticalScen = {
                mode: 'TACTICAL',
                partnerPlaying: true,
                incoming: postMoveData.aiIntent,
                partnerShot: chosenPartnerShot,
                players: {
                    user: { pos: this.players[1].position, hand: 'right' },
                    partner: { pos: this.players[2].position, hand: 'right' },
                    opponents: opponentsData
                }
            };

            // 4. Construction du Scénario de Placement consécutif
            const placementScen = this.nextScenarioPostShot(chosenPartnerShot, postMoveData.aiIntent);

            return { scenarios: [tacticalScen, placementScen] };
        }
    }
    // ==========================================
    // BOUCLE DE JEU (Squelette)
    // ==========================================

    /**
     * Termine l'échange, attribue le point, gère la rotation des serveurs
     * @param {number} winnerTeamId - 1 ou 2 pour Team A, 3 ou 4 pour Team B
     * @param {string} reason - Ex: "OUT", "FAULT_NET"
     */
    _endRally(winnerTeamId, reason) {
        this.matchState.rallyStatus = 'FINISHED';
        this.matchState.matchReport.totalRallies++;

        const winnerTeam = (winnerTeamId <= 2) ? 'A' : 'B';
        const previousServerTeam = this.players[this.matchState.currentServerId].team;

        // 1. Mise à jour du score
        if (winnerTeam === 'A') this.matchState.score.teamA++;
        else this.matchState.score.teamB++;

        const newScore = (winnerTeam === 'A') ? this.matchState.score.teamA : this.matchState.score.teamB;
        const isScoreEven = (newScore % 2 === 0);
        this.matchState.serviceSide = isScoreEven ? 'right' : 'left';

        // 2. Gestion des positions de service et du nouveau serveur
        if (winnerTeam === previousServerTeam) {
            // L'équipe conserve le service : Le même serveur change de côté avec son partenaire
            const server = this.players[this.matchState.currentServerId];
            const partnerId = (this.matchState.currentServerId % 2 !== 0) ? this.matchState.currentServerId + 1 : this.matchState.currentServerId - 1;
            const partner = this.players[partnerId];

            // Inversion des positions virtuelles de service
            const temp = server.servingPos;
            server.servingPos = partner.servingPos;
            partner.servingPos = temp;

        } else {
            // L'équipe récupère le service (Rotation) : 
            // Personne ne change de côté. Le serveur est celui qui se trouve dans la zone correspondant à la parité du score.
            let nextServerId = null;
            const potentialServers = (winnerTeam === 'A') ? [1, 2] : [3, 4];
            const requiredPos = isScoreEven ? 'right' : 'left';

            potentialServers.forEach(id => {
                if (this.players[id].servingPos === requiredPos) {
                    nextServerId = id;
                }
            });
            this.matchState.currentServerId = nextServerId;
        }

        // 3. Historisation du point
        this.matchState.matchReport.rallyHistory.push({
            winner: winnerTeam,
            score: `${this.matchState.score.teamA}-${this.matchState.score.teamB}`,
            reason: reason,
            server: this.matchState.currentServerId
        });

        console.log(`[FIN DE POINT] Point Équipe ${winnerTeam} (${reason}). Score: ${this.matchState.score.teamA}-${this.matchState.score.teamB}`);

        // 4. Déclenchement des vérifications de fin de set/match
        this.checkScore();
    }
    /**
     * Démarre un nouvel échange (Rally) et place les joueurs.
     * Renvoie le bon scénario initial (Tactique ou Placement) selon le serveur.
     */
    startRally() {
        if (this.matchState.matchOver) {
            console.log("Le match est terminé, impossible de démarrer un nouveau point.");
            return null;
        }

        // 1. Réinitialisation des variables de l'échange
        this.matchState.rallyStatus = 'IN_PROGRESS';
        this.matchState.pendingMovements = {};
        this.matchState.lastShotScore = 100;

        // 2. Détermination du côté de service
        const serverId = this.matchState.currentServerId;
        const serverTeam = this.players[serverId].team;
    

        // 3. Application des positions strictes de service
        const initialSetup = this._generateInitialScenario(serverId, players[serverId].servingPos);
        const serveShot = initialSetup.initialShot; // NET_DROP par défaut
        const receiverId = initialSetup.receiverId;

        console.log(`[NOUVEAU POINT] Score: ${this.matchState.score.teamA}-${this.matchState.score.teamB} | Service: Joueur ${serverId} à ${serveSide}`);

        // 4. Formatage des adversaires (fixes au moment du service)
        const opponentsData = [
            { posStart: this.players[3].position, posEnd: this.players[3].position, hand: 'right', isHitter: (serverId === 3) },
            { posStart: this.players[4].position, posEnd: this.players[4].position, hand: 'right', isHitter: (serverId === 4) }
        ];

        // 5. Aiguillage selon le serveur
        // CAS A : Le joueur (1) sert
        if (serverId === 1) {
            return {
                mode: 'TACTICAL',
                isServe: true,
                incoming: null, // C'est un service
                players: {
                    user: { pos: this.players[1].position, hand: 'right' },
                    partner: { pos: this.players[2].position, hand: 'right' },
                    opponents: opponentsData
                }
            };
        } 
        // CAS B : Le partenaire (2) sert
        else if (serverId === 2) {
            // Un service est "autorisé" comme réponse à un CLEAR fictif pour le moteur tactique
            const dummyIncoming = { type: 'CLEAR', startPos: this.players[3].position, endPos: this.players[2].position, hasSpin: false };
           
            return this.nextScenarioPostShot(serveShot, dummyIncoming);
        } 
        // CAS C : L'adversaire sert sur le joueur (1)
        else if (receiverId === 1) {
            return {
                mode: 'TACTICAL',
                isServe: true,
                incoming: serveShot,
                players: {
                    user: { pos: this.players[1].position, hand: 'right' },
                    partner: { pos: this.players[2].position, hand: 'right' },
                    opponents: opponentsData
                }
            };
        } 
        // CAS D : L'adversaire sert sur le partenaire (2)
        else {
            // 1. Le partenaire réceptionne automatiquement
            const aiShots = this.aiSpawn.generateBestShot(serveShot, [this.players[3].position, this.players[4].position], this.players[2].rank, this.players[2].position);
            const chosenPartnerShot = this._pickRandomFromList(aiShots);

            const postShotRes = this.applyTeamShot(2, chosenPartnerShot, serveShot);

            // 2. On crée le scénario tactique "Spectateur"
            const tacticalScen = {
                mode: 'TACTICAL',
                isServe: true,
                partnerPlaying: true, // DEV A affichera l'action du partenaire sans input joueur
                incoming: serveShot,
                players: {
                    user: { pos: this.players[1].position, hand: 'right' },
                    partner: { pos: this.players[2].position, hand: 'right' },
                    opponents: opponentsData
                }
            };

            // 3. On crée le scénario de placement qui suit
            const placementScen = this.nextScenarioPostShot(chosenPartnerShot, serveShot);

            return { scenarios: [tacticalScen, placementScen] };
        }
    }
}