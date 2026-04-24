# Badminton Strategy Game

Prototype web pour entrainer la strategie de double au badminton.

## Demarrage rapide

Le hub principal (`index.html`) charge des modules ES et peut maintenant s'appuyer sur un backend local Express + SQLite pour persister le profil, les preferences et la progression.

```bash
npm install
npm run dev
```

Puis ouvre `http://localhost:3000`.

Le backend sert aussi les fichiers statiques du projet, dont `index.html` et `data/*.json`.

### Mode statique

Le frontend garde un fallback `localStorage` si le backend n'est pas disponible. Pour lancer uniquement la partie statique :

```bash
python3 -m http.server 4173
```

Puis ouvre `http://localhost:4173`.

### Tests

```bash
npm test
```

La suite couvre la persistence backend, le client API frontend et le fallback local.

## Entrees disponibles

- `index.html` : hub principal avec parcours guide et liens vers les prototypes.
- `move-test.html` : sandbox standalone pour le deplacement.
- `shot-test.html` : sandbox standalone pour la mecanique de tir.
- `rally-test.html` : mini echange standalone pour valider le loop complet.

## Structure utile

- `data/*.json` : scenarios au format API charges par le loader runtime.
- `server/index.js` : serveur Express local et routes `/api/*`.
- `server/db.js` : persistence SQLite du profil/progression.
- `server/data/rally.sqlite` : base locale generee au runtime, ignoree par git.
- `src/js/*` : version modulaire de l'app a faire evoluer.
- `src/css/style.css` : theme global, HUD et overlays.
- `CLAUDE.md` : spec projet et contexte produit.
- `GIT-ARCHITECTURE.md` : conventions git cibles.
- `docs/restart-baseline.md` : etat reel du depot au 2026-04-22 et nettoyage recommande.

## Git

`develop` est la branche d'integration actuelle. Avant de supprimer des refs locales ou des worktrees, lis `docs/restart-baseline.md`.

## Backend local

Cette version n'a pas encore d'authentification. Le backend utilise un seul joueur local avec l'identifiant interne `default`.

Routes principales :

- `GET /api/health`
- `GET /api/player/state`
- `PUT /api/player/profile`
- `PUT /api/player/preferences`
- `POST /api/player/drills/:drillId/start`
- `POST /api/player/controls/reset`
