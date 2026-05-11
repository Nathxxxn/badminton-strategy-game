🏸 Spécifications API : Moteurs Logiques vs Interface UI

Ce document définit les protocoles d'échange de données pour le simulateur de Badminton entre le Moteur Logique (IA) et l'Interface Utilisateur (UI/DEV A).
1. Conventions Générales

    Système de Coordonnées : Normalisé de 0.0 à 1.0.

        X : 0.0 (Gauche) à 1.0 (Droite). Largeur réelle : 6.10m.

        Y : 0.0 (Filet) à 1.0 (Fond de court). Longueur demi-terrain : 6.70m.

    Référentiel : Les calculs se font sur le demi-terrain du joueur actif.

    Types de Coups (ShotType) : SMASH, KILL, DRIVE, DROP, NET_DROP, CLEAR.

    Classements : Échelle de P12 à N1. Le classement impacte le Timer (UI) et les Probabilités de réussite/Fatigue (Logique).

2. Mode EXERCICE : TACTIQUE
A. Input de Scénario (Logique → UI)

    positions : { player, partner, opp1, opp2 } (coordonnées {x, y}).

    incomingShuttle : { startPos, endPos, type }.

    opponentsMovement : Déplacements initiaux des deux adversaires.

    equipment : Mains de raquette ('left'|'right') pour les 4 joueurs.

    playerReach : Rayon de portée autorisé pour frapper le volant (en mètres).

B. Sortie Utilisateur (UI → Logique)

L'UI doit renvoyer l'état complet au moment de la frappe :

    shuttleType : Type de coup choisi par le joueur.

    shuttleEndPos : Point d'arrivée visé par le joueur.

    impactPoint : Coordonnées {x, y} où le volant a été touché (dans la reach).

    opponentsPos : Positions finales des 2 adversaires au moment de la frappe.

    oppShotType : Le type de coup que l'adversaire avait envoyé.

    oppHands : Rappel des mains des adversaires.

C. Retour d'Analyse (Logique → UI)

    totalScore : Note sur 100.

    correction : { type, endPos, score } (Meilleur coup possible).

    messages : Array de strings (ex: ["Bien joué ! Revers adverse visé.", "Mauvais Clear : trop court"]).

    details : { reachMeters, breakdown: { placement, bonus }, bestShotScore }.

3. Mode EXERCICE : PLACEMENT
A. Input de Scénario (Logique → UI)

    positions : Positions initiales des 4 joueurs.

    playedShuttle : Trajectoire du volant qui part (frappé par notre équipe).

    partnerMovement : Déplacement calculé du partenaire.

    isHitter : Boolean (True si le joueur est celui qui a frappé le volant).

    moveRadius : Rayon de déplacement possible (en mètres).

B. Sortie Utilisateur (UI → Logique)

    playerFinalPos : Position d'arrivée choisie par le joueur.

    partnerFinalPos : Position finale du partenaire.

    playedShuttle : Rappel du volant qui partait.

    isHitter : Rappel du rôle du joueur.

C. Retour d'Analyse (Logique → UI)

    totalScore : Note globale (0-100).

    idealPosition : Coordonnées {x, y} du placement parfait.

    message : Alerte String si distance partenaire < 2.5m ou > 3.5m.

    details : { breakdown: {partner, formation}, realDistance }.

4. Mode MATCH (Boucle de jeu)
A. Initialisation

    UI → Logique : Classement du joueur (rank, points).

    Logique → UI : Premier scénario de service (Tactique).

B. Flux Continu (Succession de scénarios)

Le match n'est pas une simple analyse, mais une série de scénarios générés dynamiquement :

    Phase Tactique : Le joueur choisit son coup.

    Phase Placement : La Logique envoie le scénario de placement basé sur le coup précédent.

    Continuité : La Logique envoie la fatigue et la longueur du rally (rallyLength).

    Note : La Logique peut modifier la trajectoire réelle (fatigue/erreur) avant de l'envoyer dans le scénario suivant.

5. Gestion des interruptions et Fin
A. Fin de Point (STOP)

La Logique envoie un signal de fin de point avec les informations suivantes :

    status : "STOP"

    reason : "NET" (filet), "OUT" (dehors), "FAULT" (faute).

    winner : "player" ou "opp".

    Cas Spécial Timer (UI) : Si le temps expire :

        Placement : L'UI envoie positionInitiale comme positionFinale.

        Tactique : Le point s'arrête (le volant touche le sol), l'UI détermine le vainqueur selon la zone d'impact.

B. Fin de Match (Statistiques Globales)

L'UI reçoit le bilan complet pour l'écran final :

    winner : Vainqueur du match.

    scoreMatch : Score final (ex: 21-18).

    Stats (Nombres entiers) :

        scoreTotal (moyenne).

        scoreFinalTactique / scoreFinalPlacement.

        totalBonus / totalMalus.

        countBackhandHits : Nombre de volants sur le revers.

        countBodyHits : Nombre de volants au corps.

        countTooClose / countTooFar : Erreurs de distance partenaire.

    Progression : { oldRank, newRank, oldPoints, newPoints }.

6. Répartition des Responsabilités
Domaine	            Responsabilité UI (DEV A)	                            Responsabilité LOGIQUE (DEV B)
Timer	            Définit et gère le temps selon le classement.	        Reçoit le résultat par défaut si temps expiré.
Mouvement	        Contraint le joueur dans le moveRadius ou reach.	    Calcule la fatigue selon la distance réelle.
Validité	        Empêche de viser en dehors du terrain en exercice.	    Calcule les probabilités d'erreur en match.
Graphismes	        Affiche les pop-ups (Revers/Corps) et animations.	    Fournit les messages et les drapeaux (booleans).
Match	            Enchaîne les écrans et gère les clics.	                Génère les scénarios successifs et le score match.