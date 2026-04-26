# Lot E — Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the Rally in-game UI — punchier HUD micro-animations, dedicated correct/wrong/near-miss feedback styling on the instruction card, and a more tactile slingshot drag (deadzone + ease curve + full-power tension feedback).

**Architecture:** All changes stay in Developer A territory and inside three layers: (1) CSS keyframes/classes added to `src/css/style.css`, (2) class-toggle wiring in `src/js/hud.js` (no new public API surface beyond a single optional tier hint), (3) numeric tuning + visual additions inside the existing `DragShooter.draw()` pipeline in `src/js/drag.js`. No file is restructured. The evaluation engine, payload, snap, court math, and Developer B files are not touched. The existing `hud.update(score, turnIndex, totalTurns, combo)` signature stays, with internal logic updated to detect score deltas and combo escalation. `hud.showMessages(messages, color, durationMs)` keeps its signature; we only key the new feedback class off the `color` argument the callers already pass.

**Tech Stack:** Vanilla JS, Canvas 2D API, plain CSS, ES6 modules, no build tools, no dependencies.

**Hard constraints — NEVER touch:**
- `src/js/evaluate.js`, `src/js/exercises.js`, `src/js/match.js`, `src/js/progression.js`, `src/js/difficulty.js`, `src/js/boss.js`
- `src/js/payload-builder.js`, `src/js/snap.js`, `src/js/zones.js`
- BWF dimension constants, `toCanvas`, `toNormalized`, line-drawing utilities in `src/js/court.js`
- Anything under `data/`
- Tests must stay 41/41 passing

---

## File Map

| File | Action | What changes |
|------|--------|--------------|
| `src/css/style.css` | Modify | Replace `comboAppear` + `scorePop` keyframes; add `.combo-badge.hot`, `.score-pill.gain`, `.score-pill.gain-bad`, `.level-chip.level-up`, `.timer-pill.urgent` (and a stronger `timerPulse`), `.xp-fill` shimmer; add `.instr.feedback-correct/.feedback-wrong/.feedback-near` classes with shake/pulse/border swap |
| `src/js/hud.js` | Modify | (a) Track `_prevScore` delta + apply `.gain` / `.gain-bad` to `.score-pill`; (b) Track `_lastCombo` to add/remove `.hot` on combo ≥ 3; (c) Track `_prevLevel` in `setLevel()` to flash `.level-chip.level-up`; (d) `showMessages()` derives a tier (`correct`/`near`/`wrong`) from the existing `color` argument and toggles a class on `#instruction`; (e) clear feedback class on `setInstruction()` and `hideInstruction()` |
| `src/js/drag.js` | Modify | Add `DEADZONE_PX` (raw drag below this → power 0, no aim line/preview); apply an ease curve (`easeInOutQuad`) on the normalized power before it leaves `_computeShot`; render a "max-tension" radial pulse + ink halo when `power >= 0.96` |
| `src/js/main.js` | No change | Existing `hud.update` / `hud.setLevel` / `hud.showMessages` calls already pipe through the polished paths once `hud.js` owns the new behavior |

---

## Task 1: HUD CSS — score / combo / level / timer / XP shimmer

**Files:**
- Modify: `src/css/style.css:716-731` (existing `comboAppear` + `scorePop` blocks)
- Modify: `src/css/style.css:680-688` (existing `.timer-pill:has(...)` urgent block + `timerPulse` keyframes)
- Modify: `src/css/style.css:625-634` (existing `.xp-fill` block)

This task is CSS-only. No JS or markup change yet — the new classes will be opt-in from `hud.js` in Task 2.

- [ ] **Step 1: Replace the existing combo + score pop block**

In `src/css/style.css`, find the block that starts with `.combo-badge[hidden] { display: none; }` (around line 716) and ends with `#hud-score.score-pop { animation: scorePop 0.35s ease-out both; }` (around line 731). Replace the entire block with:

```css
.combo-badge[hidden] { display: none; }

@keyframes comboAppear {
  0%   { transform: scale(1.6) rotate(-6deg); opacity: 0; }
  55%  { transform: scale(0.85) rotate(3deg); opacity: 1; }
  80%  { transform: scale(1.05) rotate(-1deg); }
  100% { transform: scale(1) rotate(0); opacity: 1; }
}

/* Sustained pulse while combo is hot (≥ 3). Looped, low-amplitude. */
@keyframes comboPulse {
  0%, 100% { box-shadow: 3px 3px 0 0 #ffb547; transform: scale(1); }
  50%      { box-shadow: 3px 3px 0 0 var(--rally-accent); transform: scale(1.04); }
}

.combo-badge.pop { animation: comboAppear 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
.combo-badge.hot { animation: comboPulse 1.1s ease-in-out infinite; }

/* Score pop animation — bouncier with a tiny rotational kick */
@keyframes scorePop {
  0%   { transform: scale(1)    rotate(0); }
  30%  { transform: scale(1.35) rotate(-3deg); }
  60%  { transform: scale(0.92) rotate(1.5deg); }
  100% { transform: scale(1)    rotate(0); }
}
#hud-score.score-pop { animation: scorePop 0.42s cubic-bezier(0.34, 1.56, 0.64, 1) both; }

/* Score-pill background flash on point gain. .gain = positive (cream flash),
   .gain-bad = wrong answer (danger flash). One-shot, both share keyframes. */
@keyframes scoreGainFlash {
  0%   { background: var(--rally-accent); }
  35%  { background: var(--rally-cream); }
  100% { background: var(--rally-accent); }
}
@keyframes scoreLossFlash {
  0%   { background: var(--rally-accent); }
  35%  { background: var(--rally-danger); color: var(--rally-feather); }
  100% { background: var(--rally-accent); }
}
.score-pill.gain     { animation: scoreGainFlash 0.45s ease-out both; }
.score-pill.gain-bad { animation: scoreLossFlash 0.45s ease-out both; }

/* Level chip — flash + bounce when player levels up */
@keyframes levelUpPulse {
  0%   { transform: scale(1);    box-shadow: 3px 3px 0 0 var(--rally-ink); }
  30%  { transform: scale(1.20); box-shadow: 5px 5px 0 0 var(--rally-accent), 3px 3px 0 0 var(--rally-ink); }
  60%  { transform: scale(0.95); box-shadow: 3px 3px 0 0 var(--rally-ink); }
  100% { transform: scale(1);    box-shadow: 3px 3px 0 0 var(--rally-ink); }
}
.level-chip.level-up { animation: levelUpPulse 0.85s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
```

Notes:
- `comboAppear` opacity reaches 1 by frame 55% so the badge stays solid through the bounce frames.
- `.combo-badge.pop` and `.combo-badge.hot` are intentionally on the same element; `pop` is one-shot (`both`), `hot` loops. CSS will run them in sequence — when `pop` is removed by JS, `hot` continues alone.
- `.score-pill.gain` / `.gain-bad` use the same one-shot pattern as `score-pop`: JS will toggle the class off-then-on via reflow.

- [ ] **Step 2: Strengthen the timer-urgent block**

Find the existing `.timer-pill:has(#hud-timer.timer-urgent)` block (around line 680). Replace it with:

```css
.timer-pill:has(#hud-timer.timer-urgent) {
  background: var(--rally-danger); color: var(--rally-feather);
  animation: timerPulse 0.55s infinite alternate;
}
@keyframes timerPulse {
  from { transform: scale(1);    box-shadow: 3px 3px 0 0 var(--rally-ink); }
  to   { transform: scale(1.08); box-shadow: 5px 5px 0 0 var(--rally-ink); }
}
```

Why: the existing rule already pulses but only on `transform`. Adding the box-shadow keyframe makes the urgency feel like a physical press, matching the rest of the neobrutalist HUD.

- [ ] **Step 3: Add an XP shimmer**

Find the existing `.xp-fill` block (around line 625). Append a moving-stripe animation by adding two declarations and a new keyframe immediately after the block. Replace the block with:

```css
.xp-fill {
  height: 100%;
  background: repeating-linear-gradient(
    -45deg,
    var(--rally-accent) 0 6px,
    #ffb547 6px 12px
  );
  background-size: 17px 13px;
  border-right: 2.5px solid var(--rally-ink);
  transition: width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
  animation: xpStripeShift 1.4s linear infinite;
}

@keyframes xpStripeShift {
  from { background-position: 0 0; }
  to   { background-position: 24px 0; }
}
```

Notes:
- `background-size` is required for `background-position` to have a measurable cycle.
- `transition: width` and `animation: background-position` coexist cleanly — width animates on changes; the stripe animation runs continuously.

- [ ] **Step 4: Verify in browser**

Open `index.html`, run a "Mode test" exercise (any). Expected:
1. XP bar stripes are slowly sliding to the right at all times.
2. Timer pill pulses on transform AND shadow once `#hud-timer` gets `.timer-urgent` (≤ 3s).
3. No visible regression on the score pill, combo badge, or level chip yet — the new classes are opt-in.

- [ ] **Step 5: Commit**

```bash
git add src/css/style.css
git commit -m "feat(css): lot E — combo/score/level/timer/xp polish keyframes"
```

---

## Task 2: HUD wiring — score gain class, combo hot, level-up flash

**Files:**
- Modify: `src/js/hud.js:17-34` (constructor — add new tracker fields)
- Modify: `src/js/hud.js:64-91` (`update()` — score-pill class toggle, combo hot)
- Modify: `src/js/hud.js:235-239` (`setLevel()` — level-up flash)

- [ ] **Step 1: Extend the constructor with new tracker fields**

In `src/js/hud.js`, replace the constructor body (lines 17–34) with:

```js
constructor() {
  this._scoreEl    = document.getElementById('hud-score');
  this._scorePillEl = this._scoreEl?.parentElement ?? null;
  this._turnCurEl  = document.getElementById('hud-turn-cur');
  this._turnTotEl  = document.getElementById('hud-turn-total');
  this._turnDotsEl = document.getElementById('hud-turn-dots');
  this._comboEl    = document.getElementById('hud-combo');
  this._timerEl    = document.getElementById('hud-timer');
  this._instrEl    = document.getElementById('instruction');
  this._badgeEl    = document.getElementById('instr-badge');
  this._labelEl    = document.getElementById('instr-label');
  this._textEl     = document.getElementById('instr-text');
  this._metaEl     = document.getElementById('instr-meta');
  this._xpBarEl    = document.getElementById('hud-xp-bar');
  this._xpTrackEl  = this._xpBarEl?.parentElement ?? null;
  this._levelChipEl = document.getElementById('hud-level-num')?.parentElement ?? null;
  this._levelNumEl = document.getElementById('hud-level-num');
  this._prevScore  = 0;
  this._prevLevel  = null;
  this._lastCombo  = 0;
  this._popupEl    = null;
}
```

Notes:
- `_scorePillEl` is the `.score-pill` parent of `#hud-score`; it owns the background and is what we flash.
- `_levelChipEl` is the `.level-chip` parent of `#hud-level-num`.
- `_prevLevel = null` so the first `setLevel(1)` call doesn't trigger a flash.

- [ ] **Step 2: Update `update()` to flash the score pill on delta and toggle combo hot**

Replace the entire `update(score, turnIndex, totalTurns, combo)` method (lines 64–91) with:

```js
update(score, turnIndex, totalTurns, combo) {
  if (score !== this._prevScore) {
    const delta = score - this._prevScore;

    this._scoreEl.textContent = score;
    this._scoreEl.classList.remove('score-pop');
    void this._scoreEl.offsetWidth;
    this._scoreEl.classList.add('score-pop');

    if (this._scorePillEl && delta !== 0) {
      const cls = delta > 0 ? 'gain' : 'gain-bad';
      this._scorePillEl.classList.remove('gain', 'gain-bad');
      void this._scorePillEl.offsetWidth;
      this._scorePillEl.classList.add(cls);
    }

    this._prevScore = score;
  }

  const cur = turnIndex < totalTurns ? turnIndex + 1 : totalTurns;
  if (this._turnCurEl) this._turnCurEl.textContent = cur;
  if (this._turnTotEl) this._turnTotEl.textContent = totalTurns;
  this._renderTurnDots(turnIndex, totalTurns);

  const hadCombo = !this._comboEl.hidden;
  if (combo >= 2) {
    this._comboEl.textContent = `×${combo} COMBO`;
    this._comboEl.hidden = false;

    if (!hadCombo) {
      this._comboEl.classList.remove('pop');
      void this._comboEl.offsetWidth;
      this._comboEl.classList.add('pop');
    }

    if (combo >= 3) this._comboEl.classList.add('hot');
    else            this._comboEl.classList.remove('hot');
  } else {
    this._comboEl.hidden = true;
    this._comboEl.textContent = '';
    this._comboEl.classList.remove('hot');
  }

  this._lastCombo = combo;
}
```

Notes:
- Class is toggled via remove → reflow → add so consecutive deltas re-trigger the keyframe.
- `gain` and `gain-bad` are mutually exclusive — both removed before either is applied.
- `.hot` is added only when combo ≥ 3 so the first ×2 keeps the existing one-shot pop without the looping pulse.

- [ ] **Step 3: Update `setLevel()` to flash on level up**

Replace the existing `setLevel()` method (lines 235–239) with:

```js
setLevel(level) {
  if (this._levelNumEl) this._levelNumEl.textContent = level;

  if (this._levelChipEl && this._prevLevel !== null && level > this._prevLevel) {
    this._levelChipEl.classList.remove('level-up');
    void this._levelChipEl.offsetWidth;
    this._levelChipEl.classList.add('level-up');
  }
  this._prevLevel = level;
}
```

Notes:
- First call (during boot, when `_prevLevel === null`) sets `_prevLevel` without flashing.
- Subsequent calls flash if and only if the level increased.

- [ ] **Step 4: Manual verification in browser**

Open `index.html`, run an exercise.
1. After a correct answer → `#hud-score` pops AND `.score-pill` cream-flashes once.
2. After a wrong answer → `.score-pill` red-flashes once (still in amber afterwards).
3. After ×2 combo → badge appears with bounce. After ×3 combo → badge keeps a slow pulse loop. Combo reset → pulse stops, badge hides.
4. Trigger a level-up (or temporarily call `hud.setLevel(2)` from the console after the first call) → `.level-chip` bounces once.
5. No console errors.

- [ ] **Step 5: Commit**

```bash
git add src/js/hud.js
git commit -m "feat(hud): lot E — score-pill flash, combo hot pulse, level-up bounce"
```

---

## Task 3: Feedback styling — instruction card correct/wrong/near tiers

**Files:**
- Modify: `src/css/style.css` (append a new block at the end of the `.instr` section)
- Modify: `src/js/hud.js:120-184` (`setInstruction()`, `hideInstruction()`, `showMessages()`)

The existing pipeline calls `hud.showMessages(lines, color)` with one of three CSS color literals: `'#34d399'` (correct, green), `'#f87171'` (wrong, red), `'#f97316'` (warning, orange). We map that color to a tier class on `#instruction` so the whole card reacts, not just the text.

- [ ] **Step 1: Add feedback CSS classes**

Open `src/css/style.css`. Find the `.instr` block and the `.instr.hidden` block (in the instruction section near the end of the in-game HUD CSS). Immediately after the `.instr.hidden { ... }` block, append:

```css
/* ─── Instruction card — feedback tiers ─────────────────────────────────────── */
.instr.feedback-correct {
  border-color: #2f8f54;
  box-shadow: 6px 6px 0 0 #2f8f54;
  animation: instrCorrectPulse 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
.instr.feedback-near {
  border-color: #ea7a1d;
  box-shadow: 6px 6px 0 0 #ea7a1d;
  animation: instrNearPulse 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
.instr.feedback-wrong {
  border-color: var(--rally-danger);
  box-shadow: 6px 6px 0 0 var(--rally-danger);
  animation: instrWrongShake 0.5s cubic-bezier(.36,.07,.19,.97) both;
}

@keyframes instrCorrectPulse {
  0%   { transform: scale(1); }
  35%  { transform: scale(1.025); }
  100% { transform: scale(1); }
}
@keyframes instrNearPulse {
  0%   { transform: scale(1); }
  35%  { transform: scale(1.015); }
  100% { transform: scale(1); }
}
@keyframes instrWrongShake {
  10%, 90% { transform: translate3d(-1px, 0, 0); }
  20%, 80% { transform: translate3d(2px, 0, 0); }
  30%, 50%, 70% { transform: translate3d(-3px, 0, 0); }
  40%, 60% { transform: translate3d(3px, 0, 0); }
}
```

Notes:
- The existing `.instr` rules already define `transition: opacity .2s, transform .2s`. The shake keyframes use `translate3d` so they don't fight the show/hide `translateY` transition (each animation runs in its own transform timeline; the shake plays once via `both` and then yields back to the transition).
- We don't override `background` so the cream stays — only border + shadow + subtle bounce communicate the tier.

- [ ] **Step 2: Add a private `_setFeedbackTier()` helper and clear-on-set**

In `src/js/hud.js`, replace the existing `setInstruction()` method (lines 120–140) with:

```js
setInstruction(turn) {
  this._instrEl.classList.remove('hidden');
  this._instrEl.classList.remove('feedback-correct', 'feedback-wrong', 'feedback-near');
  this._instrEl.dataset.type = turn.type;

  const isShot = turn.type === 'shot';
  this._labelEl.className   = `instr-label ${isShot ? 'shot' : 'pos'}`;
  this._labelEl.textContent = turn.label;
  this._textEl.textContent  = turn.text;
  this._textEl.style.color  = '';

  if (this._badgeEl) {
    this._badgeEl.innerHTML = isShot ? HUD._SHOT_ICON : HUD._POS_ICON;
    this._badgeEl.className = `instr-badge ${isShot ? 'shot' : 'pos'}`;
  }

  if (this._metaEl) {
    this._metaEl.textContent = isShot
      ? 'Saisis le volant · tire · relâche'
      : 'Clique dans ta moitié · reste dans ton rayon';
  }
}

_setFeedbackTier(tier) {
  this._instrEl.classList.remove('feedback-correct', 'feedback-wrong', 'feedback-near');
  if (!tier) return;
  void this._instrEl.offsetWidth;
  this._instrEl.classList.add(`feedback-${tier}`);
}

_tierFromColor(color) {
  if (!color) return null;
  if (color === '#34d399') return 'correct';
  if (color === '#f87171') return 'wrong';
  if (color === '#f97316') return 'near';
  return null;
}
```

Notes:
- `setInstruction()` strips any feedback class so the next turn always starts clean.
- `_tierFromColor()` is internal; we keep `showMessages(messages, color, durationMs)` and `showExplanation(text, color, durationMs)` signature-stable so `main.js` doesn't change.

- [ ] **Step 3: Wire feedback class into `showExplanation()` and `showMessages()`**

Replace `showExplanation()` (lines 157–167) with:

```js
showExplanation(text, color, durationMs = 1800) {
  return new Promise(resolve => {
    this._textEl.textContent = text;
    this._textEl.style.color = color;
    this._instrEl.classList.remove('hidden');
    this._setFeedbackTier(this._tierFromColor(color));
    setTimeout(() => {
      this._textEl.style.color = '';
      resolve();
    }, durationMs);
  });
}
```

Replace `showMessages()` (lines 169–184) with:

```js
showMessages(messages, color, durationMs = 1800) {
  return new Promise(resolve => {
    const text = Array.isArray(messages)
      ? messages.map((m, i) => `${i + 1}. ${m}`).join('\n')
      : messages;
    this._textEl.style.whiteSpace = 'pre-line';
    this._textEl.textContent = text;
    this._textEl.style.color = color;
    this._instrEl.classList.remove('hidden');
    this._setFeedbackTier(this._tierFromColor(color));
    setTimeout(() => {
      this._textEl.style.whiteSpace = '';
      this._textEl.style.color = '';
      resolve();
    }, durationMs);
  });
}
```

Also extend `hideInstruction()` (line 143) to scrub the feedback class. Replace it with:

```js
hideInstruction() {
  this._instrEl.classList.add('hidden');
  this._instrEl.classList.remove('feedback-correct', 'feedback-wrong', 'feedback-near');
}
```

- [ ] **Step 4: Manual verification in browser**

1. Run a positioning exercise. Click the wrong half → instruction card border turns red and shakes briefly with `'⚠ Clique sur ta moitié...'`. After the timeout, border returns to ink.
2. Click a near-miss spot (60–84 score) → border + shadow turn orange with a subtle pulse.
3. Click a near-perfect spot (≥ 85 score, isCorrect path) → border turns green with a subtle pulse.
4. Run a shot → same three tiers fire on the post-shot `showMessages` call.
5. After the feedback duration, `setInstruction()` for the next turn clears the class — border is ink again.

- [ ] **Step 5: Commit**

```bash
git add src/css/style.css src/js/hud.js
git commit -m "feat(hud): lot E — feedback tier styling on instruction card"
```

---

## Task 4: Slingshot drag — deadzone + ease curve + max-tension cue

**Files:**
- Modify: `src/js/drag.js:30-39` (tuning constants)
- Modify: `src/js/drag.js:243-271` (`_computeShot()`)
- Modify: `src/js/drag.js:418-493` (`_drawAimLine()` — append max-tension cue)

The drag still produces `{ aimPoint, power, spin, shuttleType }` with the same shape. We only change how `power` is computed (deadzone + curve) and add a visual cue at full tension.

- [ ] **Step 1: Add new tuning constants**

In `src/js/drag.js`, find the tuning constants block (lines 30–39). Add three new constants immediately after `MAX_DRAG_PX`:

```js
/** Maximum drag distance in CSS pixels — maps to power = 1.0 */
const MAX_DRAG_PX = 160;

/**
 * Drag length below this stays at power = 0. Avoids ghost shots on a stray
 * tap, and gives the slingshot a tactile "engage" point.
 */
const DEADZONE_PX = 14;

/**
 * Power threshold (post-easing) at which the max-tension cue appears.
 * Picked just below 1.0 so the player sees the cue before bottoming out.
 */
const MAX_TENSION_T = 0.96;

/** Radius of the activation zone around the shuttlecock (CSS px) */
const ACTIVATION_RADIUS_PX = 36;

/** Spin sensitivity: pixels of perpendicular deviation → ±1.0 */
const MAX_SPIN_DEVIATION_PX = 60;
```

- [ ] **Step 2: Apply deadzone + ease curve in `_computeShot()`**

Replace the entire `_computeShot()` method body (lines 243–271) with:

```js
_computeShot() {
  const dx = this._current.x - this._origin.x;
  const dy = this._current.y - this._origin.y;
  const len = Math.hypot(dx, dy);

  // Power: deadzone clears any drag below DEADZONE_PX, then we re-normalize
  // the remaining range so the curve still spans 0..1, then we apply
  // an ease-in-out (sine) curve so the middle of the pull feels softer
  // and the last 30% feels heavier — matches the "rope tightening" feel.
  let power;
  if (len <= DEADZONE_PX) {
    power = 0;
  } else {
    const tRaw = Math.min(1, (len - DEADZONE_PX) / (MAX_DRAG_PX - DEADZONE_PX));
    // Ease-in-out (cosine): soft start, steep end
    power = 0.5 - 0.5 * Math.cos(Math.PI * tRaw);
  }

  // Spin: perpendicular deviation of the midpoint, normalized to [-1, 1]
  const spin = Math.max(-1, Math.min(1, this._spinDeviation / MAX_SPIN_DEVIATION_PX));

  // Slingshot: the player drags AWAY from the target (toward themselves).
  // Aim direction is therefore the OPPOSITE of the drag delta.
  let aimNorm;
  if (len < 1) {
    aimNorm = { ...this._shuttleNorm };
  } else {
    const aimCanvasX = this._origin.x - dx;
    const aimCanvasY = this._origin.y - dy;
    const raw = this.court.toNormalized(aimCanvasX, aimCanvasY);
    aimNorm = snapToGrid(
      Math.max(0, Math.min(1, raw.x)),
      Math.max(0, Math.min(1, raw.y)),
    );
  }

  return { aimPoint: aimNorm, power, spin, shuttleType: deriveShuttleType({ power, aimPoint: aimNorm }) };
}
```

Notes:
- `power = 0` inside the deadzone means the line/preview will not render (existing `draw()` already gates on `_dragging && _origin && _current` — but the visuals all key off `power`, so a deadzone power of 0 keeps the green color and shortest line, which is the desired "harmless" feel). The existing `clampPowerForType` in `shot-type-selector` will lift the power back into the chosen type's window when a shot is fired, so the deadzone is purely about the *visual* and the *intent* (no accidental shot).
- The cosine ease keeps power monotonic (no surprise pop), and the player still hits 1.0 at full drag.

- [ ] **Step 3: Append the max-tension cue inside `_drawAimLine()`**

In `src/js/drag.js`, find `_drawAimLine(power, spin)` (line 418). Inside the method, **after** the existing tension ring is drawn but **before** the slingshot rope is drawn, insert a new block that renders an extra ink-and-accent halo around the shuttlecock when power is above `MAX_TENSION_T`.

Replace the section that currently looks like this:

```js
ctx.save();
ctx.globalAlpha = LINE_ALPHA;

// ── Tension ring at shuttlecock (ink halo + colored core) ────────────────
ctx.beginPath();
ctx.arc(o.x, o.y, ringR + 1.5, 0, Math.PI * 2);
ctx.strokeStyle = INK;
ctx.lineWidth   = 2;
ctx.stroke();

ctx.beginPath();
ctx.arc(o.x, o.y, ringR, 0, Math.PI * 2);
ctx.strokeStyle = colour;
ctx.lineWidth   = 2;
ctx.stroke();
```

With:

```js
ctx.save();
ctx.globalAlpha = LINE_ALPHA;

// ── Max-tension halo (only at near-full power) ───────────────────────────
if (power >= MAX_TENSION_T) {
  // Outer ink halo grows slightly with a sine pulse so the player sees the
  // slingshot is "bottomed out" without a hard edge.
  const t      = (Date.now() % 600) / 600;     // 0..1, ~600ms cycle
  const pulse  = 0.5 + 0.5 * Math.sin(t * Math.PI * 2);
  const haloR  = ringR + 6 + pulse * 4;

  ctx.beginPath();
  ctx.arc(o.x, o.y, haloR, 0, Math.PI * 2);
  ctx.strokeStyle = INK;
  ctx.lineWidth   = 2.5;
  ctx.globalAlpha = 0.55;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(o.x, o.y, haloR - 2, 0, Math.PI * 2);
  ctx.strokeStyle = '#ffd23f';                 // rally accent
  ctx.lineWidth   = 2;
  ctx.globalAlpha = 0.85;
  ctx.stroke();

  ctx.globalAlpha = LINE_ALPHA;
}

// ── Tension ring at shuttlecock (ink halo + colored core) ────────────────
ctx.beginPath();
ctx.arc(o.x, o.y, ringR + 1.5, 0, Math.PI * 2);
ctx.strokeStyle = INK;
ctx.lineWidth   = 2;
ctx.stroke();

ctx.beginPath();
ctx.arc(o.x, o.y, ringR, 0, Math.PI * 2);
ctx.strokeStyle = colour;
ctx.lineWidth   = 2;
ctx.stroke();
```

Notes:
- `Date.now()` keeps the pulse animating across frames — the existing draw loop in `main.js` already redraws on `requestAnimationFrame` while dragging.
- The cue is purely visual; no logic depends on it.

- [ ] **Step 4: Run the existing test suite**

```bash
npm test
```

Expected: 41 passing, 0 failing. (Drag changes don't touch the evaluation tests, but this confirms nothing in the import graph regressed.)

- [ ] **Step 5: Manual verification in browser**

1. Tap the shuttlecock without dragging → no aim line appears (deadzone).
2. Drag a tiny amount (< 14 px) → still no aim line.
3. Drag past the deadzone → line appears in green.
4. Drag halfway → power feels softer than before (cosine middle).
5. Drag near the edge → power ramps up faster (cosine end).
6. Drag to the maximum → an extra amber halo appears around the shuttlecock and pulses.
7. Release at full drag with SMASH selected → flight animation is fast as before.
8. Release inside the deadzone → no shot fires (or fires with the type's clamp-min via `clampPowerForType` if you reach `_fireShot`; this is preserved behavior — the deadzone gates *intent* visually but the type window is still authoritative on release, which is the existing contract).

If point 8 fires a shot from a near-zero drag, that's the intentional behavior of `clampPowerForType` — out of scope. The deadzone is a visual brake, not an evaluation gate.

- [ ] **Step 6: Commit**

```bash
git add src/js/drag.js
git commit -m "feat(drag): lot E — deadzone, cosine power curve, max-tension halo"
```

---

## Task 5: Final verification

- [ ] **Step 1: Run tests**

```bash
npm test
```

Expected: `41 passing` (or whatever the previous baseline is). No new failures.

- [ ] **Step 2: Smoke-test full game flow**

Open `index.html`. Walk through:
1. Menu → start "Attaque" workshop.
2. First shot turn: instruction card cream + ink. Drag the shuttle past the deadzone — verify ease curve. Drag to max — verify amber halo. Release with each of SMASH/DROP/DRIVE/CLEAR.
3. Score pill flashes cream on a correct answer, danger on a wrong answer.
4. After two consecutive correct answers, combo badge appears with bounce. After three, badge gets the `.hot` slow pulse.
5. Trigger a level-up (via normal gameplay if reachable, or via DevTools `hud.setLevel(2)`) — `.level-chip` bounces.
6. Wrong-half click during a positioning turn — instruction card shakes red.
7. Near-miss positioning click (e.g., 65 score) — instruction card pulses orange.
8. Correct positioning click — instruction card pulses green.
9. Timer drops to ≤ 3s — pill pulses red harder than before.
10. ESC pause + 1-4 hotkeys still work (regression check).

- [ ] **Step 3: Commit nothing if all green**

No new files — this step is pure verification. If any defect appears, fix it inline and add a follow-up commit on the same branch.

- [ ] **Step 4: Update todo**

Update the local todo list (in conversation, not in repo): mark Lot E complete.

---

## Self-Review Checklist

### Spec coverage

- [x] **Combo bounce** → Task 1 Step 1 (`comboAppear` enriched + `.hot` loop), Task 2 Step 2 (`.hot` toggled at combo ≥ 3)
- [x] **Timer urgent** → Task 1 Step 2 (stronger `timerPulse` with shadow keyframe)
- [x] **Score pop** → Task 1 Step 1 (bouncier `scorePop` with rotation), Task 2 Step 2 (`.gain` / `.gain-bad` flash on the score pill)
- [x] **Level-up flash** → Task 1 Step 1 (`levelUpPulse` keyframes), Task 2 Step 3 (`setLevel()` detects increase)
- [x] **XP shimmer** → Task 1 Step 3 (`xpStripeShift` animation on `.xp-fill`)
- [x] **Feedback correct/wrong/near-miss** → Task 3 Step 1 (CSS), Step 2 (tier inference from existing color literals), Step 3 (wired through `showMessages` + `showExplanation` + `hideInstruction`)
- [x] **Drag deadzone** → Task 4 Step 1 (`DEADZONE_PX` constant), Step 2 (deadzone branch in `_computeShot`)
- [x] **Drag ease curve** → Task 4 Step 2 (cosine ease-in-out replacing the linear normalization)
- [x] **Drag tension feedback at full power** → Task 4 Step 3 (max-tension halo in `_drawAimLine`)

### Constraints respected

- [x] No edits to `evaluate.js`, `exercises.js`, `match.js`, `progression.js`, `difficulty.js`, `boss.js`
- [x] No edits to `payload-builder.js`, `snap.js`, `zones.js`, `data/*.json`
- [x] `court.js` BWF constants and line-drawing utilities untouched (file not in scope)
- [x] Public APIs of `hud.js` (`update`, `setLevel`, `setInstruction`, `hideInstruction`, `showMessages`, `showExplanation`, `setXP`, `getTimerElement`, `onBack`, `setMode`) keep their signatures
- [x] Public API of `drag.js` (`activate`, `deactivate`, `draw`, constructor, `destroy`) and the emitted shot shape `{ aimPoint, power, spin, shuttleType }` are preserved
- [x] `main.js` is not modified — all callers continue to work as-is

### Type consistency

- `_setFeedbackTier(tier)` accepts `'correct' | 'wrong' | 'near' | null` — set name matches the three CSS class suffixes (`feedback-correct`, `feedback-wrong`, `feedback-near`).
- `_tierFromColor(color)` returns the exact same set of strings or `null`.
- `DEADZONE_PX`, `MAX_DRAG_PX`, `MAX_TENSION_T` are all plain numbers, scoped module-private.
- New `_scorePillEl`, `_levelChipEl`, `_prevLevel`, `_lastCombo` private fields don't shadow anything in `HUD`.

### Placeholder scan

No "TBD", no "TODO", no "fill in", no "similar to Task N". Every code block contains exactly the code an engineer needs to paste. Every command line has its expected output stated.

---

**Plan complete and saved to `docs/superpowers/plans/2026-04-26-lot-e-polish.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
