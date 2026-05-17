# Match Mode — UI/Rendering Design Spec

**Date:** 2026-05-17  
**Author:** Developer A (Rendering & UI)  
**Status:** Approved

---

## Context

The game currently has a "Match" mode that loads static pre-built scenarios from `exercises.js` and chains them linearly — identical to drill mode. Developer B has delivered a complete `MatchEngine` (`src/js/logic/MatchEngine.js`, 1012 lines) that dynamically generates scenarios rally-by-rally using AI, kinematic, and tactical engines.

This spec describes how Developer A wires the MatchEngine into the existing rendering pipeline without touching Developer B's logic files.

**Developer B files (do not touch):**
- `src/js/logic/MatchEngine.js`
- `src/js/logic/AISpawnEngine.js`
- `src/js/logic/KinematicEngine.js`
- `src/js/logic/PlacementEngine.js`
- `src/js/logic/TacticalEngine.js`
- `src/js/logic/ExecutionEngine.js`
- `src/js/logic/RatingEngine.js`
- `src/js/logic/ScenarioGenerator.js`
- `src/js/logic/FeedbackEngine.js`

---

## Architecture

```
screens.js  →  main.js  →  match-adapter.js  →  MatchEngine (Dev B)
               runTurn ↑        ↓ translate
          startShotTurn     handleMatchScenario
      startPositioningTurn
```

**Key principle:** `runTurn`, `startShotTurn`, and `startPositioningTurn` in `main.js` are **unchanged**. The adapter translates MatchEngine's `{ mode: 'TACTICAL'|'PLACEMENT' }` format into the existing `{ type: 'shot'|'positioning' }` format those functions already understand.

**State ownership:** `MatchEngine.matchState` is the single source of truth for score, sets, fatigue, and `ratingDelta` during a match. `createMatchState` / `applyMatchPoint` from `match-runtime.js` are **not called** in match mode.

---

## Files Changed

| File | Action | Est. lines |
|------|--------|------------|
| `src/js/match-adapter.js` | **CREATE** | ~150 |
| `src/js/main.js` | **MODIFY** | +~80 |
| `src/js/screens.js` | No change | — |
| `src/js/match-runtime.js` | No change (exercise mode keeps it) | — |

---

## `src/js/match-adapter.js`

### MatchEngine Instantiation (Dev B's required order)

```js
const kinematic   = new KinematicEngine();
const placement   = new PlacementEngine(kinematic);
const tactical    = new TacticalEngine();
const execution   = new ExecutionEngine();
const rating      = new RatingEngine();
const aiSpawn     = new AISpawnEngine(tactical, placement, kinematic);
const scenarioGen = new ScenarioGenerator(tactical, placement, aiSpawn, kinematic);
const feedback    = new FeedbackEngine();
const engine      = new MatchEngine(tactical, placement, kinematic, execution, aiSpawn, rating);
```

Instantiated **once** at module level (singleton). All engines are reused across matches.

### `MatchAdapter` Class — Public API

```js
export class MatchAdapter {
  initMatch(playerTeam)              // calls engine.initMatch(playerTeam, 'QUICK_MATCH', 21)
  startRally()                       // calls engine.startRally(), returns translated result
  onShotPlayed(shot, incoming)       // calls engine.nextScenarioPostShot(...), returns translated result
  onPositionPlayed(pos, shotContext) // calls engine.nextScenarioPostMovement(pos, shotContext, 1)
  getMatchState()                    // returns engine.matchState
  isMatchOver()                      // returns engine.matchState.matchOver
}
```

`strikerId` is always `1` (the player) when `onPositionPlayed` is called — we never call `nextScenarioPostMovement` for the partner, that case is handled as an auto-play.

### Format Translation

**`TACTICAL` → `{ type: 'shot' }`:**

| MatchEngine field | Turn field |
|---|---|
| `players.user.pos` | `players.ally1: { x, y }` |
| `players.partner.pos` | `players.ally2: { x, y }` |
| `players.opponents[0].posEnd` | `players.opponent1: { x, y }` |
| `players.opponents[1].posEnd` | `players.opponent2: { x, y }` |
| `incoming.type` | `shuttlecock.type` |
| `incoming.startPos` | `shuttlecock.from` |
| `incoming.endPos` | `shuttlecock.position` |
| `reflectionTime` (ms) | `timeLimitMs` |
| `isServe: true` | `text: 'Serve — play a NET_CLEAR'` (instruction override) |
| — | `passingScore: 0` (no score gates in match) |

**`PLACEMENT` → `{ type: 'positioning' }`:**

| MatchEngine field | Turn field |
|---|---|
| `playerStart` | `players.ally1: { x, y }` |
| `partnerStart` | `players.ally2: { x, y }` |
| `opponents[0].posEnd` | `players.opponent1: { x, y }` |
| `opponents[1].posEnd` | `players.opponent2: { x, y }` |
| `shotPlayed.endPos` | `playedShuttle.position: { x, y }` |
| `reflectionTime` (ms) | `timeLimitMs` |
| — | `moveRadius: 2.5` (default metres, match-speed positioning) |
| — | `passingScore: 0` |

**Pass-through cases (returned as-is to `main.js`):**
- `{ rallyOver: true, winner, reason }` — rally ended, main.js handles point display
- `{ scenarios: [tacticalScen, placementScen] }` — partner-playing pair

**`shotContext` preservation:** Each translated turn carries `_raw` (the original MatchEngine scenario) so `onShotPlayed` and `onPositionPlayed` can extract the original `incoming` and `shotPlayed` fields to pass back to the engine.

---

## `src/js/main.js` Changes

### New State Vars

```js
let matchAdapter    = null;
let currentMatchTurn = null; // the raw MatchEngine scenario for the active turn
```

### `startWorkshop('match')` Rewrite

Replace the static `loadWorkshopRally('match')` call with:

```js
matchAdapter = new MatchAdapter();
matchAdapter.initMatch(buildPlayerInitPayload());
hud.showMatchHud(true);
hud.setMatchState(matchAdapter.getMatchState());
await showMatchReadyPrompt();
handleMatchScenario(matchAdapter.startRally());
```

`buildPlayerInitPayload()` already exists in `main.js` and returns `{ rank, rating, hand }`.

### `handleMatchScenario(scen)` — New Function

```js
async function handleMatchScenario(scen) {
  // Partner-playing pair: auto-play first, then handle second
  if (scen.scenarios) {
    await autoPlayPartnerTurn(scen.scenarios[0]);
    return handleMatchScenario(scen.scenarios[1]);
  }

  // Rally ended
  if (scen.rallyOver) {
    const winner = scen.winner === 1 ? 'player' : 'opp';
    await showPointResult({ winner, reason: scen.reason ?? '' });
    hud.setMatchState(matchAdapter.getMatchState());
    if (matchAdapter.isMatchOver()) {
      showEndScreen();
    } else {
      handleMatchScenario(matchAdapter.startRally());
    }
    return;
  }

  // Normal turn
  currentMatchTurn = scen;
  const turn = matchAdapter.translate(scen); // translate to runTurn format
  if (turn.type === 'shot')        startShotTurn(turn);
  else if (turn.type === 'positioning') startPositioningTurn(turn);
}
```

### Shot Intercept (in `onShotFired`, after feedback display)

```js
if (currentWorkshop === 'match' && matchAdapter) {
  const shotForEngine = {
    type: bridedShot.type,
    startPos: impactPoint,
    endPos: bridedShot.aimPoint,
    hasSpin: false,
  };
  const next = matchAdapter.onShotPlayed(shotForEngine, currentMatchTurn._raw.incoming);
  handleMatchScenario(next);
  return;
}
// existing: applyScore / nextTurn
```

### Positioning Intercept (after feedback display)

```js
if (currentWorkshop === 'match' && matchAdapter) {
  const next = matchAdapter.onPositionPlayed(pos, currentMatchTurn._raw.shotPlayed);
  handleMatchScenario(next);
  return;
}
// existing: applyScore / nextTurn
```

### `autoPlayPartnerTurn(scen)` — New Function

Render the partner scenario for 1.5 s then resolve:

```js
async function autoPlayPartnerTurn(scen) {
  const turn = matchAdapter.translate(scen);
  renderer.drawPlayers(turn.players);
  renderer.drawShuttlecock(turn.shuttlecock);
  await new Promise(r => setTimeout(r, 1500));
}
```

### End Screen

`showEndScreen()` already reads `currentMatchState?.ratingDelta`. For match mode, replace reads of `currentMatchState` with `matchAdapter.getMatchState()`. The `ratingDelta` and `winner`/`sets` fields are available directly from the MatchEngine state.

---

## Match Flow

```
startWorkshop('match')
  → matchAdapter.initMatch(playerProfile)
  → showMatchReadyPrompt()
  → handleMatchScenario(matchAdapter.startRally())

  ┌─ Normal scenario loop ─────────────────────────────────────────────┐
  │  startShotTurn(turn)                                                │
  │    player picks shot + drags                                        │
  │    onShotFired → matchAdapter.onShotPlayed → handleMatchScenario   │
  │                                                                     │
  │  startPositioningTurn(turn)                                         │
  │    player clicks court                                              │
  │    handler → matchAdapter.onPositionPlayed → handleMatchScenario   │
  └────────────────────────────────────────────────────────────────────┘

  ┌─ Partner-playing pair ─────┐     ┌─ Rally over ───────────────────┐
  │  autoPlayPartnerTurn(1.5s) │     │  showPointResult(winner)       │
  │  → handleMatchScenario [1] │     │  hud.setMatchState(...)        │
  └────────────────────────────┘     │  matchOver? → showEndScreen()  │
                                     │         no? → startRally()      │
                                     └────────────────────────────────┘
```

---

## Spin

Developer B confirmed `hasSpin` is not required for v1. Always pass `hasSpin: false` to MatchEngine methods. Do not show a spin selector UI.

---

## Score Display

The HUD already has `hud.setMatchState(state)`. After each rally end, call `hud.setMatchState(matchAdapter.getMatchState())`. The `state` object from the MatchEngine has:
- `state.score.teamA / teamB` — current set points
- `state.score.setsA / setsB` — sets won
- `state.matchOver` — match finished flag

Map `teamA` → player, `teamB` → opponent for HUD display. Verify the field names match what `hud.setMatchState` expects — if they differ, translate in `getMatchState()`.

---

## Open Questions (implementation-time)

1. Does `hud.setMatchState` expect `{ points: { player, opponent }, sets: { player, opponent } }` (match-runtime format) or `{ score: { teamA, teamB }, score: { setsA, setsB } }` (MatchEngine format)? Resolve by reading `hud.js` before wiring.
2. Does `showPointResult` already exist, or does it need to be created/confirmed? Check `main.js` around line 277.
3. `buildPlayerInitPayload()` returns `{ rank, rating, hand }` for one player — `initMatch` expects an array `[{ rank, rating, hand }, ...]`. **Resolution:** pass `[profile, { ...profile, hand: 'left' }]` as a reasonable partner default until a real partner profile is exposed.
4. `moveRadius` default of `2.5m` for match positioning — confirm with Dev B if MatchEngine provides a `moveRadius` in the PLACEMENT scenario. If it does, use that value instead.
