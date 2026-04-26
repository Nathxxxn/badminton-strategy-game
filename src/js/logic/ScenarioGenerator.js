/**
 * Générateur de Scénarios Tactiques et Placement
 */
class ScenarioGenerator {
    constructor(tactical, placement, aiSpawn) {
        this.tactical = tactical;
        this.placement = placement;
        this.aiSpawn = aiSpawn;
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
    generateTacticalScenario() {
        let scenario = null;
        let attempts = 0;

        while (!scenario && attempts < 50) {
            attempts++;

            // 1. L'adversaire qui frappe (Opponent 1)
            const opp1Start = this.getRandomPos();
            const opp1Hand = this.getRandomHand();
            
            /// 2. Le coup de l'adversaire
            const possibleShots = ['CLEAR', 'SMASH', 'DROP', 'DRIVE'];
            const riverMeters = 1.98;
            const limitY = (riverMeters + 1.0) / 6.70; // ~0.44 en normalisé

            if (opp1Start.y <= limitY) {
                possibleShots.push('NET_DROP');
            }

            const shotType = possibleShots[Math.floor(Math.random() * possibleShots.length)];
            const shotEnd = this.getRandomImpact(shotType);
            const incomingShot = { type: shotType, startPos: opp1Start, endPos: shotEnd };

            // 3. Le partenaire adverse (Opponent 2) - Position idéale
            const opp2Pos = this.placement.evaluateGlobalPlacement(
                {x: 0.5, y: 0.5}, opp1Start, incomingShot, false
            ).ideal;

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
                {x: 0.2, y: 0.5}, // Position fictive pour déterminer le côté gauche/droit
                {x: 0.8, y: 0.5}
            );

            const partnerPos = this.aiSpawn.getIdealPos(
                prevType, 
                opp1Start, 
                !playerWasHitter, 
                playerPos, 
                {x: 0.5, y: 0.5} // On passe la position du joueur pour que l'équiper se place en fonction
            );

            // 5. VALIDATION : Le joueur peut-il intercepter ?
            // On utilise un reach standard (ex: 2.0m)
            const impact = this.aiSpawn.getValidImpactPoint(opp1Start, shotEnd, playerPos, 2.0, shotType);

            if (impact) {
                scenario = {
                    mode: 'TACTICAL',
                    incoming: incomingShot,
                    impactPoint: impact,
                    players: {
                        user: { pos: playerPos, hand: 'right' }, // Le joueur est l'utilisateur
                        partner: { pos: partnerPos, hand: this.getRandomHand() },
                        opponents: [
                            { pos: opp1Start, hand: opp1Hand, isHitter: true },
                            { pos: opp2Pos, hand: this.getRandomHand(), isHitter: false }
                        ]
                    }
                };
            }
        }
        return scenario;
    }

    /**
     * MODE PLACEMENT : Le joueur doit se déplacer au bon endroit après avoir frappé
     */
    generatePlacementScenario() {
        // 1. Position aléatoire du joueur (pas trop au bord)
        const playerPos = this.getRandomPos();

        // 2. Génération d'un coup pour le joueur
        const possibleShots = ['CLEAR', 'SMASH', 'DROP', 'DRIVE'];
        const riverMeters = 1.98;
        const limitY = (riverMeters + 1.0) / 6.70; // ~0.44 en normalisé

        if (playerPos.y <= limitY) {
            possibleShots.push('NET_DROP');
        }

        const userShotType = possibleShots[Math.floor(Math.random() * possibleShots.length)];
        const userShotEnd = this.getRandomImpact(userShotType);
        const shotContext = { type: userShotType, endPos: userShotEnd };

        // 3. Adversaires placés selon le coup qu'ils ont fait AVANT le coup du joueur
        const prevOppType = this.getPreviousShotType(userShotType);
        // Le point d'impact du coup précédent des adversaires est la position de départ du joueur
        const prevOppShotContext = { type: prevOppType, endPos: playerPos };

        // On simule quel adversaire a frappé le coup précédent
        const opp1WasHitter = Math.random() > 0.5;

        const opp1Pos = this.aiSpawn.getIdealPos(
            prevOppType, 
            playerPos, 
            opp1WasHitter, 
            {x: 0.2, y: 0.5}, 
            {x: 0.8, y: 0.5}
        );

        const opp2Pos = this.aiSpawn.getIdealPos(
            prevOppType, 
            playerPos, 
            !opp1WasHitter, 
            opp1Pos, 
            {x: 0.5, y: 0.5}
        );

        // 4. Partenaire du joueur (Logique de "l'attaque précédente")
        // On simule qu'il était en position d'attaque (ex: Smash)
        const isAttack = ['SMASH', 'DROP', 'KILL'].includes(userShotType);
        let partnerStart;
        
        if (isAttack) {
            // S'il attaque, le partenaire était probablement déjà en formation attaque (devant/derrière)
            partnerStart = this.placement.getIdealSmashPos(userShotEnd, playerPos.y < 0.5);
        } else {
            // Sinon, position de défense neutre
            partnerStart = { x: 1 - playerPos.x, y: playerPos.y }; 
        }

        return {
            mode: 'PLACEMENT',
            playerStart: playerPos,
            shotPlayed: shotContext,
            partnerStart: partnerStart,
            opponents: [
                { pos: opp1Pos, hand: this.getRandomHand() },
                { pos: opp2Pos, hand: this.getRandomHand() }
            ],
            // La solution attendue sera calculée par placement.evaluateGlobalPlacement
            target: this.placement.evaluateGlobalPlacement(playerPos, partnerStart, shotContext, true).ideal
        };
    }
}