# Match Mode — MatchEngine Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Developer B's `MatchEngine` into the existing rendering pipeline via a thin `match-adapter.js` so match mode uses live AI-generated scenarios instead of static drill scenarios.

**Architecture:** A new `MatchAdapter` class (in `src/js/match-adapter.js`) instantiates all of Dev B's logic engines in the required order and translates MatchEngine's `{ mode: 'TACTICAL'|'PLACEMENT' }` format into the existing `{ type: 'shot'|'positioning' }` format that `startShotTurn`/`startPositioningTurn` already understand. `main.js` gets a `handleMatchScenario` dispatcher that drives the turn loop, and match-mode intercepts in `onShotFired` / `onPositionClick` that pass player actions back to the engine instead of calling `applyScore/nextTurn`.

**Tech Stack:** Vanilla ES6 modules, no build step. Canvas 2D, existing Court/Renderer/HUD infrastructure.

---

## File Map

| File | Change |
|------|--------|
| `src/js/match-adapter.js` | **CREATE** — singleton engines, `MatchAdapter` class, format translation |
| `src/js/main.js` | **MODIFY** — import, 2 new state vars, `handleMatchScenario`, `autoPlayPartnerTurn`, match branch in `startGame`, shot intercept, positioning intercept, `nextTurn` timeout patch, `handleStopSignal` patch, `showEndScreen` patch |

**Do not touch:** any file under `src/js/logic/` — those are Developer B's files.

---

## Task 1: Create `src/js/match-adapter.js`

**Files:**
- Create: `src/js/match-adapter.js`

- [ ] **Step 1: Create the file with all engines and the MatchAdapter class**

`src/js/match-adapter.js`:
```js
import { KinematicEngine }   from './logic/KinematicEngine.js';
import { PlacementEngine }   from './logic/PlacementEngine.js';
import { TacticalEngine }    from './logic/TacticalEngine.js';
import { ExecutionEngine }   from './logic/ExecutionEngine.js';
import { RatingEngine }      from './logic/RatingEngine.js';
import { AISpawnEngine }     from './logic/AISpawnEngine.js';
import { ScenarioGenerator } from './logic/ScenarioGenerator.js';
import { FeedbackEngine }    from './logic/FeedbackEngine.js';
import { MatchEngine }       from './logic/MatchEngine.js';

// Singleton engines — instantiated once, reused across matches.
// Order is required by Developer B; do not reorder.
const kinematic   = new KinematicEngine();
const placement   = new PlacementEngine(kinematic);
const tactical    = new TacticalEngine();
const execution   = new ExecutionEngine();
const rating      = new RatingEngine();
const aiSpawn     = new AISpawnEngine(tactical, placement, kinematic);
const scenarioGen = new ScenarioGenerator(tactical, placement, aiSpawn, kinematic);
const feedback    = new FeedbackEngine();
const engine      = new MatchEngine(tactical, placement, kinematic, execution, aiSpawn, rating);

export class MatchAdapter {
  /** Call before startRally(). profile = { rank, rating, racketHand } */
  initMatch(profile) {
    const player = { rank: profile.rank, rating: profile.rating, hand: profile.racketHand ?? 'right' };
    const partner = { ...player, hand: 'left' };
    engine.initMatch([player, partner], 'QUICK_MATCH', 21);
  }

  /** Returns translated scenario or { scenarios: [...] } or { rallyOver: true }. */
  startRally() {
    return this._process(engine.startRally());
  }

  /**
   * Call after player fires a shot.
   * @param {{ type: string, startPos: {x,y}, endPos: {x,y}, hasSpin: boolean }} shot
   * @param {object} incoming  — the raw incoming field from the current TACTICAL scenario
   */
  onShotPlayed(shot, incoming) {
    return this._process(engine.nextScenarioPostShot(shot, incoming));
  }

  /**
   * Call after player clicks a position.
   * @param {{ x: number, y: number }} pos  — normalized court position
   * @param {object} shotContext  — the raw shotPlayed field from the current PLACEMENT scenario
   */
  onPositionPlayed(pos, shotContext) {
    return this._process(engine.nextScenarioPostMovement(pos, shotContext, 1));
  }

  /**
   * Translate a raw MatchEngine scenario into the turn format expected by
   * startShotTurn / startPositioningTurn.
   */
  translate(scen) {
    if (scen?.mode === 'TACTICAL')  return this._tacticalToTurn(scen);
    if (scen?.mode === 'PLACEMENT') return this._placementToTurn(scen);
    return scen;
  }

  /**
   * Returns a state object shaped for hud.setMatchState().
   * hud expects: { points:{player,opponent}, sets:{player,opponent}, fatigue:{player,partner,opponent1,opponent2} }
   * MatchEngine uses: { score:{teamA,teamB,setsA,setsB}, players:{1,2,3,4}.fatigue (0–1) }
   */
  getMatchState() {
    const ms = engine.matchState;
    if (!ms) return null;
    return {
      points: {
        player:   ms.score?.teamA ?? 0,
        opponent: ms.score?.teamB ?? 0,
      },
      sets: {
        player:   ms.score?.setsA ?? 0,
        opponent: ms.score?.setsB ?? 0,
      },
      winner: ms.matchOver
        ? ((ms.score?.setsA ?? 0) >= (ms.score?.setsB ?? 0) ? 'player' : 'opponent')
        : null,
      ratingDelta: ms.matchReport?.finalStats?.pointsGained ?? null,
      fatigue: {
        player:    this._hudFatigue(1),
        partner:   this._hudFatigue(2),
        opponent1: this._hudFatigue(3),
        opponent2: this._hudFatigue(4),
      },
    };
  }

  isMatchOver() {
    return !!engine.matchState?.matchOver;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  /** MatchEngine fatigue: 0.0 = fresh → 1.0 = exhausted. HUD wants 0–100 fresh = 100. */
  _hudFatigue(id) {
    const f = engine.players?.[id]?.fatigue ?? 0;
    return Math.round((1 - Math.min(1, Math.max(0, f))) * 100);
  }

  /**
   * Normalise any result from nextScenarioPost* / startRally:
   * - pass rallyOver through unchanged
   * - wrap scenarios array sub-items (no mutation)
   * - attach the raw MatchEngine scenario as ._raw for use in intercepts
   */
  _process(result) {
    if (!result) return { rallyOver: true, winnerId: 3, reason: 'ENGINE_NULL' };
    if (result.rallyOver) return result;
    if (result.scenarios) {
      return { scenarios: result.scenarios };
    }
    // Normal single scenario — attach raw reference for intercepts
    return Object.assign(Object.create(null), result, { _raw: result });
  }

  _tacticalToTurn(scen) {
    const inc = scen.incoming ?? {};
    return {
      type: 'shot',
      label: scen.isServe ? 'Service' : 'Attack',
      text: scen.isServe
        ? 'Service — play a NET_CLEAR to open the rally.'
        : 'Choose your shot and aim precisely.',
      players: {
        ally1:     scen.players?.user?.pos            ?? { x: 0.50, y: 0.80 },
        ally2:     scen.players?.partner?.pos         ?? { x: 0.30, y: 0.70 },
        opponent1: scen.players?.opponents?.[0]?.posEnd ?? { x: 0.40, y: 0.20 },
        opponent2: scen.players?.opponents?.[1]?.posEnd ?? { x: 0.65, y: 0.20 },
      },
      shuttlecock: {
        from:     inc.startPos ?? { x: 0.50, y: 0.10 },
        position: inc.endPos   ?? { x: 0.50, y: 0.65 },
        type:     inc.type     ?? 'CLEAR',
        speed:    'medium',
      },
      timeLimitMs:  scen.reflectionTime ?? 8000,
      passingScore: 0,
    };
  }

  _placementToTurn(scen) {
    return {
      type: 'positioning',
      label: 'Recovery',
      text: 'Move to recover your court position.',
      players: {
        ally1:     scen.playerStart              ?? { x: 0.50, y: 0.90 },
        ally2:     scen.partnerStart             ?? { x: 0.70, y: 0.80 },
        opponent1: scen.opponents?.[0]?.posEnd   ?? { x: 0.40, y: 0.20 },
        opponent2: scen.opponents?.[1]?.posEnd   ?? { x: 0.65, y: 0.20 },
      },
      playedShuttle: {
        position: scen.shotPlayed?.endPos ?? { x: 0.50, y: 0.20 },
      },
      moveRadius:   2.5,
      playerReach:  1.8,
      timeLimitMs:  scen.reflectionTime ?? 8000,
      passingScore: 0,
    };
  }
}
```

- [ ] **Step 2: Verify the file loads without import errors**

Open `http://localhost:3000` in a browser (run `npm run dev` if not already running), open the DevTools console, and check there are no module resolution errors for `match-adapter.js`. The file is not yet imported anywhere so no errors are expected — this just confirms the logic engines are importable.

- [ ] **Step 3: Commit**

```bash
git add src/js/match-adapter.js
git commit -m "feat(match): add MatchAdapter — engine instantiation + format translation"
```

---

## Task 2: Add state vars, `handleMatchScenario`, and `autoPlayPartnerTurn` to `main.js`

**Files:**
- Modify: `src/js/main.js`

- [ ] **Step 1: Add the import at the top of `main.js` (after the existing imports, around line 36)**

Find this block in `main.js`:
```js
import { TacticalEngine }        from './logic/TacticalEngine.js';
import {
```

Add the new import directly after `import { TacticalEngine }`:
```js
import { TacticalEngine }        from './logic/TacticalEngine.js';
import { MatchAdapter }          from './match-adapter.js';
import {
```

- [ ] **Step 2: Add two new state vars (around line 129, right after `_tutorialGoalCenter`)**

Find:
```js
/** @type {Array|null} Active rally turn list */
let currentRally    = null;
```

Add two lines immediately before it:
```js
/** MatchEngine adapter — non-null only during match mode */
let matchAdapter     = null;
/** Raw MatchEngine scenario for the active match turn (TACTICAL or PLACEMENT) */
let currentMatchTurn = null;

/** @type {Array|null} Active rally turn list */
let currentRally    = null;
```

- [ ] **Step 3: Add `handleMatchScenario` and `autoPlayPartnerTurn` functions**

Find this existing function in `main.js`:
```js
function nextTurn() {
  stopTurnTimer();
  turnActive = false;
```

Insert the two new functions directly before `nextTurn`:

```js
/**
 * Central dispatcher for MatchEngine scenarios.
 * Handles: partner-playing pair, rally-over, and normal shot/positioning turns.
 */
async function handleMatchScenario(scen) {
  stopTurnTimer();
  turnActive = false;
  cleanupTurnListeners();
  hud.clearFeedback();

  // Partner-playing pair: animate the partner's action then handle the follow-up
  if (scen.scenarios) {
    await autoPlayPartnerTurn(scen.scenarios[0]);
    return handleMatchScenario(scen.scenarios[1]);
  }

  // Rally ended
  if (scen.rallyOver) {
    const winner = (scen.winnerId ?? 3) <= 2 ? 'player' : 'opp';
    await showPointResult({ winner, reason: scen.reason ?? '' });
    hud.setMatchState(matchAdapter.getMatchState());
    if (matchAdapter.isMatchOver()) {
      setTimeout(showEndScreen, 350);
    } else {
      handleMatchScenario(matchAdapter.startRally());
    }
    return;
  }

  // Normal turn — store raw scenario for intercepts, translate, dispatch
  currentMatchTurn = scen;
  const turn = matchAdapter.translate(scen);
  if (turn.type === 'shot')        startShotTurn(turn);
  else if (turn.type === 'positioning') startPositioningTurn(turn);
}

/**
 * Render a partner-auto-play scenario for ~1.5 s then resolve.
 * No player input; used when the partner strikes instead of the player.
 */
async function autoPlayPartnerTurn(scen) {
  const turn = matchAdapter.translate(scen);
  if (!turn || !turn.players) return;
  renderBase(turn, { showShuttle: true });
  await new Promise(r => setTimeout(r, 1500));
}

```

- [ ] **Step 4: Verify no syntax errors**

Reload `http://localhost:3000` in the browser. Console should show no JS parse errors. Match mode cannot be tested yet (it's not wired), but the app should still work for drill modes.

- [ ] **Step 5: Commit**

```bash
git add src/js/main.js
git commit -m "feat(match): add handleMatchScenario + autoPlayPartnerTurn + state vars"
```

---

## Task 3: Rewrite match mode init in `startGame`

**Files:**
- Modify: `src/js/main.js:1100–1165` (the `startGame` async function)

The current `startGame` for match mode calls `loadWorkshopRally('match')` and `createMatchState`. We replace that with the adapter.

- [ ] **Step 1: Add an early-exit match branch before the existing `try { const rally = ...}` block**

Find this line in `startGame` (the one that starts the loading try block):
```js
  try {
    const rally = await loadWorkshopRally(workshop);
```

Insert the following block immediately before that `try`:

```js
  // ── Match mode: use MatchEngine instead of static scenarios ──────────────
  if (workshop === 'match') {
    try {
      matchAdapter = new MatchAdapter();
      matchAdapter.initMatch(buildPlayerInitPayload());
    } catch (err) {
      console.error('[match] MatchEngine init failed', err);
      const msg = err instanceof Error ? err.message : 'Could not initialise match engine.';
      await hud.showExplanation(msg, '#f87171', 2200);
      resetAndShowMenu();
      return;
    }
    currentRally = []; // prevents null-crashes in shared hud.update() calls
    hud.setMatchState(matchAdapter.getMatchState());
    hud.updateOpponents(...DEFAULT_OPPONENT_NAMES);
    hud.update(score, 0, 0, 0);
    await showMatchReadyPrompt();
    if (requestId !== startRequestId) return;
    handleMatchScenario(matchAdapter.startRally());
    return;
  }
  // ─────────────────────────────────────────────────────────────────────────

  try {
    const rally = await loadWorkshopRally(workshop);
```

- [ ] **Step 2: Ensure `matchAdapter` is reset in `resetAndShowMenu`**

Find `resetAndShowMenu` in `main.js`. It has this block:
```js
  currentRally = null;
  currentMatchState = null;
```

Add the adapter reset right after:
```js
  currentRally = null;
  currentMatchState = null;
  matchAdapter     = null;
  currentMatchTurn = null;
```

- [ ] **Step 3: Test match mode starts**

In the browser, click the Match mode card. The ready overlay should appear, then after clicking "Ready", a shot or positioning turn should render on the court (from MatchEngine's `startRally()`). Open DevTools and verify no errors. The turn may not advance yet (intercepts not wired) — that's expected.

- [ ] **Step 4: Commit**

```bash
git add src/js/main.js
git commit -m "feat(match): wire startGame to MatchAdapter — bypasses static scenario load"
```

---

## Task 4: Add shot intercept in `onShotFired`

**Files:**
- Modify: `src/js/main.js` — `onShotFired` async function

After a shot's feedback is displayed, instead of calling `applyScore/nextTurn` in match mode, we pass the shot to `matchAdapter` and let `handleMatchScenario` drive the next turn.

- [ ] **Step 1: Add the intercept after the tutorial intercept block**

Find this block in `main.js` (the tutorial intercept, around line 820):
```js
  if (_tutorialMode && _tutorialObserver) {
    _tutorialObserver.onShotResult({ isCorrect, shot: bridedShot, turn });
    return;
  }

  applyScore(feedback.totalScore, isCorrect);
  if (currentWorkshop !== 'match') await waitForContinue();
  nextTurn();
```

Replace it with:
```js
  if (_tutorialMode && _tutorialObserver) {
    _tutorialObserver.onShotResult({ isCorrect, shot: bridedShot, turn });
    return;
  }

  // Match mode: pass shot to MatchEngine and let handleMatchScenario drive next turn
  if (currentWorkshop === 'match' && matchAdapter && currentMatchTurn) {
    const shotForEngine = {
      type:     bridedShot.type,
      startPos: impactPoint,
      endPos:   bridedShot.aimPoint,
      hasSpin:  false,
    };
    const incoming = currentMatchTurn.incoming ?? currentMatchTurn._raw?.incoming ?? null;
    const next = matchAdapter.onShotPlayed(shotForEngine, incoming);
    handleMatchScenario(next);
    return;
  }

  applyScore(feedback.totalScore, isCorrect);
  if (currentWorkshop !== 'match') await waitForContinue();
  nextTurn();
```

- [ ] **Step 2: Test shot turns advance in match mode**

In the browser, start match mode. Fire a shot by selecting a shot type and dragging. After the feedback animation completes (~2s), the court should redraw with a new positioning turn (from `nextScenarioPostShot`). Verify in the DevTools console that no errors are thrown.

- [ ] **Step 3: Commit**

```bash
git add src/js/main.js
git commit -m "feat(match): add shot intercept — passes bridedShot to MatchEngine post-shot"
```

---

## Task 5: Add positioning intercept in `onPositionClick`

**Files:**
- Modify: `src/js/main.js` — `onPositionClick` async function

- [ ] **Step 1: Add the intercept after the tutorial intercept block in `onPositionClick`**

Find this block in `main.js` (the tutorial intercept in the positioning handler):
```js
  if (_tutorialMode && _tutorialObserver) {
    _tutorialObserver.onPositionResult({ isCorrect, pos, turn });
    return;
  }

  applyScore(feedback.totalScore, isCorrect);
  if (currentWorkshop !== 'match') await waitForContinue();
  nextTurn();
```

Replace it with:
```js
  if (_tutorialMode && _tutorialObserver) {
    _tutorialObserver.onPositionResult({ isCorrect, pos, turn });
    return;
  }

  // Match mode: pass position to MatchEngine and let handleMatchScenario drive next turn
  if (currentWorkshop === 'match' && matchAdapter && currentMatchTurn) {
    const shotContext = currentMatchTurn.shotPlayed ?? currentMatchTurn._raw?.shotPlayed ?? null;
    const next = matchAdapter.onPositionPlayed(pos, shotContext);
    handleMatchScenario(next);
    return;
  }

  applyScore(feedback.totalScore, isCorrect);
  if (currentWorkshop !== 'match') await waitForContinue();
  nextTurn();
```

- [ ] **Step 2: Test the full shot → position → shot loop**

Start match mode. Play a shot turn, then a positioning turn. The flow should loop: shot → position → shot → ... Each turn should render correctly. Verify that:
- Players are positioned plausibly on each new turn
- The feedback animation (flash, optimal marker) appears briefly before the next turn loads
- No console errors

- [ ] **Step 3: Commit**

```bash
git add src/js/main.js
git commit -m "feat(match): add positioning intercept — passes pos to MatchEngine post-movement"
```

---

## Task 6: Patch timeout handlers and `nextTurn` for match mode

**Files:**
- Modify: `src/js/main.js`

When a turn times out, `nextTurn()` is eventually called. In match mode with the adapter, `currentMatchState` is null so the existing match guard fails, then `runTurn(0)` is called on the empty `currentRally` array → crash. We fix this by checking `matchAdapter` in `nextTurn`.

We also patch `handleStopSignal` (called by Dev B's engine mid-turn) to use `handleMatchScenario` in match mode.

- [ ] **Step 1: Patch `nextTurn`**

Find the `nextTurn` function:
```js
function nextTurn() {
  stopTurnTimer();
  turnActive = false;
  hud.clearFeedback();  // remove feedback colour without collapsing the panel

  if (currentWorkshop === 'match' && currentMatchState) {
```

Add a new check at the top, before the existing `currentMatchState` check:
```js
function nextTurn() {
  stopTurnTimer();
  turnActive = false;
  hud.clearFeedback();  // remove feedback colour without collapsing the panel

  // MatchEngine match mode: timeouts are handled as opponent points.
  // The engine score is not updated for Dev-A-side timeouts (v1 known limitation).
  if (currentWorkshop === 'match' && matchAdapter) {
    handleMatchScenario(matchAdapter.startRally());
    return;
  }

  if (currentWorkshop === 'match' && currentMatchState) {
```

- [ ] **Step 2: Patch `handleStopSignal`**

Find `handleStopSignal` (around line 970):
```js
  await showPointResult(signal);
  applyScore(0, false);
  nextTurn();
```

Replace those three lines with:
```js
  await showPointResult(signal);
  if (currentWorkshop === 'match' && matchAdapter) {
    hud.setMatchState(matchAdapter.getMatchState());
    handleMatchScenario(matchAdapter.startRally());
    return;
  }
  applyScore(0, false);
  nextTurn();
```

- [ ] **Step 3: Test timeout behaviour**

Start match mode. Let a shot turn time out (wait for the timer to expire without interacting). Verify:
- "Time expired" banner appears briefly
- The game advances to a new rally (not a crash)
- Console shows no errors

- [ ] **Step 4: Commit**

```bash
git add src/js/main.js
git commit -m "fix(match): patch nextTurn + handleStopSignal for MatchAdapter timeout path"
```

---

## Task 7: Update `showEndScreen` to read from `matchAdapter.getMatchState()`

**Files:**
- Modify: `src/js/main.js` — `showEndScreen` function

`showEndScreen` currently reads `currentMatchState?.winner`, `currentMatchState?.sets`, and `currentMatchState?.ratingDelta`. In the new match mode, `currentMatchState` is null — we read from `matchAdapter.getMatchState()` instead.

- [ ] **Step 1: Introduce a local `finalMatchState` variable at the top of `showEndScreen`**

Find the beginning of `showEndScreen`:
```js
function showEndScreen() {
  hud.hideInstruction();
  const totalPlayed = currentWorkshop === 'match'
```

Change it to:
```js
function showEndScreen() {
  hud.hideInstruction();
  // For match mode, read state from the adapter; for drills, use the runtime state.
  const finalMatchState = (currentWorkshop === 'match' && matchAdapter)
    ? matchAdapter.getMatchState()
    : currentMatchState;
  const totalPlayed = currentWorkshop === 'match'
```

- [ ] **Step 2: Replace all `currentMatchState` reads inside `showEndScreen` with `finalMatchState`**

There are four occurrences. Make each replacement:

Replace:
```js
    ? `${currentMatchState?.winner === 'player' ? 'Match won!' : 'Match lost'}`
```
With:
```js
    ? `${finalMatchState?.winner === 'player' ? 'Match won!' : 'Match lost'}`
```

Replace:
```js
    ? `Sets: ${currentMatchState?.sets.player ?? 0}-${currentMatchState?.sets.opponent ?? 0} · Score: ${score} pts`
```
With:
```js
    ? `Sets: ${finalMatchState?.sets.player ?? 0}-${finalMatchState?.sets.opponent ?? 0} · Score: ${score} pts`
```

Replace:
```js
  const ratingDelta = currentMatchState?.ratingDelta ?? null;
```
With:
```js
  const ratingDelta = finalMatchState?.ratingDelta ?? null;
```

(The fourth occurrence, `currentRally[0]?.matchId ?? null`, is fine with `currentRally = []` — it yields `null`.)

- [ ] **Step 3: Test the end screen**

Play enough match turns that `matchAdapter.isMatchOver()` returns true (win enough sets, or test with format 1 by temporarily changing the `initMatch` call to use `format = 1`). Verify the end screen shows:
- "Match won!" or "Match lost" (not "Match lost" unconditionally)
- Correct sets score e.g. "Sets: 2-1"
- Rating delta if available

- [ ] **Step 4: Commit**

```bash
git add src/js/main.js
git commit -m "fix(match): showEndScreen reads finalMatchState from matchAdapter"
```

---

## Task 8: Manual verification checklist

No code changes — full end-to-end test.

- [ ] **Step 1: Start the server**

```bash
npm run dev
```

Open `http://localhost:3000`.

- [ ] **Step 2: Verify drill modes are unaffected**

Click "Attack" → play a drill. Shot turns advance normally. Click "Defense" → positioning turns work. Tutorial → tutorial still works. None of these should show errors.

- [ ] **Step 3: Full match flow test**

Click Match mode → Ready prompt appears → click Ready. Then verify:

| Action | Expected |
|--------|---------|
| Ready overlay dismiss | Court renders with a turn (TACTICAL or PLACEMENT) |
| Fire a shot | Feedback shown briefly, then positioning turn appears |
| Click a position | Feedback shown briefly, then new shot turn appears (or rally ends) |
| Turn times out | "Time expired" shown, new rally starts |
| Rally ends (fault/out) | "Point won!" or "Fault" banner appears, HUD score updates |
| Match ends | End screen shows "Match won/lost" and sets score |

- [ ] **Step 4: Check HUD score display**

After a rally ends, verify the HUD match score (points and sets) updates correctly. The team A score (`teamA`) maps to the left/player display and `teamB` to the opponent.

- [ ] **Step 5: Check console for errors**

Verify no uncaught exceptions throughout the full match flow.

---

## Known Limitations (v1)

- **Timeout score**: When a turn times out on Dev A's timer (not signalled by Dev B), the MatchEngine score is not updated. The game continues but that point is not counted in the engine's state. Fix: expose a `forceFault()` method from Dev B or pass a fault shot to `nextScenarioPostShot`.
- **Opponent names**: Hard-coded to `DEFAULT_OPPONENT_NAMES`. Fix: expose `engine.players[3].name` via the adapter once Dev B confirms the field is available.
- **`moveRadius`**: Hard-coded to `2.5m`. Fix: read from MatchEngine PLACEMENT scenario if Dev B adds it.
- **`hasSpin`**: Always `false`. Dev B confirmed this is intentional for v1.
