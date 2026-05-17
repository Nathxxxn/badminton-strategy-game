# Badminton Strategy Game — Handover Documentation

## What was built

A browser-based badminton strategy game for doubles training. The player faces interactive drill scenarios on a Canvas-rendered court: they choose a shot type, drag to aim it, then reposition on the court. Each turn is scored on tactical accuracy, placement quality, and reaction speed.

The project runs as a Node/Express server (`npm run dev`, port 3000) serving a vanilla JS + Canvas 2D frontend. There is no build step — ES6 modules load directly via `index.html`.

---

## Architecture overview

```
index.html
  └─ src/js/main.js          ← orchestrator: turn loop, input wiring, score
       ├─ court.js            ← Court class, canvas resize, normalized coords
       ├─ renderer.js         ← draws players, shuttlecock, zone highlights
       ├─ drag.js             ← drag-to-aim mechanic
       ├─ animations.js       ← shot trajectory animation
       ├─ hud.js              ← score bar, timer, combo
       ├─ screens.js          ← menu/auth/home/end overlays
       ├─ exercises.js        ← scenario catalog loader (JSON + AI-generated)
       ├─ evaluate.js         ← placement + shot scoring
       ├─ tutorial.js         ← interactive onboarding
       └─ logic/              ← game logic engines (Developer B)
            ├─ KinematicEngine.js   ← shot trajectories, bounce physics
            ├─ PlacementEngine.js   ← ideal player positioning per shot type
            ├─ TacticalEngine.js    ← tactical decision scoring
            ├─ AISpawnEngine.js     ← AI opponent shot generation (rank-aware)
            ├─ ScenarioGenerator.js ← random scenario builder for drill mode
            ├─ MatchEngine.js       ← full match state machine (score, sets, fatigue)
            ├─ ExecutionEngine.js   ← shot execution quality
            ├─ RatingEngine.js      ← FFBAD-style rating delta after matches
            └─ FeedbackEngine.js    ← per-turn feedback messages

server/
  ├─ index.js     ← Express routes: auth, player state, game sessions, leaderboard
  ├─ db.js        ← SQLite via @libsql/client (local) or Turso (production)
  └─ migrations/  ← versioned SQL schema (auth, progression, drills, leaderboard)
```

**Coordinate system:** the court uses normalized `[0,1]²` coordinates. `(0,0)` is the opponent back-left corner; `(1,1)` is the ally back-right. The net sits at `y = 0.5`. `Court.toCanvas()` / `Court.toNormalized()` convert between the two systems.

---

## Key implemented features

| Feature | Files |
|---|---|
| Canvas court rendering (BWF doubles dimensions) | `court.js`, `renderer.js` |
| Drag-to-aim shot mechanic | `drag.js`, `main.js` |
| Shot type selector (7 types: SMASH, DROP, DRIVE, CLEAR, KILL, NET_DROP, NET_CLEAR) | `shot-type-selector.js` |
| Zone system (18 zones, 3×3 per half) | `zones.js` |
| Kinematic trajectories + arc animation | `kinematic-engine.js`, `animations.js` |
| Rank-aware AI opponent (12 FFBAD ranks, N1–P12) | `AISpawnEngine.js` |
| Placement scoring (how well the player repositioned) | `PlacementEngine.js`, `evaluate.js` |
| Tactical scoring (was the shot choice correct?) | `TacticalEngine.js`, `evaluate.js` |
| Drill mode with random scenarios | `ScenarioGenerator.js`, `exercises.js` |
| Static scenario catalog (JSON) | `data/positioning.json`, `data/shots.json` |
| Interactive tutorial (5 steps, arrow overlays) | `tutorial.js`, `tutorial.css` |
| Local auth (signup/login, bcrypt, HTTP-only session cookie) | `server/index.js`, `server/db.js` |
| Player profile + XP + progression | `server/progression.js`, migrations |
| Game session history + personal leaderboard | `server/index.js`, migration 002 |
| Match state machine (score, sets, fatigue) — logic complete | `MatchEngine.js` |
| Rendering adapter for match mode — designed, not yet wired | `match-adapter.js` (stub) |

---

## What remains to be done

### 1. Wire match mode into the rendering pipeline

The `MatchEngine` (1 012 lines, fully implemented) runs a complete doubles match — score, sets, fatigue, rating delta — and generates scenarios rally by rally. It is **not yet connected** to the frontend rendering loop.

The integration design is fully specified in `docs/superpowers/specs/2026-05-17-match-mode-design.md`. The work splits into two files:

**`src/js/match-adapter.js`** (~150 lines, to create)  
Instantiates all logic engines once (singleton), exposes:
- `initMatch(playerTeam)` — calls `MatchEngine.initMatch`
- `startRally()` — calls `engine.startRally()`, translates result to turn format
- `onShotPlayed(shot, incoming)` — calls `engine.nextScenarioPostShot(...)`
- `onPositionPlayed(pos, shotContext)` — calls `engine.nextScenarioPostMovement(...)`
- `translate(scen)` — converts MatchEngine's `{ mode: 'TACTICAL'|'PLACEMENT' }` into `{ type: 'shot'|'positioning' }` that `main.js` already understands

**`src/js/main.js`** (~80 lines to add)  
- `startWorkshop('match')` rewrite: instantiates MatchAdapter, calls `initMatch`, then enters `handleMatchScenario(adapter.startRally())`
- `handleMatchScenario(scen)` new function: routes to `startShotTurn` / `startPositioningTurn`, handles rally-over and partner auto-play
- Two intercept blocks (after shot feedback, after positioning feedback) that forward results to the adapter instead of the current exercise flow

The existing `startShotTurn` and `startPositioningTurn` functions in `main.js` are **unchanged** — the adapter speaks their format.

### 2. Specialized drill scenarios (replacing purely random generation)

Currently every drill scenario is generated at random by `ScenarioGenerator.js`. Players with specific weaknesses get no targeted repetition.

The improvement: a catalog of **named drill sequences** organized by tactical theme. Examples:

| Drill name | Scenario chain |
|---|---|
| *Smash defense rotation* | SMASH received mid-court → reposition defense → CLEAR reply |
| *Net duel* | NET_DROP → NET_DROP reply → lift to back → SMASH |
| *Side pressure* | Wide DRIVE → cross-court reply → split-step reposition |
| *Third-shot attack* | Serve → NET_CLEAR → SMASH opportunity |

Implementation: add a `drills/` folder with one JSON file per theme. Each file defines a sequence of `{ shotType, incomingFrom, targetZone, nextShotContext }` steps. `exercises.js` loads these the same way it loads `data/shots.json` today. The drill lobby screen (already built) adds a filter chip per theme; selecting one locks `loadWorkshopRally` to that catalog.

### 3. AI trained on real match data to make scenarios educationally relevant

The current `AISpawnEngine` generates opponent shots using a hand-coded probability table per shot type and rank. Scenarios feel plausible but are not grounded in how real elite players actually build rallies.

The improvement: replace (or augment) those probability tables with weights extracted from real match data.

**Data source:** BWF publicly posts rally-by-rally shot logs for World Tour events. A match in `data/matches.json` already captures the schema used in this project.

**Training pipeline (outline):**
1. Parse BWF shot logs into `(shotType, courtZone, score, fatigue, rank) → (nextShotType, targetZone)` transition tuples
2. Fit a simple conditional probability table (or a small decision-tree) over those transitions — no GPU required
3. Export as a JSON weight file (e.g., `data/shot-transitions.json`)
4. In `AISpawnEngine.js`, replace `Math.random() < 0.5` style branching with a weighted sample drawn from `shot-transitions[currentShotType][zone]`

The result: opponent AI would replicate real elite patterns — e.g., after a tight cross-court net drop, the most likely real reply is a fast lift to the back corner, not a smash. That makes drill content genuinely instructive rather than statistically plausible but tactically hollow.

A stretch version of this uses a small language model fine-tuned on the same data to generate *commentary* explaining why a given reply was the textbook choice, displayed as the feedback message after each turn.

---

## Running the project locally

```bash
npm install
npm run dev        # starts Express on port 3000
# open http://localhost:3000

npm test           # Node built-in test runner, no Jest needed
```

Environment variables (see `.env.example`):
- `PORT` — defaults to 3000
- `DATABASE_URL` — Turso connection string for production; omit for local SQLite
- `DATABASE_AUTH_TOKEN` — Turso token (production only)
- `NODE_ENV` — set to `production` on Render

The local SQLite file (`server/data/rally.sqlite`) is git-ignored. Migrations run automatically on server start.

---

## File ownership

| Owner | Scope |
|---|---|
| Developer A (Rendering & UI) | `index.html`, `src/css/`, `src/js/court.js`, `src/js/renderer.js`, `src/js/drag.js`, `src/js/animations.js`, `src/js/hud.js`, `src/js/screens.js`, `src/js/tutorial.js`, `src/js/ui-feedback.js`, `src/js/timer.js`, `src/js/zones.js`, `src/js/shot-type-selector.js`, `src/js/match-adapter.js` |
| Developer B (Logic & Data) | `src/js/logic/*.js`, `src/js/exercises.js`, `src/js/evaluate.js`, `src/js/match-runtime.js`, `data/*.json`, `server/`, `server/migrations/` |
| Shared (coordinate before editing) | `src/js/main.js`, `src/js/app-state.js`, `src/js/api-client.js` |
