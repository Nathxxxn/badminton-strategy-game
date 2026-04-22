# Badminton Strategy Game

Prototype web pour entrainer la strategie de double au badminton.

## Demarrage rapide

Le hub principal (`index.html`) charge des modules ES. Utilise un petit serveur statique depuis la racine du projet :

```bash
python3 -m http.server 4173
```

Puis ouvre `http://localhost:4173`.

## Entrees disponibles

- `index.html` : hub principal avec parcours guide et liens vers les prototypes.
- `move-test.html` : sandbox standalone pour le deplacement.
- `shot-test.html` : sandbox standalone pour la mecanique de tir.
- `rally-test.html` : mini echange standalone pour valider le loop complet.

## Structure utile

- `data/*.json` : scenarios au format API charges par le loader runtime.
- `src/js/*` : version modulaire de l'app a faire evoluer.
- `src/css/style.css` : theme global, HUD et overlays.
- `CLAUDE.md` : spec projet et contexte produit.
- `GIT-ARCHITECTURE.md` : conventions git cibles.
- `docs/restart-baseline.md` : etat reel du depot au 2026-04-22 et nettoyage recommande.

## Git

`develop` est la branche d'integration actuelle. Avant de supprimer des refs locales ou des worktrees, lis `docs/restart-baseline.md`.
