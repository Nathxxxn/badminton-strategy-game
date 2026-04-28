# 📋 Spécifications & Roadmap UI/UX — DEV A

> **Document de référence pour le développement front-end**

---

## Légende des priorités

| Symbole | Signification |
|---------|---------------|
| `%` à `%%%%%` | Important → Critique/Bloquant |
| `#` à `#####` | Bonus → Très basse priorité/Cosmétique |

---

## 1. Mécaniques de jeu & contrôles (CRITIQUE)

| Priorité | Tâche | Détails |
|----------|-------|---------|
| `%%%%%` | **Nouveaux coups** | Ajouter impérativement les boutons/options `KILL` et `NET_DROP` dans l'interface de sélection. |
| `%%%%` | **Refonte du système de Drag** | Passer sur un drag "classique" (clic sur le point de départ → glisser vers le point d'arrivée). Indispensable pour le jeu rapide et les dégagements fond de court. |
| | | *Exception :* Le drag "inversé" peut être conservé **uniquement** en option pour le `NET_DROP`. Si le joueur l'utilise, envoyer un flag `isSpin: true` dans la payload (n'ajoute pas de points, mais augmente les chances de faute de l'IA). |
| `%%%` | **Zones d'impact dynamiques** *(Nouveau)* | Ne plus laisser le joueur cliquer n'importe où. Mettre en surbrillance les zones de la trajectoire adverse où le joueur **peut** prendre le volant. |
| | | *Côté logique :* Utiliser la fonction `getValidImpactPoint(shuttleStart, shuttleEnd, playerPos, reachMeters, shotType)` dans `AISpawnEngine.js`. Elle renvoie la liste des points autorisés (calculés au centième près selon la reach et le coup). |
| `%` | **Validation contextuelle des coups** | Griser/désactiver les types de coups impossibles dans le menu latéral en fonction de la trajectoire du volant (ex : impossible de smasher un volant sous le filet). Cf. `SHOT_PARAMS.type.allowed`. Cela évitera les fautes "Type de coup invalide". |

---

## 2. Le nouveau mode "Match" (CŒUR DU PROJET)

Ce mode passe d'une logique "Exercice" statique à une boucle en temps réel.

### Règles actuelles

- Matchs en **2 sets gagnants**
- **5 points par set**, 2 points d'écart (plafond à 11 points)
- Des scénarios de service où le joueur sert seront ajoutés plus tard

---

### Nouveaux éléments UI requis sur le terrain

- **Scoreboard complet** (Points, Sets)
- **Barres de fatigue** (deux pour le joueur et son partenaire, deux pour le duo adverse)
- **Timer dynamique visible** (barre de temps ou chrono)

---

### Logique du Timer

Le temps n'est plus fixe. **DEV B transmettra la limite de temps exacte à chaque nouveau scénario/coup.** Ce temps est calculé par le moteur selon :

- Le classement adverse
- La qualité de sa frappe précédente
- La difficulté du coup adverse

---

### 🔄 Flux de données (Front ↔ Logique)

| Direction | Étape | Données échangées |
|-----------|-------|-------------------|
| **Front → Logique** | Initialisation | Datas du joueur (classement FFBAD exact en points, main de raquette) |
| **Logique → Front** | Initialisation | Format du match + profils adverses générés (Styles : "Aggressive", "Backhand", etc.). **Note :** Stocker ces "styles" côté Front même si c'est juste du texte pour l'instant — l'IA s'en servira plus tard pour "typer" les joueurs. |
| **Front → Logique** | Boucle de jeu | Tout ce qui a été dit dans `API_SPEC` + flag si "spin" appliqué. Si le point est fini (chrono écoulé) : envoyer un `STOP` + point d'impact du volant. |
| **Logique → Front** | Boucle de jeu | Score mis à jour (si point fini), niveaux de fatigue (0-100), prochain scénario, nouveau timer alloué. |
| **Logique → Front** | Fin de match | Scores de placement, tactique, total + deltas de points pour l'affichage des récompenses. L'XP et les niveaux restent gérés côté Front. |

---

## 3. Affichage & rendu visuel sur le court

| Priorité | Tâche | Détails |
|----------|-------|---------|
| `%%` | **Mode Exercice — Feedback** | Ne plus enchaîner les scénarios automatiquement. Laisser l'écran figé avec la correction détaillée pour que le joueur puisse analyser. **Retirer la grande flèche** entre la position choisie et idéale (trop illisible pour les bons scores), ne garder que les pointillés avec la distance en texte. Pas de timer dans ce mode. *Changement :* le score idéal n'est plus renvoyé, le calcul a changé. |
| `%%` | **Différenciation des trajectoires** | Trouver un code visuel clair pour chaque coup. *Exemple (libre de faire mieux) :* |
| | | • **Drive** : Ligne pleine |
| | | • **Smash** : Double ligne |
| | | • **Kill** : Triple ligne ou double ligne grasse |
| | | • **Clear / Drop raté / Net Drop raté** : Courbe pleine |
| | | • **Drop** : Courbe en tirets |
| | | • **Net Drop** : Courbe courte pointillés |
| | | • **Net Drop (Spin)** : Courbe pointillés avec boucles/effets |
| `#` | **Visibilité des déplacements** | Mieux mettre en valeur les trajectoires de déplacement de l'IA et du partenaire, en particulier s'ils sont hors de la range du joueur (actuellement trop foncés/illisibles). |
| `#` | **Raquettes** | Afficher l'icône d'une raquette à côté du joueur (à droite pour droitier, à gauche pour gaucher) et inversement pour les adversaires. |
| — | **Difficulté pour les bons joueurs** | À partir de **R6** et au-delà : le point d'impact d'arrivée de la trajectoire du volant n'apparaît plus. Au-delà de **N3** : les boutons sur le côté ne sont plus grisés — si le joueur se trompe, c'est faute. Dans les deux cas, un pop-up explicatif s'affichera lorsque le joueur passe N3. |
| `#####` | **Noms des IA** | Remplacer les "B1" par de vrais prénoms sur le terrain (initiales sur les pastilles, prénoms complets dans le menu "Opponents"). Pour les très hauts classements, piocher dans des noms de vrais champions de bad. |

---

## 4. Menus & progression (hors match)

| Priorité | Tâche | Détails |
|----------|-------|---------|
| `%` | **Page Principale** | Remplacer les modes "Attack/Defense" par "Tactic/Placement". Garder les 3 modes visibles, revoir la description pour que ça matche. |
| `%` | **Page Drills** | Prévoir un encart "Tutoriel" ici. Inclure les déplacements, coups classiques, exemple de coups ratés, spin. |
| `%` | **Matchmaking Interclubs (Quotidien)** | Refonte du bonus journalier. Ajout d'un bouton pour lancer un match "Interclubs" 1×/jour. Match contre un duo de rang bien supérieur. La défaite fait perdre très peu de points, la victoire en fait gagner énormément. |
| `##` | **Couleurs des classements** | Appliquer le code couleur FFBAD sur le texte/badges : **Gris** (NC) · **Jaune** (P12-P10) · **Vert** (D9-D7) · **Bleu** (R6-R4) · **Rouge** (N3-N1). |
| `##` | **Page Leaderboards** *(si on a le temps)* | Créer 3 onglets : 1) Rating global FFBAD (en pts) · 2) Résultats Placement pur · 3) Résultats Tactique pure. Laisser la colonne "Weekly" pour voir la diff de points de la semaine. |
| `###` | **Header / Profil** | En haut à droite, inverser la disposition : Classement + Points à gauche, Lvl à droite. Le classement est l'info la plus importante. |
| `###` | **Page Drills** | Les icônes "Attack/Defense" peuvent aller ici. Ce mode servira plus tard à des entraînements thématiques très spécifiques (ex : "Smash-Follow") — pas d'enchaînement aléatoire de coups. |
| `#` | **Historique de Rating** | Au clic sur le badge de classement, ouvrir une modale/page avec un graphique (style BadNet) retraçant l'évolution des points sur les matchs officiels. Lignes horizontales marquant les seuils (ex : ligne de passage D9) + encarts affichant exactement le nombre de points (positif) avant le classement d'après et (négatif) pour retomber au classement du dessous. Attention au overflow au-dessus de N1 et en dessous de P12. Cf. exemple de tableau dans `MatchEngine.js`. |
| `#` | **Page Settings** | • Séparer l'UI du Compte (Mail, MDP) des Stats de performance (Winrate, Temps de jeu). |
| | | • Ne plus mettre le classement dans une "text box" éditable avec curseur. |
| | | • Ajouter un toggle "I am left handed". |
| | | • *(Optionnel)* Permettre de rebind les touches clavier. |
| `#` | **Stats Rapides** | Afficher le Winrate des 5 derniers matchs + le Lifetime Winrate sur la page d'accueil ou de profil. |

---

*Fin du document de spécifications.*
