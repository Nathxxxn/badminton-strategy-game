/**
 * Moteur de Placement - Badminton
 * Évaluation du placement d'un joueur en fonction du partenaire et du volant
 */

class PlacementEngine {
    constructor() {
        this.WIDTH = 6.10;
        this.HALF_LENGTH = 6.70;
        this.GRID_CELL = 0.5; // Taille d'une case pour référence
    }

    /**
     * Calcule la position idéale en défense après un Clear
     */
    getIdealDefensePos(shuttleLand, isPlayerLeft) {
        let ideal = { x: 0, y: 0.5 }; 

        const centerDist = shuttleLand.x - 0.5;

        if (isPlayerLeft) {
            if (centerDist < 0) { 
                const t = Math.abs(centerDist) / 0.4; 
                ideal.x = Math.max(0.1, 0.25 - (t * 0.10)); 
            } else { 
                const t = Math.abs(centerDist) / 0.4;
                ideal.x = Math.min(0.5, 0.25 + (t * 0.25));
            }
        } else {
            if (centerDist > 0) { 
                const t = Math.abs(centerDist) / 0.4;
                ideal.x = Math.min(0.90, 0.75 + (t * 0.10));
            } else { 
                const t = Math.abs(centerDist) / 0.4;
                ideal.x = Math.max(0.5, 0.75 - (t * 0.25));
            }
        }

        const isDiagonal = (shuttleLand.x < 0.5 && !isPlayerLeft) || (shuttleLand.x > 0.5 && isPlayerLeft);
        if (isDiagonal) {
            ideal.y = 0.5 - (0.65 / this.HALF_LENGTH);
        }

        return ideal;
    }

    /**
     * Calcule la position idéale après un Kill de notre équipe
     */
    getIdealKillPos(shuttleLand, isHitter) {
        let ideal = { x: 0.5, y: 0.3 };

        if (isHitter) {
            // Le joueur  a fait le Kill
            // Placement face au volant sur la ligne de rivière
            ideal.x = Math.max(0.2, Math.min(0.8, shuttleLand.x));
            ideal.y = 1.98 / this.HALF_LENGTH;
        } else {
            // Le joueur n'a pas fait le Kill (souvent depuis la mi-court ou filet)
            // Replacement face au volant, légèrement en soutien
            ideal.x = (shuttleLand.x < 0.5) ? Math.max(0.25, shuttleLand.x) : Math.min(0.75, shuttleLand.x) ;
            ideal.y = 4.5 / this.HALF_LENGTH;
        }
        return ideal;
    }

    /**
     * Calcule la position idéale après un Drive de notre équipe
     */
    getIdealDrivePos(shuttleLand, isHitter) {
        let ideal = { x: 0.5, y: 0.5 };

        if (isHitter) {
            // Celui qui a frappé avance au mi-terrain face au volant
            ideal.x = Math.max(0.2, Math.min(0.8, shuttleLand.x));
            ideal.y = 3.75 / this.HALF_LENGTH;
        } else {
            // Le partenaire : reste devant ou couvre la diagonale
            const isCentralDrive = Math.abs(shuttleLand.x - 0.5) < 0.2;
            
            if (isCentralDrive) {
                ideal.x = shuttleLand.x;
                ideal.y = 1.75 / this.HALF_LENGTH;
            } else {
                // Couvre la diagonale en se décalant vers le centre (effet pivot)
                const towardCenter = (shuttleLand.x < 0.5) ? -(Math.min(0.15,0.3-shuttleLand.x)) : (Math.min(0.15,shuttleLand.x-0.7));
                ideal.x = 0.5+towardCenter;
                ideal.y = 2.25 / this.HALF_LENGTH;
            }
        }
        return ideal;
    }

    /**
     * Calcule la position idéale après un Smash de notre équipe
     */
    getIdealSmashPos(shuttleLand, isHitter) {
        let ideal = { x: 0.5, y: 0.5 };

        if (isHitter) {
            // JOUEUR ARRIERE : Se replace un peu au centre
            // Si croisé ou décroisé, il garde un pied vers le volant (1/4 du carré)
            const sideFactor = (shuttleLand.x < 0.5) ? -0.125 : 0.125; 
            ideal.x = 0.5 + sideFactor;
            
            // Profondeur : Reste en soutien (environ 4.5m)
            ideal.y = 4.5 / this.HALF_LENGTH;
        } else {
            // JOUEUR AVANT : Chasseur
            // Se met devant son partenaire face au volant (max 2/3 du demi-terrain)
            ideal.x = Math.max(0.15, Math.min(0.85, shuttleLand.x));
            
            // Profondeur Smash : 1m derrière la ligne de service pour les drives
            ideal.y = 2.98 / this.HALF_LENGTH;
        }
        return ideal;
    }

    /**
     * Calcule la position idéale après un Drop (Amorti) de notre équipe
     */
    getIdealDropPos(shuttleLand, isHitter) {
        let ideal = { x: 0.5, y: 0.5 };

        if (isHitter) {
            // JOUEUR ARRIERE : Similaire au smash mais peut être plus avancé 
            // s'il a joué un drop lent
            const sideFactor = (shuttleLand.x < 0.5) ? -0.125 : 0.125;
            ideal.x = 0.5 + sideFactor;
            
            ideal.y = 4.0 / this.HALF_LENGTH;
        } else {
            // JOUEUR AVANT : Doit tuer le contre-amorti
            ideal.x = Math.max(0.2, Math.min(0.8, shuttleLand.x));
            
            // Profondeur Drop : Collé à la ligne de service (rivière)
            ideal.y = 1.98 / this.HALF_LENGTH;
        }
        return ideal;
    }

    /**
     * Calcule la position idéale après un Net Drop (Contre-amorti) de notre équipe
     * @param {Object} shuttleLand - Point d'impact chez l'adversaire {x, y}
     * @param {boolean} isHitter - Le joueur évalué est-il celui qui a fait le coup ?
     */
    getIdealNetDropPos(shuttleLand, isHitter) {
        let ideal = { x: 0.5, y: 0.5 };

        if (isHitter) {
            // JOUEUR AVANT : Reste au filet
            // Règle : Entre le point d'impact et 1m vers le milieu
            const shiftTowardCenter = (shuttleLand.x < 0.5) ? 0.08 : -0.08; // ~50cm vers le centre en normalisé
            ideal.x = Math.max(0.15, Math.min(0.85, shuttleLand.x + shiftTowardCenter));
            
            // Un peu devant la ligne de service (rivière à 1.98m)
            ideal.y = 1.70 / this.HALF_LENGTH;
        } else {
            // JOUEUR ARRIERE : Couverture
            // Règle : Se décale vers le centre si le partenaire est sur un côté
            const isExcentric = Math.abs(shuttleLand.x - 0.5) > 0.25;
            if (isExcentric) {
                // Se rapproche de la ligne médiane (0.5)
                ideal.x = 0.5 + (shuttleLand.x < 0.5 ? -0.1 : 0.1); 
            } else {
                ideal.x = 0.5;
            }

            // Règle : Environ 3.5m derrière le partenaire (1.70m + 3.0m = 4.70m)
            ideal.y = 4.70 / this.HALF_LENGTH;
        }
        return ideal;
    }

    calculateDistMeters(pos1, pos2) {
        const dx = (pos1.x - pos2.x) * this.WIDTH;
        const dy = (pos1.y - pos2.y) * this.HALF_LENGTH;
        return Math.sqrt(dx * dx + dy * dy);
    }

    calculateFormationScore(currentPos, idealPos, toleranceX, toleranceY) {
        const dx = Math.abs(currentPos.x - idealPos.x) * this.WIDTH;
        const dy = Math.abs(currentPos.y - idealPos.y) * this.HALF_LENGTH;

        if (dx <= toleranceX && dy <= toleranceY) return 100;

        const errX = Math.max(0, dx - toleranceX);
        const errY = Math.max(0, dy - toleranceY);
        const totalError = Math.sqrt(errX * errX + errY * errY);

        return Math.max(0, Math.round(100 - (totalError * 30)));
    }

    getPartnerDistanceScore(playerPos, partnerPos) {
        const distance = this.calculateDistMeters(playerPos, partnerPos);

        if (distance < 1.7) return 0;
        
        if (distance < 2.5) {
            const t = (distance - 1.7) / (2.5 - 1.7);
            return Math.round(t * 100);
        }

        if (distance <= 3.5) return 100;

        if (distance <= 6.0) {
            const t = (distance - 3.5) / (6.0 - 3.5);
            return Math.round(100 - (t * 100));
        }

        return 0;
    }

    /**
     * Déduit le rôle et la position initiale du joueur évalué
     * @param {Array} teamPlayers - Liste des 2 joueurs [{id, startX, startY}, ...]
     * @param {number} playerId - L'ID du joueur qu'on évalue
     * @param {number} hitterId - L'ID du joueur qui a frappé le volant
     */


    evaluateGlobalPlacement(playerPos, partnerPos, shotContext, isHitter) {
        const partnerScore = this.getPartnerDistanceScore(playerPos, partnerPos);
        
        const shotType = shotContext.type;
        const shuttleEndPos = shotContext.endPos;

        let idealPos;
        const isPlayerLeft = (playerPos.x < partnerPos.x);
        // 1. Déterminer la position idéale selon le type de coup
        switch (shotType) {
            case 'CLEAR':
                idealPos = this.getIdealDefensePos(shuttleEndPos, isPlayerLeft);
                break;
            case 'KILL':
                idealPos = this.getIdealKillPos(shuttleEndPos, isHitter);
                break;
            case 'DRIVE':
                idealPos = this.getIdealDrivePos(shuttleEndPos, isHitter);
                break;
            case 'SMASH':
                idealPos = this.getIdealSmashPos(shuttleEndPos, isHitter);
                break;
            case 'DROP':
                idealPos = this.getIdealDropPos(shuttleEndPos, isHitter);
                break;
            case 'NET_DROP':
                idealPos = this.getIdealNetDropPos(shuttleEndPos, isHitter);
                break;
            default:
                idealPos = { x: 0.5, y: 0.5 }; // Sécurité
        }


        // Définit des tolérances spécifiques au contexte (Attaque vs Défense)
        let tolX = 0.5;
        let tolY = 1.0;

        if (shotType === 'KILL' || shotType === 'DRIVE') {
            // En kill/drive, la précision latérale est souvent plus critique (fermer l'angle)
            tolX = 0.4;
            tolY = 0.6;
        }

        if (shotType === 'SMASH' || shotType === 'DROP') {
            // En attaque, la précision latérale est souvent plus critique (fermer l'angle)
            tolX = 1.0;
            tolY = 0.5;
        }

        const formationScore = this.calculateFormationScore(playerPos, idealPos, tolX, tolY);
        const finalScore = (partnerScore * 0.3) + (formationScore * 0.7);

        return {
            total: Math.round(finalScore),
            breakdown: {
                partner: partnerScore,
                formation: formationScore
            },
            realDistance: this.calculateDistMeters(playerPos, partnerPos).toFixed(2),
            ideal : {
                x : idealPos.x,
                y : idealPos.y,
            },
        };
    }
}
