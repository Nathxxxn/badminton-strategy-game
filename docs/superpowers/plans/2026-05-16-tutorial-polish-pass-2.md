# Tutorial Polish Pass 2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix seven remaining tutorial UX issues: remove the instruction banner from the grayed-shots spotlight, restore dark overlays for panels and spotlights, remove the action banner during interactive phases, eliminate the misplaced "optimal" indicator during attack, fix the defense click handler, and constrain the Drills tutorial CTA card width.

**Architecture:** All changes are confined to the UI layer — `tutorial.js`, `tutorial.css`, `main.js` (tutorial intercepts only), and `screens.js` (Drills markup). No logic files (evaluate.js, exercises.js) are touched.

**Tech Stack:** Vanilla JS (ES6 modules), Canvas 2D API, CSS custom properties, no build tools.

---

## File map

| File | What changes |
|------|-------------|
| `src/js/tutorial.js` | Remove `instructionText` from `tour-shots-grayed`; restore `.tut-overlay` in `_showPanel`/`_showEnd`; restore `box-shadow` darkening in `_showSpotlight`; remove `tut-action-banner` from `_runInteractive` |
| `src/css/tutorial.css` | Re-add `.tut-overlay` rule; restore `box-shadow` on `.tut-spotlight-veil` |
| `src/js/main.js` | Move shot-result tutorial intercept to before `renderFeedbackFrame`; simplify positioning intercept to avoid `evaluatePlacementTurn` call |
| `src/js/screens.js` | Match `.tutorial-cta-card` left/right margin to `.daily-drill` |

---

### Task 1 — Restore dark overlay for panels + spotlights; fix grayed-shots step

**Files:**
- Modify: `src/css/tutorial.css`
- Modify: `src/js/tutorial.js`

#### 1-A  Re-add `.tut-overlay` CSS rule

The `.tut-overlay` class was removed in the last pass. Panels and the end card need a blurred dark backdrop again (matching the welcome modal style).

- [ ] **Add `.tut-overlay` back to `tutorial.css`**

Open `src/css/tutorial.css`. After the `#tutorial-root.tut-active` block, insert:

```css
/* ── Backdrop (panels + end card) ────────────────────────────────────────── */

.tut-overlay {
  position: fixed;
  inset: 0;
  z-index: 491;
  background: rgba(10, 14, 22, 0.82);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  opacity: 0;
  transition: opacity 220ms ease;
}
.tut-overlay.tut-visible {
  opacity: 1;
}
```

- [ ] **Restore `box-shadow` darkening on `.tut-spotlight-veil`**

In `tutorial.css`, find `.tut-spotlight-veil` and replace it with:

```css
.tut-spotlight-veil {
  position: fixed;
  z-index: 495;
  pointer-events: none;
  border-radius: 10px;
  outline: 2px solid var(--rally-accent);
  box-shadow: 0 0 0 9999px rgba(10, 14, 22, 0.80);
  transition: left 200ms ease, top 200ms ease, width 200ms ease, height 200ms ease;
}
```

#### 1-B  Re-add overlay element in `_showPanel` and `_showEnd`

Open `src/js/tutorial.js`.

- [ ] **Add overlay back to `_showPanel`**

Find `_showPanel(step, stepIndex)`. Replace the `return new Promise(resolve => {` block so it creates an overlay element before the panel:

```javascript
_showPanel(step, stepIndex) {
  return new Promise(resolve => {
    this._resolve = resolve;

    const panelSteps = STEPS.filter(s => s.kind === 'panel' || s.kind === 'end');
    const panelIdx   = panelSteps.indexOf(step);
    const progress   = panelIdx >= 0 ? `${panelIdx + 1} / ${panelSteps.length}` : '';

    const overlay = document.createElement('div');
    overlay.className = 'tut-overlay';

    const panel = document.createElement('div');
    panel.className = 'tut-panel';
    panel.innerHTML = `
      ${step.eyebrow ? `<p class="tut-panel-eyebrow">${step.eyebrow}</p>` : ''}
      <h2 class="tut-panel-title">${step.title}</h2>
      <p class="tut-panel-body">${escHtml(step.body)}</p>
      <div class="tut-panel-footer">
        <span class="tut-progress">${progress}</span>
        <button class="tut-btn-next" type="button">${step.btn ?? 'Next'}</button>
      </div>
    `;
    panel.querySelector('.tut-btn-next').addEventListener('click', () => this._next());

    this._root.appendChild(overlay);
    this._root.appendChild(panel);

    requestAnimationFrame(() => {
      overlay.classList.add('tut-visible');
      panel.classList.add('tut-visible');
    });
  });
}
```

- [ ] **Add overlay back to `_showEnd`**

Find `_showEnd(step)`. Replace its body to also create and append an overlay:

```javascript
_showEnd(step) {
  return new Promise(resolve => {
    this._resolve = resolve;

    const overlay = document.createElement('div');
    overlay.className = 'tut-overlay';

    const panel = document.createElement('div');
    panel.className = 'tut-panel';
    panel.innerHTML = `
      ${step.eyebrow ? `<p class="tut-panel-eyebrow">${step.eyebrow}</p>` : ''}
      <h2 class="tut-panel-title">${step.title}</h2>
      <p class="tut-panel-body">${escHtml(step.body)}</p>
      <div class="tut-panel-footer">
        <span></span>
        <button class="tut-btn-next" type="button">${step.btn ?? 'Done'}</button>
      </div>
    `;
    panel.querySelector('.tut-btn-next').addEventListener('click', () => this._next());

    this._root.appendChild(overlay);
    this._root.appendChild(panel);

    requestAnimationFrame(() => {
      overlay.classList.add('tut-visible');
      panel.classList.add('tut-visible');
    });
  });
}
```

#### 1-C  Remove `instructionText` from `tour-shots-grayed`; keep explanation in tooltip only

The instruction card banner at the top of the stage is distracting during the grayed-shots spotlight. The tooltip already carries the explanation.

- [ ] **Edit the `tour-shots-grayed` step in the `STEPS` array**

Find the step with `id: 'tour-shots-grayed'` and remove the `instructionText` property entirely:

```javascript
{
  id: 'tour-shots-grayed',
  kind: 'spotlight',
  selector: '#shot-type-selector',
  tooltip: 'Some shots are grayed out based on context. You cannot play a NET DROP when the shuttle is deep in your court — the game only enables shots that are physically realistic.',
  arrow: 'top',
  grayedShots: ['NET_DROP', 'DROP', 'KILL'],
},
```

(Delete the `instructionText` line and the entire `instructionText` handling block in `_showSpotlight` if desired — or just leave the handler in place; it will simply never fire without the property.)

- [ ] **Manual test** — Start the tutorial, click through to the grayed-shots spotlight step. Verify:
  - Shot selector is spotlighted with dark surround
  - NET_DROP, DROP, KILL are grayed
  - NO instruction card text override appears above the stage
  - Tooltip shows the explanation

---

### Task 2 — Remove action banner from interactive phases

**Files:**
- Modify: `src/js/tutorial.js`

The `tut-action-banner` ("SELECT SMASH · drag to aim…" / "CLICK mid-court center…") clutters the screen during interactive phases. Remove it.

- [ ] **Delete the banner creation in `_runInteractive`**

Find `_runInteractive(step)`. Remove these three lines:

```javascript
const banner = document.createElement('div');
banner.className = 'tut-action-banner';
banner.textContent = step.actionHint ?? '';
this._root.appendChild(banner);
```

- [ ] **Remove the banner cleanup in `advanceAfterSuccess`**

Inside `_runInteractive`, find `advanceAfterSuccess`:

```javascript
const advanceAfterSuccess = () => {
  if (backBtn) backBtn.removeEventListener('click', onBack);
  this._root.style.pointerEvents = '';
  this._removeGoalHighlight();
  banner.remove();          // ← delete this line
  setTimeout(() => resolve(), 1200);
};
```

Also remove `banner.remove()` from `onBack`:

```javascript
const onBack = () => {
  banner.remove();          // ← delete this line
  this._removeGoalHighlight();
  this._cleanup();
  endTutorialMode();
  this._screens.show('menu');
};
```

After both removals the two closures become:

```javascript
const advanceAfterSuccess = () => {
  if (backBtn) backBtn.removeEventListener('click', onBack);
  this._root.style.pointerEvents = '';
  this._removeGoalHighlight();
  setTimeout(() => resolve(), 1200);
};

const onBack = () => {
  this._removeGoalHighlight();
  this._cleanup();
  endTutorialMode();
  this._screens.show('menu');
};
```

- [ ] **Manual test** — Launch the tutorial attack phase. Verify no yellow top banner appears. The goal zone highlight and tooltip should still work.

---

### Task 3 — Fix shot-result tutorial intercept (eliminate misplaced optimal indicator)

**Files:**
- Modify: `src/js/main.js`

The "optimal" correction arrow is rendered by `renderFeedbackFrame` at line ~772. The tutorial intercept is currently placed after this rendering (line ~799), so the misplaced marker shows before the tutorial advances. Moving the intercept to immediately after `evaluateTacticalTurn` (before any canvas rendering) eliminates the issue.

- [ ] **Move shot intercept to before `renderFeedbackFrame`**

Open `src/js/main.js`. Find the block that looks like:

```javascript
  const feedback = evaluateTacticalTurn(
    turn,
    payloadToLogic(buildTacticalPayload(bridedShot, turn, { forcedType })),
  );
  const isCorrect = feedback.totalScore >= (turn.passingScore ?? 70);
  recordTacticalFeedback(feedback);
  hud.updateTurnStats('shot', {
    accuracy: feedback.totalScore,
    isBackhand: feedback.flags?.isBackhandTargeted ?? false,
    isBody: feedback.flags?.isBodyHit ?? false,
    bonus: feedback.details?.breakdown?.bonus ?? 0,
  });

  // Freeze result frame
  renderFeedbackFrame(turn, {
```

Insert the tutorial intercept immediately after `hud.updateTurnStats(...)`, before `renderFeedbackFrame`:

```javascript
  const feedback = evaluateTacticalTurn(
    turn,
    payloadToLogic(buildTacticalPayload(bridedShot, turn, { forcedType })),
  );
  const isCorrect = feedback.totalScore >= (turn.passingScore ?? 70);
  recordTacticalFeedback(feedback);
  hud.updateTurnStats('shot', {
    accuracy: feedback.totalScore,
    isBackhand: feedback.flags?.isBackhandTargeted ?? false,
    isBody: feedback.flags?.isBodyHit ?? false,
    bonus: feedback.details?.breakdown?.bonus ?? 0,
  });

  // Tutorial mode: report result immediately, skip all canvas feedback rendering
  if (_tutorialMode && _tutorialObserver) {
    _tutorialObserver.onShotResult({ isCorrect, shot: bridedShot, turn });
    return;
  }

  // Freeze result frame
  renderFeedbackFrame(turn, {
```

- [ ] **Remove the old shot intercept** that appears later in the same function (after `hud.showMessages`):

```javascript
  if (_tutorialMode && _tutorialObserver) {
    _tutorialObserver.onShotResult({ isCorrect, shot: bridedShot, turn });
    return;
  }
```

Delete those three lines.

- [ ] **Manual test** — In the tutorial attack phase, select SMASH, drag to aim, release. Verify:
  - Shuttle flight animation plays normally
  - No "optimal" arrow or correction overlay appears
  - If SMASH aimed into opponent's court → tutorial advances after ~1.2 s
  - If wrong shot → retry banner shakes, turn resets

---

### Task 4 — Fix defense exercise click handler

**Files:**
- Modify: `src/js/main.js`

The current positioning intercept calls `evaluatePlacementTurn(turn, payloadToLogic(buildPlacementPayload(pos, turn)))`. If this call throws (e.g., the tutorial scenario lacks a field that the evaluation expects), the `{ once: true }` canvas listener is consumed and never re-added, so all subsequent clicks do nothing.

The fix: skip `evaluatePlacementTurn` entirely in tutorial mode. The tutorial's own `successCheck` (which uses `getZoneAt(pos.x, pos.y)`) is the only check that matters; `passingScore: 0` makes game-side scoring irrelevant.

- [ ] **Simplify the positioning tutorial intercept**

Find the block we inserted in Task 3 of the previous pass (it's right after `constrainPlacementPos`):

```javascript
  // Tutorial mode: evaluate synchronously and return immediately — skip the
  // async animation/message chain which can hang waiting for user dismissal.
  if (_tutorialMode && _tutorialObserver) {
    const fb = evaluatePlacementTurn(turn, payloadToLogic(buildPlacementPayload(pos, turn)));
    const correct = fb.totalScore >= (turn.passingScore ?? 70);
    _tutorialObserver.onPositionResult({ isCorrect: correct, pos, turn });
    return;
  }
```

Replace it with the simplified version that passes `pos` only (no evaluation call):

```javascript
  // Tutorial mode: skip all async animation and scoring — the successCheck in
  // tutorial.js uses getZoneAt(pos.x, pos.y) to determine correctness.
  if (_tutorialMode && _tutorialObserver) {
    _tutorialObserver.onPositionResult({ isCorrect: true, pos, turn });
    return;
  }
```

- [ ] **Manual test** — In the tutorial defense phase:
  - Click inside the dashed radius circle on the ally-mid zone → tutorial advances
  - Click inside radius but outside ally-mid zones → retry banner shakes, turn resets
  - Click outside radius (constrained to radius edge by `constrainPlacementPos`) → depending on where the clamped point lands, either retries or advances

---

### Task 5 — Fix Drills tutorial CTA card width

**Files:**
- Modify: `src/css/tutorial.css`

The `.tutorial-cta-card` is rendered outside the `.drill-grid`, so it stretches full width. `.daily-drill` uses `margin: 0 36px 20px` on desktop to create side gutters. The CTA card needs the same margin.

- [ ] **Add margin to `.tutorial-cta-card` to match `.daily-drill`**

Open `src/css/tutorial.css`. Find `.tutorial-cta-card` and add the matching margin:

```css
.tutorial-cta-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  margin: 0 36px 20px;    /* ← matches .daily-drill */
  flex-wrap: wrap;
}
```

- [ ] **Add responsive override for small screens**

At the bottom of `tutorial.css`, add:

```css
@media (max-width: 640px) {
  .tutorial-cta-card { margin: 0 18px 16px; }
}
```

(`.daily-drill` uses `margin: 0 18px 20px` at `max-width: 640px` per style.css line 2618.)

- [ ] **Manual test** — Open the Drills tab. Verify the "New here?" / "Interactive Tutorial" card has the same left/right indent as the "TODAY'S FOCUS" card below it.

---

## Self-Review

**Spec coverage check:**

| Requested fix | Task |
|---|---|
| Remove instruction message during grayed-shots spotlight | Task 1-C |
| Restore dark overlay for spotlight steps | Task 1-A (box-shadow restored) |
| Keep dark overlay for intro panels | Task 1-A + 1-B (tut-overlay re-added) |
| Remove action banner (SELECT SMASH / CLICK mid-court) during interactive | Task 2 |
| Fix optimal indicator rendering outside zone | Task 3 (intercept moved before renderFeedbackFrame) |
| Fix defense exercise click handler | Task 4 |
| Fix Drills CTA card width | Task 5 |

**Placeholder scan:** No TBD/TODO present. All steps contain exact code.

**Type consistency:** `pos` used in Task 4 is the same `{x, y}` object from `constrainPlacementPos` referenced in tutorial.js `successCheck`. `bridedShot` in Task 3 matches what `onShotResult` destructures in tutorial.js. Consistent.
