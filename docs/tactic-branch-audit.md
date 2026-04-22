# Audit de `origin/tactic` — 2026-04-22

## Constat

La branche `origin/tactic` porte bien le coeur logique du travail de DEV B, mais elle n'est pas mergeable telle quelle dans `develop`.

Points observes :

- divergence historique forte avec `develop` depuis `79f20c9` (`feat: initial project setup`)
- fichiers poses a la racine, sans integration avec `src/js`
- pas d'exports ES modules
- `TacticalEngine.js` reassignait `tooClose` et `tooShort` alors qu'ils etaient declares en `const`
- `FeedbackEngine.js` lisait `player.type` alors que `TacticalEngine` ne le renvoyait pas
- `FeedbackEngine.js` renvoyait `distanceToPartner` au lieu de `realDistance`
- `JSON.js` etait encore sur un format de scenario plus ancien que l'API finale
- aucun branchement runtime avec le renderer, le HUD, les payloads UI ou le flux de rally actuel

## Decisions d'integration

Au lieu de merger la branche brute, l'integration retenue dans `develop` est :

- port des moteurs dans `src/js/logic/`
- conservation du contrat actuel UI, avec une couche `src/js/evaluate.js`
- conversion explicite UI -> logique via `payload-builder.js` + `coord-adapter.js`
- preparation des turns via `prepareTurnForRuntime()` pour supporter :
  - les mocks render-ready actuels
  - les futurs scenarios au format logique via `adaptExercise()`
- conservation des mocks existants comme jeu de transition, avec quelques metadonnees de scenario

## Ajustements faits pour la base actuelle

- activation de l'evaluation tactique et placement dans `main.js`
- activation effective de `moveRadius` cote UI
- correction de `deriveShuttleType()` pour ne plus produire de coups absurdes sur la profondeur adverse
- preservation des champs logiques dans `adaptExercise()` (`positions`, `incomingShuttle`, `playedShuttle`)
- conversion des champs imbriques manquants dans `payloadToLogic()` (`opponentsPos`, `playedShuttle`)
- calibration minimale des seuils de reussite sur deux vieux mocks encore imparfaits

## Risques residuels

- les scenarios mock historiques n'ont pas ete authored pour ce moteur logique ; certains restent des approximations de transition
- `origin/tactic` n'apporte toujours pas de vrai loader de scenarios, seulement le moteur
- le timer existe dans le repo mais n'est pas encore branche sur le flux principal
- les futurs scenarios reels de DEV B devront etre verifies des leur premiere livraison, surtout sur :
  - `incomingShuttle.type`
  - `playedShuttle.type`
  - `equipment`
  - `moveRadius`
  - `playerReach`
