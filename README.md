# Badminton Strategy Game

Prototype web pour entrainer la strategie de double au badminton.

## Demarrage rapide

Le hub principal (`index.html`) charge des modules ES et s'appuie sur un backend local Express + SQLite pour l'authentification locale, les sessions, le profil, les preferences, les controles, la progression et l'historique de jeu.

```bash
npm install
npm run dev
```

Puis ouvre `http://localhost:3000`.

Le backend sert aussi les fichiers statiques du projet, dont `index.html` et `data/*.json`.

### Mode statique

Le backend est maintenant requis pour le flux complet, car le login local est obligatoire. Le mode statique reste utile pour inspecter les prototypes standalone, mais il ne represente plus l'experience app complete :

```bash
python3 -m http.server 4173
```

Puis ouvre `http://localhost:4173`.

### Tests

```bash
npm test
```

La suite couvre l'auth locale, les routes protegees, la persistence backend, la progression, le leaderboard personnel, le client API frontend et les helpers d'etat.

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

Cette version utilise une authentification locale email/mot de passe. Les mots de passe sont hashes avec `bcryptjs`, puis le serveur pose un cookie de session HTTP-only. Il n'y a pas encore d'OAuth, de reset email, ni de deploiement production.

La base locale est generee dans `server/data/rally.sqlite` et ignoree par git. Le schema est applique via migrations SQL versionnees dans `server/migrations`. SQLite reste le runtime local, avec une structure de tables separees qui pourra etre adaptee vers Postgres plus tard.

Routes principales :

- `GET /api/health`
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `PUT /api/auth/password`
- `GET /api/player/state`
- `PUT /api/player/profile`
- `PUT /api/player/preferences`
- `PUT /api/player/controls`
- `POST /api/player/drills/:drillId/start`
- `POST /api/player/controls/reset`
- `POST /api/player/reset-progression`
- `POST /api/game-sessions`
- `GET /api/game-sessions?period=weekly|all-time`
- `GET /api/player/drills`
- `GET /api/player/leaderboard?period=weekly|all-time`

Les resultats de rally sont envoyes a la fin d'une partie sans changer l'interface ingame. Ils alimentent XP, niveau, streak, temps d'entrainement, meilleurs scores, progression des drills et leaderboard personnel.
