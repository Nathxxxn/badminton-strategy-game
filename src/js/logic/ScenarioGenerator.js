/**
 * Générateur de Scénarios Tactiques et Placement
 */
export class ScenarioGenerator {
    constructor(tactical, placement, aiSpawn,kinematic) {
        this.tactical = tactical;
        this.placement = placement;
        this.aiSpawn = aiSpawn;
        this.kinematicEngine = kinematic;
    }

    getRandomHand() {
        return Math.random() < 0.1 ? 'left' : 'right';
    }

    getRandomPos(margin = 0.15) {
        return {
            x: margin + Math.random() * (1 - 2 * margin),
            y: margin + Math.random() * (1 - 2 * margin)
        };
    }
    getRandomImpact(shotType = 'CLEAR') {
    const x = 0.1 + Math.random() * 0.8; // Évite les couloirs extrêmes
    let y = 0.5;

    switch (shotType) {
        case 'CLEAR':    y = 0.75 + Math.random() * 0.2; break; // Fond de court
        case 'SMASH':    y = 0.40 + Math.random() * 0.35; break; // Mi-court / Fond
        case 'DROP':     y = 0.15 + Math.random() * 0.15; break; // Zone devant
        case 'NET_DROP': y = 0.05 + Math.random() * 0.10; break; // Ras du filet
        case 'DRIVE':    y = 0.30 + Math.random() * 0.30; break; // Zone tendue
        default:         y = 0.5;
    }
    return { x, y };
    }

    getPreviousShotType(currentShotType) {
        const rand = Math.random() * 100;

        if (currentShotType === 'SMASH') return 'CLEAR';

        if (currentShotType === 'DRIVE') {
            if (rand < 50) return 'DRIVE';
            if (rand < 80) return 'CLEAR';
            if (rand < 95) return 'SMASH';
            return 'NET_DROP';
        }

        if (currentShotType === 'NET_DROP') {
            return rand < 30 ? 'NET_DROP' : 'DROP';
        }

        if (currentShotType === 'DROP') {
            return rand < 80 ? 'CLEAR' : 'DRIVE';
        }

        if (currentShotType === 'CLEAR') {
            if (rand < 40) return 'SMASH';
            if (rand < 70) return 'DROP';
            if (rand < 90) return 'CLEAR';
            return 'DRIVE';
        }

        return 'CLEAR';
    }
    /**
     * MODE TACTIQUE : Le joueur doit choisir le bon coup
     */
    generateTacticalScenario(hand) {
        let scenario = null;
        let attempts = 0;

        while (!scenario && attempts < 50) {
            attempts++;

            // 1. L'adversaire qui frappe (Opponent 1)
            const opp1Start = this.getRandomPos();
            const opp1Hand = this.getRandomHand();
            
            /// 2. Le coup de l'adversaire
            let possibleShots = ['CLEAR', 'SMASH', 'DROP', 'DRIVE'];
            const riverMeters = 1.98;
            const limitY = (riverMeters + 1.0) / 6.70; // ~0.44 en normalisé

            if (opp1Start.y <= limitY) {
                possibleShots.push('NET_DROP');
                possibleShots = possibleShots.filter(s => s !== 'SMASH');
            }

            const shotType = possibleShots[Math.floor(Math.random() * possibleShots.length)];
            const shotEnd = this.getRandomImpact(shotType);
            const incomingShot = { type: shotType, startPos: opp1Start, endPos: shotEnd, hasSpin : false };

            

            

            // 4. Position initiale basée sur le coup précédent du joueur/partenaire
            // On détermine ce que le camp du joueur a envoyé à Opp1 juste avant
            const prevType = this.getPreviousShotType(shotType);
            const prevShotContext = { type: prevType, endPos: opp1Start };

            // On simule qui a frappé le coup précédent (50/50 entre joueur et partenaire)
            const playerWasHitter = Math.random() > 0.5;

            // On récupère les positions idéales suite à ce coup précédent
            const playerPos = this.aiSpawn.getIdealPos(
                prevType, 
                opp1Start, 
                playerWasHitter, 
                (playerWasHitter) ? {x: 0.2, y: 0.5} : {x: 0.8, y: 0.5} , // Position fictive pour déterminer le côté gauche/droit
                (playerWasHitter) ? {x: 0.8, y: 0.5} : {x: 0.2, y: 0.5}
            );
            
            const team = [playerPos, (playerWasHitter)? {x: 0.8, y: 0.5} : {x: 0.2, y: 0.5} ];
            // 3. Le partenaire adverse (Opponent 2) - Position idéale
            const opp2Start = this.placement.evaluateGlobalPlacement(
                {x: 0.5, y: 0.5}, opp1Start, incomingShot, false, team
            ).ideal;
            

            // 5. VALIDATION : Le joueur peut-il intercepter ?
            // On utilise un reach standard (ex: 2.0m)
            const reachInfo = this.kinematicEngine.shotPossibility(shotType, opp1Start, {opp1: opp1Start, opp2: opp2Start}, 0.0);
            const reachMeters = reachInfo.allowedReach
            const impact = this.aiSpawn.getValidImpactPoint(incomingShot, playerPos, reachMeters, 0.0);

            const partnerPos = this.aiSpawn.getIdealPos(
                prevType, 
                opp1Start, 
                !playerWasHitter, 
                playerPos, 
                (playerWasHitter) ? {x: 0.8, y: 0.5} : {x: 0.2, y: 0.5} // On passe la position du joueur pour que l'équiper se place en fonction
            );

            const opp1Placements = this.aiSpawn.generateBestPlacement(incomingShot, opp1Start, opp2Start, true, 'N1', [playerPos, partnerPos]);
            const opp1Pos = opp1Placements; // On prend le meilleur pour un scénario fixe

            const opp2Placements = this.aiSpawn.generateBestPlacement(incomingShot, opp2Start, opp1Pos, false, 'N1', [playerPos, partnerPos]);
            const opp2Pos = opp2Placements; // On prend le meilleur pour un scénario fixe

            if (impact) {
                scenario = {
                    mode: 'TACTICAL',
                    incoming: incomingShot,
                    impactPoint: impact,
                    players: {
                        user: { pos: impact, hand: hand }, // Le joueur est l'utilisateur
                        partner: { pos: partnerPos, hand: this.getRandomHand() },
                        opponents: [
                            { posStart: opp1Start, posEnd : opp1Pos, hand: opp1Hand, isHitter: true },
                            { posStart: opp2Start, posEnd : opp2Pos , hand: this.getRandomHand(), isHitter: false }
                        ]
                    }
                };
            }
        }
        return scenario;
    }


    /**
     * MODE PLACEMENT : Le joueur doit se déplacer au bon endroit.
     * Le coup peut être joué par le joueur OU par son partenaire (50/50).
     */
    generatePlacementScenario() {
        // 1. Définir les positions de base pour tester la validité des coups (proximité filet)
        // On génère un point de départ temporaire pour tester si le KILL/NET_DROP est possible
        const tempPlayerPos = this.getRandomPos(0.2); 
        const opp1Start = this.getRandomPos(0.2);
        const opp2Start = { x: 1 - opp1Start.x, y: opp1Start.y };

        // 2. Détermination des coups possibles (Logique similaire à Tactical)
        let possibleShots = ['CLEAR', 'SMASH', 'DROP', 'DRIVE'];
        
        // Test de proximité pour KILL et NET_DROP (si le joueur est proche du filet)
        // On considère le filet à y=0 pour le joueur (en coordonnées normalisées inversées ou selon ton repère)
        // Si y < 0.30, il est assez proche pour agresser
        if (tempPlayerPos.y < 0.35) {
            possibleShots.push('KILL', 'NET_DROP');
            // Si on peut tuer au filet, le SMASH fond de court est exclu de la sélection
            possibleShots = possibleShots.filter(s => s !== 'SMASH');
        }

        const userShotType = possibleShots[Math.floor(Math.random() * possibleShots.length)];
        const userShotEnd = this.getRandomImpact(userShotType);
        const shotContext = { type: userShotType, startPos : tempPlayerPos, endPos: userShotEnd, hasSpin: false };

        // 3. Déterminer qui frappe (50% Joueur, 50% Partenaire)
        const isUserStriker = Math.random() > 0.5;

        // 4. Positions de départ cohérentes (Start)
        let playerStart, partnerStart;
        const isShortShot = ['KILL', 'NET_DROP'].includes(userShotType);

        if (isShortShot) {
            // Formation Filet/Fond
            playerStart = { x: 0.3 + Math.random() * 0.4, y: 0.10 + Math.random() * 0.15 };
            partnerStart = { x: 0.5, y: 0.7 };
        } else if (['SMASH', 'DROP'].includes(userShotType)) {
            // Formation Attaque (un devant, un derrière)
            playerStart = { x: 0.2 + Math.random() * 0.6, y: 0.7 + Math.random() * 0.2 };
            partnerStart = { x: playerStart.x, y: 0.3 };
        } else {
            // Défense neutre (Côte à côte avec léger décalage Y comme demandé)
            playerStart = this.getRandomPos(0.2);
            partnerStart = { 
                x: 1 - playerStart.x, 
                y: (playerStart.y < 0.5) ? playerStart.y + 0.25 : playerStart.y - 0.25 
            };
        }

        // Si le partenaire est le frappeur, on inverse les positions de départ
        if (!isUserStriker) {
            const temp = { ...playerStart };
            playerStart = { ...partnerStart };
            partnerStart = temp;
        }
        shotContext.startPos = isUserStriker ? playerStart : partnerStart;
        // 5. Calcul des réactions des adversaires (End)
        // 5. CALCUL DES RÉACTIONS DES ADVERSAIRES (CORRIGÉ)
        // Pour les adversaires, le replacement (posEnd) dépend de ce qu'ILS ont joué avant
        const prevOppType = this.getPreviousShotType(userShotType);
        
        // On crée le contexte du coup adverse précédent (ils ont visé le frappeur actuel)
        const strikerStartPos = isUserStriker ? playerStart : partnerStart;
        const prevOppShotContext = { 
            type: prevOppType, 
            startPos: opp1Start,
            endPos: strikerStartPos, 
            hasSpin: false 
        };


        // On calcule où ils finissent leur mouvement de replacement après LEUR coup
        // opp1 est considéré comme le frappeur du coup précédent (isHitter = true)
        const opp1End = this.aiSpawn.generateBestPlacement(
            prevOppShotContext, 
            opp1Start, 
            opp2Start, 
            true, 
            'N1', 
            [playerStart,partnerStart ]
        );

        const opp2End = this.aiSpawn.generateBestPlacement(
            prevOppShotContext, 
            opp2Start, 
            opp1Start, 
            false, 
            'N1', 
            [playerStart, partnerStart ]
        );

        const currentOpps = [ opp1End, opp2End ];

        // 6. Calcul du déplacement du partenaire
        // Si l'utilisateur frappe (isUserStriker=true), le partenaire est "l'autre" (isHitter=false)
        // Si le partenaire frappe (isUserStriker=false), le partenaire est "le frappeur" (isHitter=true)
        const partnerEval = this.placement.evaluateGlobalPlacement(
            partnerStart, 
            playerStart, 
            shotContext, 
            !isUserStriker, 
            currentOpps
        );

        // Note : On ne renvoie pas 'target' (playerEval.ideal) car DEV A le calculera dynamiquement.
        return {
            mode: 'PLACEMENT',
            isUserStriker: isUserStriker, // Indique au moteur qui a la main sur le coup
            playerStart: playerStart,
            partnerStart: partnerStart,
            partnerEnd: partnerEval.ideal,
            shotPlayed: shotContext,
            opponents: [
                { posStart: opp1End, hand: this.getRandomHand() },
                { posStart: opp2End, hand: this.getRandomHand() }
            ]
        };
    }
}