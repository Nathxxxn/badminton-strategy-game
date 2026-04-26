# Rally Design Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the "Rally" neobrutalist design from `design-inspiration/Match & Practice Screen (1).html` into the live in-game screen, replacing the current dark glassmorphism UI with the cream/ink/green aesthetic — while keeping all court proportions, coordinate math, and game logic entirely intact.

**Architecture:** Keep the canvas full-screen (no structural HTML rearrangement), update in-canvas rendering colors, and replace the HUD + instruction card DOM overlays with the Rally design language. The court itself is drawn entirely in Canvas 2D; only colors and border treatment change. The HUD and instruction card are DOM overlays on top of the canvas.

**Tech Stack:** Vanilla JS, Canvas 2D API, plain CSS, no build tools. Fonts (Bricolage Grotesque + JetBrains Mono) already loaded in `index.html`.

**Hard constraints — NEVER change these:**
- All normalized coordinate math in `court.js` (`toCanvas`, `toNormalized`, `isInBounds`)
- All BWF dimension constants (`NET_Y`, `SHORT_SVC_*`, `LONG_SVC_*`, `SINGLES_*`)
- All line drawing logic (`_hLine`, `_vLine`, `_drawCourtLines`)
- `snap.js` and the 50 cm grid
- Zone system in `zones.js`
- Any file under `src/js/logic/` or `data/`
- Developer B files: `exercises.js`, `evaluate.js`, `match.js`, `progression.js`, `difficulty.js`, `boss.js`

---

## File Map

| File | Action | What changes |
|------|--------|-------------|
| `src/js/court.js` | Modify | COLOUR constants, `draw()` sequence, new `_drawCourtShadow()` and `_drawCourtFrameStroke()`, update `_drawSurface()` with clip, update `_drawNet()` |
| `src/js/renderer.js` | Modify | All color constants, `_drawPlayer()` YOU detection + stroke width |
| `index.html` | Modify | Replace `#hud` inner HTML + replace `#instruction` inner HTML |
| `src/css/style.css` | Modify | Remove dark in-game HUD/instruction CSS, add Rally class styles |
| `src/js/hud.js` | Modify | Constructor DOM refs, `show()`/`hide()`, `update()` with dot rendering, `setInstruction()` with badge icons, `setXP()` XP label IDs |

---

## Task 1: Update `court.js` — colors and court frame

**Files:**
- Modify: `src/js/court.js:45-52` (COLOUR constants)
- Modify: `src/js/court.js:130-142` (`draw()` method)
- Modify: `src/js/court.js:151-161` (`_drawSurface()`)
- Modify: `src/js/court.js:196-223` (`_drawNet()`)
- Create: `_drawCourtShadow()` and `_drawCourtFrameStroke()` (new private methods)

- [ ] **Step 1: Replace COLOUR constants**

In `src/js/court.js`, replace lines 45–52:

```js
const COLOUR = {
  pageBg:   '#f4ecd8',              // cream page background
  surfaceA: '#156b3a',              // opponent's half (darker green)
  surfaceB: '#1f8a4c',              // ally's half (green)
  lines:    '#f4ecd8',              // cream court lines
  net:      '#0f1a14',              // ink net post
  border:   '#0f1a14',              // court frame border / shadow
};

const LINE_W = 1.5;
const NET_W  = 2;
```

- [ ] **Step 2: Update `draw()` to include new frame methods**

Replace the `draw()` method body:

```js
draw() {
  const { ctx, canvas } = this;
  const dpr  = window.devicePixelRatio || 1;
  const cssW = canvas.width  / dpr;
  const cssH = canvas.height / dpr;

  ctx.clearRect(0, 0, cssW, cssH);

  this._drawPageBackground(cssW, cssH);  // cream
  this._drawCourtShadow();               // ink offset shadow
  this._drawSurface();                   // green halves (clipped)
  this._drawCourtLines();                // cream lines
  this._drawNet();                       // ink net
  this._drawCourtFrameStroke();          // ink border on top
}
```

- [ ] **Step 3: Update `_drawPageBackground`**

Replace the method body (keep method signature):

```js
_drawPageBackground(w, h) {
  this.ctx.fillStyle = COLOUR.pageBg;
  this.ctx.fillRect(0, 0, w, h);
}
```

- [ ] **Step 4: Add `_drawCourtShadow()` after `_drawPageBackground`**

Insert this new method immediately after `_drawPageBackground`:

```js
_drawCourtShadow() {
  const { ctx, courtX, courtY, courtW, courtH } = this;
  ctx.save();
  ctx.fillStyle = COLOUR.border;
  ctx.beginPath();
  ctx.roundRect(courtX + 6, courtY + 6, courtW, courtH, 12);
  ctx.fill();
  ctx.restore();
}
```

- [ ] **Step 5: Update `_drawSurface()` to clip to rounded rect**

Replace the `_drawSurface()` method body:

```js
_drawSurface() {
  const { ctx, courtX, courtY, courtW, courtH } = this;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(courtX, courtY, courtW, courtH, 12);
  ctx.clip();

  ctx.fillStyle = COLOUR.surfaceA;
  ctx.fillRect(courtX, courtY, courtW, courtH * 0.5);

  ctx.fillStyle = COLOUR.surfaceB;
  ctx.fillRect(courtX, courtY + courtH * 0.5, courtW, courtH * 0.5);

  ctx.restore();
}
```

- [ ] **Step 6: Add `_drawCourtFrameStroke()` before the line utilities section**

Insert this new method immediately before the `_hLine` utility:

```js
_drawCourtFrameStroke() {
  const { ctx, courtX, courtY, courtW, courtH } = this;
  ctx.save();
  ctx.strokeStyle = COLOUR.border;
  ctx.lineWidth   = 4;
  ctx.beginPath();
  ctx.roundRect(courtX, courtY, courtW, courtH, 12);
  ctx.stroke();
  ctx.restore();
}
```

- [ ] **Step 7: Update `_drawNet()` to ink style (no glow)**

Replace the entire `_drawNet()` method body:

```js
_drawNet() {
  const { ctx } = this;
  const left  = this.toCanvas(0, NET_Y);
  const right = this.toCanvas(1, NET_Y);
  const bandH = Math.round(this.courtH * 0.022);

  ctx.save();

  // Subtle net band (hatch feel via translucent fill)
  ctx.fillStyle = 'rgba(15,26,20,0.22)';
  ctx.fillRect(left.x, left.y - Math.floor(bandH * 0.5), this.courtW, bandH);

  // Net post line
  ctx.strokeStyle = COLOUR.net;
  ctx.lineWidth   = NET_W;
  ctx.lineCap     = 'square';
  ctx.beginPath();
  ctx.moveTo(left.x, left.y);
  ctx.lineTo(right.x, right.y);
  ctx.stroke();

  ctx.restore();
}
```

- [ ] **Step 8: Open `index.html` in browser and verify**

Expected: cream/paper page background visible in the court padding area; court is green with cream lines; no glow on net; net is a thin dark line; court has a dark drop shadow offset 6px bottom-right and a dark 4px border with rounded corners.

The court proportions, line positions, and net position must be identical to before.

- [ ] **Step 9: Commit**

```bash
git add src/js/court.js
git commit -m "feat(court): rally design — cream bg, green surface, ink border frame"
```

---

## Task 2: Update `renderer.js` — player and shuttlecock colors

**Files:**
- Modify: `src/js/renderer.js:22-52` (color constants)
- Modify: `src/js/renderer.js:169-219` (`_drawPlayer()`)

- [ ] **Step 1: Replace all color constants**

Replace the constants block (lines 22–51) with:

```js
// ── Player colors — Rally design ───────────────────────────────────────────

// YOU (ally1 with label "YOU") — amber accent
const YOU_FILL    = '#ffd23f';
const YOU_STROKE  = '#0f1a14';
const YOU_LABEL   = '#0f1a14';

// Ally (partner) — blue
const ALLY_FILL   = '#2e6fc5';
const ALLY_STROKE = '#0f1a14';
const ALLY_LABEL  = '#fff8e1';

// Opponents — danger red
const OPP_FILL    = '#e85d3c';
const OPP_STROKE  = '#0f1a14';
const OPP_LABEL   = '#fff8e1';

// Ghost (movingTo preview)
const GHOST_ALPHA = 0.30;

// Glow (active player) — amber
const GLOW_COLOUR = 'rgba(255, 210, 63, 0.70)';
const GLOW_BLUR   = 18;

// Label
const LABEL_FONT_RATIO = 0.45;

// Shuttlecock — feather white with ink border
const SHUTTLE_RADIUS_RATIO = 0.022;
const SHUTTLE_FILL   = '#fff8e1';
const SHUTTLE_STROKE = '#0f1a14';
const CORK_RADIUS_RATIO = 0.008;

// Trajectory — ink dashes
const TRAJ_COLOUR = 'rgba(15, 26, 20, 0.40)';
const TRAJ_DASH   = [5, 5];
const TRAJ_WIDTH  = 1.5;

const TRAIL_SEGMENTS = { slow: 3, medium: 6, fast: 10 };
```

- [ ] **Step 2: Update `_drawPlayer()` to detect YOU player**

Replace the `_drawPlayer()` method body:

```js
_drawPlayer(pos, isAlly, label, isActive, hand = null) {
  const { ctx, court } = this;
  const snapped = snapToGrid(pos.x, pos.y);
  const { x, y } = court.toCanvas(snapped.x, snapped.y);
  const r = court.courtW * PLAYER_RADIUS_RATIO;

  const isYou = label === 'YOU';
  const fill       = isYou ? YOU_FILL   : isAlly ? ALLY_FILL   : OPP_FILL;
  const stroke     = isYou ? YOU_STROKE : isAlly ? ALLY_STROKE : OPP_STROKE;
  const labelColor = isYou ? YOU_LABEL  : isAlly ? ALLY_LABEL  : OPP_LABEL;

  ctx.save();

  if (isActive) {
    ctx.shadowColor = GLOW_COLOUR;
    ctx.shadowBlur  = GLOW_BLUR;
  }

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle   = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth   = 3;
  ctx.stroke();

  ctx.shadowBlur = 0;

  const fontSize = Math.round(r * LABEL_FONT_RATIO * 2);
  ctx.font        = `800 ${fontSize}px 'JetBrains Mono', monospace`;
  ctx.fillStyle   = labelColor;
  ctx.textAlign   = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y);

  if (hand === 'left' || hand === 'right') {
    const badgeR = r * 0.32;
    const bx = x + r * 0.7;
    const by = y - r * 0.7;
    ctx.beginPath();
    ctx.arc(bx, by, badgeR, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd23f';
    ctx.fill();
    ctx.strokeStyle = '#0f1a14';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#0f1a14';
    ctx.font = `bold ${Math.round(r * 0.3)}px 'JetBrains Mono', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(hand === 'left' ? 'L' : 'R', bx, by);
  }

  ctx.restore();
}
```

- [ ] **Step 3: Verify in browser**

Expected: YOU player = amber circle with ink border and dark label; partner = blue circle with ink border and light label; opponents = red circles with ink border and light label; glow effect on active player is amber.

- [ ] **Step 4: Commit**

```bash
git add src/js/renderer.js
git commit -m "feat(renderer): rally design — player and shuttle colors, YOU detection"
```

---

## Task 3: Restructure `index.html` — HUD and instruction card HTML

**Files:**
- Modify: `index.html` (lines 31–59)

- [ ] **Step 1: Replace the `#hud` and `#instruction` blocks**

In `index.html`, replace everything from `<div id="hud"` through `</div> <!-- end instruction -->` (and the `#end-screen` block stays unchanged) with:

```html
  <div id="hud" aria-live="polite">
    <div class="hud-left">
      <div class="nav-left">
        <button class="icon-btn" id="hud-back-btn" title="Retour" aria-label="Retour">
          <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
            <path d="M15 6L9 12L15 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
      <div class="mode-chip" id="hud-mode-chip">
        <span class="mode-dot"></span>
        <span id="hud-mode-label">Entraînement</span>
      </div>
      <div class="level-chip">
        <span class="level-tag">LVL</span>
        <span id="hud-level-num">1</span>
      </div>
      <div class="xp-wrap">
        <div class="xp-track" role="progressbar" aria-label="XP" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">
          <div id="hud-xp-bar" class="xp-fill" style="width:0%"></div>
        </div>
        <div class="xp-label">
          <span id="hud-xp-current">0 XP</span>
          <span id="hud-xp-max">/ 500</span>
        </div>
      </div>
    </div>

    <div id="hud-center">
      <div class="turn-indicator">
        <span class="turn-label">TOUR</span>
        <span id="hud-turn-cur" class="turn-cur">1</span>
        <span class="turn-sep">/</span>
        <span id="hud-turn-total" class="turn-tot">4</span>
        <div class="turn-dots" id="hud-turn-dots"></div>
      </div>
    </div>

    <div id="hud-right">
      <div class="timer-pill" id="hud-timer-wrap">
        <svg viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true">
          <circle cx="12" cy="13" r="8" stroke="currentColor" stroke-width="2"/>
          <path d="M12 9V13L14.5 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <path d="M10 4H14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <span id="hud-timer">--</span>
      </div>
      <div class="score-pill">
        <span class="score-val" id="hud-score">0</span>
        <span class="score-unit">pts</span>
      </div>
      <div class="combo-badge" id="hud-combo" hidden></div>
    </div>
  </div>

  <div id="instruction" class="instr hidden">
    <div class="instr-badge pos" id="instr-badge">
      <svg viewBox="0 0 24 24" fill="none" width="28" height="28">
        <rect x="4" y="4" width="16" height="16" rx="4" stroke="currentColor" stroke-width="1.8"/>
        <path d="M8 12H16M12 8V16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        <circle cx="9" cy="15" r="1.4" fill="currentColor"/>
      </svg>
    </div>
    <div class="instr-body">
      <div class="instr-label pos" id="instr-label">Placement</div>
      <div class="instr-text" id="instr-text">Chargement…</div>
      <div class="instr-meta" id="instr-meta">Clique dans ta moitié · reste dans ton rayon</div>
    </div>
  </div>
```

- [ ] **Step 2: Verify page loads without JS errors**

Open `index.html` in a browser and check the console. No errors expected.

---

## Task 4: Update `src/css/style.css` — Rally in-game UI styles

**Files:**
- Modify: `src/css/style.css`

This task replaces the `#hud` and `#instruction` dark-glassmorphism CSS with Rally neobrutalist styles, and adds all the new class styles.

- [ ] **Step 1: Replace the `#hud` block**

Find the `/* ─── HUD overlay ───` section (lines 183–309) and replace the entire block with:

```css
/* ─── HUD overlay — Rally design ────────────────────────────────────────────── */
#hud {
  position: fixed;
  top: 0; left: 0; right: 0;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 14px;
  padding: 12px 20px;
  background: var(--rally-cream);
  border-bottom: 3px solid var(--rally-ink);
  box-shadow: 0 3px 0 0 var(--rally-ink);
  font-family: var(--font-rally);
  color: var(--rally-ink);
  z-index: var(--z-hud);
}

.hud-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: nowrap;
}

#hud-center {
  display: flex;
  justify-content: center;
}

#hud-right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

/* Back / pause icon buttons */
.nav-left { display: flex; gap: 6px; }
.icon-btn {
  width: 38px; height: 38px;
  background: var(--rally-cream);
  border: 3px solid var(--rally-ink);
  border-radius: 10px;
  box-shadow: 3px 3px 0 0 var(--rally-ink);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: var(--rally-ink);
  transition: transform 100ms ease, box-shadow 100ms ease;
}
.icon-btn:hover { transform: translate(-1px,-1px); box-shadow: 4px 4px 0 0 var(--rally-ink); }
.icon-btn:active { transform: translate(2px,2px); box-shadow: 1px 1px 0 0 var(--rally-ink); }
.icon-btn svg { display: block; }

/* Mode chip */
.mode-chip {
  display: inline-flex; align-items: center; gap: 7px;
  background: var(--rally-cream);
  border: 3px solid var(--rally-ink); border-radius: 10px;
  padding: 6px 12px;
  box-shadow: 3px 3px 0 0 var(--rally-ink);
  font-weight: 700; font-size: 13px;
}
.mode-dot {
  width: 9px; height: 9px; border-radius: 50%;
  background: var(--rally-court);
}
.mode-chip.attack .mode-dot  { background: var(--rally-danger); }
.mode-chip.match  .mode-dot  { background: #2e6fc5; }

/* Level chip */
.level-chip {
  display: inline-flex; align-items: center; gap: 0;
  border: 3px solid var(--rally-ink); border-radius: 999px;
  overflow: hidden; box-shadow: 3px 3px 0 0 var(--rally-ink);
  background: var(--rally-cream);
}
.level-tag {
  background: var(--rally-ink); color: var(--rally-accent);
  padding: 5px 8px;
  font-family: var(--font-rally-mono); font-size: 9px; font-weight: 700;
  letter-spacing: 1.5px; text-transform: uppercase;
}
.level-chip #hud-level-num {
  padding: 5px 12px; font-weight: 800; font-size: 15px;
  font-family: var(--font-rally);
}

/* XP bar */
.xp-wrap { display: flex; flex-direction: column; gap: 3px; min-width: 180px; }
.xp-track {
  height: 13px;
  background: var(--rally-cream-2);
  border: 2.5px solid var(--rally-ink); border-radius: 999px;
  box-shadow: 3px 3px 0 0 var(--rally-ink);
  overflow: hidden; position: relative;
}
.xp-fill {
  height: 100%;
  background: repeating-linear-gradient(
    -45deg,
    var(--rally-accent) 0 6px,
    #ffb547 6px 12px
  );
  border-right: 2.5px solid var(--rally-ink);
  transition: width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.xp-label {
  display: flex; justify-content: space-between;
  font-family: var(--font-rally-mono); font-size: 10px;
  font-weight: 700; letter-spacing: 1px; text-transform: uppercase;
  color: var(--rally-ink-soft);
}

/* Turn indicator */
.turn-indicator {
  display: flex; align-items: center; gap: 6px;
  padding: 7px 14px;
  background: var(--rally-cream);
  border: 3px solid var(--rally-ink); border-radius: 12px;
  box-shadow: 3px 3px 0 0 var(--rally-ink);
  font-weight: 800; font-size: 13px;
  font-family: var(--font-rally-mono);
}
.turn-label { letter-spacing: 1.5px; }
.turn-cur { color: var(--rally-court-dark); }
.turn-sep { opacity: 0.35; }
.turn-tot { opacity: 0.55; }
.turn-dots { display: flex; gap: 4px; margin-left: 6px; }
.turn-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--rally-cream-2); border: 1.5px solid var(--rally-ink);
}
.turn-dot.done { background: var(--rally-correct, #3aa66a); }
.turn-dot.cur  {
  background: var(--rally-accent);
  box-shadow: 0 0 0 2px var(--rally-cream), 0 0 0 3.5px var(--rally-ink);
}

/* Timer pill */
.timer-pill {
  display: inline-flex; align-items: center; gap: 7px;
  background: var(--rally-cream);
  border: 3px solid var(--rally-ink); border-radius: 12px;
  padding: 6px 12px;
  box-shadow: 3px 3px 0 0 var(--rally-ink);
  font-family: var(--font-rally-mono); font-weight: 800; font-size: 17px;
  min-width: 76px; justify-content: center;
}
.timer-pill:has(#hud-timer.timer-urgent) {
  background: var(--rally-danger); color: var(--rally-feather);
  animation: timerPulse 0.6s infinite alternate;
}
@keyframes timerPulse {
  from { transform: scale(1); }
  to   { transform: scale(1.05); }
}

/* Score pill */
.score-pill {
  display: inline-flex; align-items: baseline; gap: 5px;
  background: var(--rally-accent);
  border: 3px solid var(--rally-ink); border-radius: 12px;
  padding: 6px 14px;
  box-shadow: 4px 4px 0 0 var(--rally-ink);
  font-weight: 800;
}
.score-val { font-size: 20px; }
.score-unit {
  font-size: 10px; font-family: var(--font-rally-mono);
  letter-spacing: 1px; text-transform: uppercase;
}

/* Combo badge */
.combo-badge {
  display: inline-flex; align-items: center; gap: 4px;
  background: var(--rally-ink); color: var(--rally-accent);
  border: 3px solid var(--rally-ink); border-radius: 999px;
  padding: 5px 12px;
  font-family: var(--font-rally-mono); font-weight: 800; font-size: 12px;
  letter-spacing: 1px; text-transform: uppercase;
  box-shadow: 3px 3px 0 0 #ffb547;
}
.combo-badge[hidden] { display: none; }

@keyframes comboAppear {
  0%   { transform: scale(1.5) rotate(-4deg); opacity: 0; }
  60%  { transform: scale(0.9) rotate(2deg); }
  100% { transform: scale(1) rotate(0); opacity: 1; }
}
.combo-badge.pop { animation: comboAppear 0.4s ease-out both; }

/* Score pop animation */
@keyframes scorePop {
  0%   { transform: scale(1);    }
  40%  { transform: scale(1.25); }
  100% { transform: scale(1);    }
}
#hud-score.score-pop { animation: scorePop 0.35s ease-out both; }
```

- [ ] **Step 2: Replace the `#instruction` block**

Find `/* ─── Instruction card ───` section (lines 311–366) and replace the entire block with:

```css
/* ─── Instruction card — Rally design ───────────────────────────────────────── */
.instr {
  position: fixed;
  bottom: 24px; left: 50%; transform: translateX(-50%);
  width: min(600px, calc(100% - 48px));
  background: var(--rally-cream);
  border: 4px solid var(--rally-ink);
  border-radius: 20px;
  box-shadow: 6px 6px 0 0 var(--rally-ink);
  padding: 14px 18px;
  display: grid;
  grid-template-columns: 52px 1fr;
  gap: 14px;
  align-items: center;
  z-index: var(--z-hud);
  font-family: var(--font-rally);
  color: var(--rally-ink);
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.instr.hidden {
  opacity: 0;
  transform: translateX(-50%) translateY(20px);
  pointer-events: none;
}

/* Badge icon */
.instr-badge {
  width: 52px; height: 52px;
  background: var(--rally-ink); color: var(--rally-accent);
  border: 3px solid var(--rally-ink); border-radius: 14px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.instr-badge.shot { background: var(--rally-danger); color: var(--rally-feather); }
.instr-badge.pos  { background: #2e6fc5;              color: var(--rally-feather); }

/* Body */
.instr-body { display: flex; flex-direction: column; gap: 3px; }

.instr-label {
  display: inline-flex; align-items: center; gap: 6px;
  font-family: var(--font-rally-mono); font-size: 10px; font-weight: 700;
  letter-spacing: 2px; text-transform: uppercase;
  color: var(--rally-ink-soft);
}
.instr-label::before {
  content: ''; display: inline-block;
  width: 8px; height: 8px; border-radius: 50%; background: currentColor;
  flex-shrink: 0;
}
.instr-label.shot { color: var(--rally-danger); }
.instr-label.pos  { color: #2e6fc5; }

.instr-text {
  font-size: 16px; font-weight: 700; line-height: 1.3; color: var(--rally-ink);
}

.instr-meta {
  margin-top: 2px; font-size: 11px; color: var(--rally-ink-soft);
  font-family: var(--font-rally-mono);
}
```

- [ ] **Step 3: Remove the old `#end-screen` dark styles and keep them (no change needed)**

The `#end-screen` block remains. Do not edit it in this task.

- [ ] **Step 4: Verify in browser**

Open `index.html` and start an exercise. Expected:
- Top HUD bar: cream background with ink border, shows LVL chip, XP bar with diagonal stripe fill, turn indicator with dots, timer pill, score pill.
- Instruction card at bottom: cream card with thick ink border and drop shadow, badge icon on left, label + text on right.

- [ ] **Step 5: Commit**

```bash
git add src/css/style.css
git commit -m "feat(css): rally design — HUD and instruction card styles"
```

---

## Task 5: Update `src/js/hud.js` — DOM references and methods

**Files:**
- Modify: `src/js/hud.js` (full file, ~195 lines)

- [ ] **Step 1: Update constructor**

Replace the constructor body:

```js
constructor() {
  this._scoreEl     = document.getElementById('hud-score');
  this._turnCurEl   = document.getElementById('hud-turn-cur');
  this._turnTotEl   = document.getElementById('hud-turn-total');
  this._turnDotsEl  = document.getElementById('hud-turn-dots');
  this._comboEl     = document.getElementById('hud-combo');
  this._timerEl     = document.getElementById('hud-timer');
  this._instrEl     = document.getElementById('instruction');
  this._badgeEl     = document.getElementById('instr-badge');
  this._labelEl     = document.getElementById('instr-label');
  this._textEl      = document.getElementById('instr-text');
  this._metaEl      = document.getElementById('instr-meta');
  this._xpBarEl     = document.getElementById('hud-xp-bar');
  this._xpTrackEl   = document.getElementById('hud-xp-bar')?.parentElement ?? null;
  this._levelNumEl  = document.getElementById('hud-level-num');
  this._prevScore   = 0;
  this._popupEl     = null;
}
```

- [ ] **Step 2: Update `show()` and `hide()`**

Replace both methods:

```js
show() {
  const hud = document.getElementById('hud');
  if (hud) hud.style.display = '';
}

hide() {
  const hud = document.getElementById('hud');
  if (hud) hud.style.display = 'none';
}
```

- [ ] **Step 3: Update `getTimerElement()`**

No change needed — still returns `this._timerEl` (`#hud-timer`).

- [ ] **Step 4: Replace `update()` with turn dot support**

Replace the entire `update()` method:

```js
update(score, turnIndex, totalTurns, combo) {
  if (score !== this._prevScore) {
    this._scoreEl.textContent = score;
    this._scoreEl.classList.remove('score-pop');
    void this._scoreEl.offsetWidth;
    this._scoreEl.classList.add('score-pop');
    this._prevScore = score;
  }

  const cur = turnIndex < totalTurns ? turnIndex + 1 : totalTurns;
  if (this._turnCurEl)  this._turnCurEl.textContent  = cur;
  if (this._turnTotEl)  this._turnTotEl.textContent  = totalTurns;
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
  } else {
    this._comboEl.hidden = true;
    this._comboEl.textContent = '';
  }
}
```

- [ ] **Step 5: Add `_renderTurnDots()` private method**

Add immediately after `update()`:

```js
_renderTurnDots(currentIndex, total) {
  if (!this._turnDotsEl) return;
  this._turnDotsEl.innerHTML = '';
  const visible = Math.min(total, 8);
  for (let i = 0; i < visible; i++) {
    const dot = document.createElement('span');
    if (i < currentIndex) dot.className = 'turn-dot done';
    else if (i === currentIndex) dot.className = 'turn-dot cur';
    else dot.className = 'turn-dot';
    this._turnDotsEl.appendChild(dot);
  }
}
```

- [ ] **Step 6: Update `setInstruction()` with badge icon switching**

Replace the `setInstruction()` method:

```js
// SVG icons for the instruction badge
static get _SHOT_ICON() {
  return `<svg viewBox="0 0 24 24" fill="none" width="28" height="28"><path d="M7 16.5L12 7L17 16.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 5.5V3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M5.5 20.5H18.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="12.4" r="1.5" fill="currentColor"/></svg>`;
}
static get _POS_ICON() {
  return `<svg viewBox="0 0 24 24" fill="none" width="28" height="28"><rect x="4" y="4" width="16" height="16" rx="4" stroke="currentColor" stroke-width="1.8"/><path d="M8 12H16M12 8V16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="9" cy="15" r="1.4" fill="currentColor"/></svg>`;
}

setInstruction(turn) {
  this._instrEl.classList.remove('hidden');
  this._instrEl.dataset.type = turn.type;

  const isShot = turn.type === 'shot';
  this._labelEl.className  = `instr-label ${isShot ? 'shot' : 'pos'}`;
  this._labelEl.textContent = turn.label;
  this._textEl.textContent  = turn.text;
  this._textEl.style.color  = '';

  if (this._badgeEl) {
    this._badgeEl.innerHTML  = isShot ? HUD._SHOT_ICON : HUD._POS_ICON;
    this._badgeEl.className  = `instr-badge ${isShot ? 'shot' : 'pos'}`;
  }

  if (this._metaEl) {
    this._metaEl.textContent = isShot
      ? 'Saisis le volant · tire · relâche'
      : 'Clique dans ta moitié · reste dans ton rayon';
  }
}
```

- [ ] **Step 7: Update `hideInstruction()`**

No change needed — still adds `.hidden` class to `this._instrEl`.

- [ ] **Step 8: Update `showExplanation()` and `showMessages()`**

No change needed — still manipulates `this._textEl.textContent` and `color`.

- [ ] **Step 9: Update `setXP()` to refresh XP labels**

Replace `setXP()`:

```js
setXP(current, max) {
  const pct = max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 0;
  if (this._xpBarEl) this._xpBarEl.style.width = `${pct}%`;
  if (this._xpTrackEl) this._xpTrackEl.setAttribute('aria-valuenow', pct);

  const curEl = document.getElementById('hud-xp-current');
  const maxEl = document.getElementById('hud-xp-max');
  if (curEl) curEl.textContent = `${current} XP`;
  if (maxEl) maxEl.textContent = `/ ${max}`;
}
```

- [ ] **Step 10: Verify full game flow in browser**

Launch the app and play through a full exercise set. Verify:
1. HUD level chip shows current level
2. XP bar fills with diagonal stripe pattern, labels update
3. Turn indicator shows correct turn number and dots (done=green, cur=amber, pending=cream)
4. Timer pill shows countdown; turns urgent red when ≤ 3s
5. Score pill updates with pop animation
6. Combo badge appears/disappears with shake animation
7. Instruction card shows correct icon (blue target for positioning, red racket for shot), label, and description text
8. Instruction card slides in/out correctly

- [ ] **Step 11: Commit**

```bash
git add src/js/hud.js
git commit -m "feat(hud): rally design — new DOM refs, turn dots, instruction badge icons"
```

---

## Self-Review Checklist

### Spec coverage
- [x] Cream/paper background during game → court.js `pageBg: '#f4ecd8'`
- [x] Green court surface (`#1f8a4c`) → court.js `surfaceB`
- [x] Darker opponent half (`#156b3a`) → court.js `surfaceA`
- [x] Cream court lines → court.js `lines: '#f4ecd8'`
- [x] Ink net with band → court.js `_drawNet()` with band + post line
- [x] Court card frame (border + drop shadow) → `_drawCourtShadow()` + `_drawCourtFrameStroke()`
- [x] YOU player = amber `#ffd23f` with ink border → renderer.js `YOU_FILL`
- [x] Ally player = blue `#2e6fc5` with ink border → renderer.js `ALLY_FILL`
- [x] Opponent players = red `#e85d3c` with ink border → renderer.js `OPP_FILL`
- [x] JetBrains Mono labels on players → renderer.js font string
- [x] HUD bar: level chip, XP stripe bar, turn dots, timer pill, score pill, combo badge → index.html + style.css + hud.js
- [x] Instruction card: badge icon, type label, description text, meta hint → index.html + style.css + hud.js

### Constraints respected
- [x] `toCanvas()` / `toNormalized()` untouched
- [x] All BWF constants untouched
- [x] `_drawCourtLines()` / `_hLine()` / `_vLine()` untouched
- [x] `snap.js` untouched
- [x] `zones.js` untouched
- [x] All Developer B files untouched
- [x] `data/*.json` untouched

### Type consistency
- `hud.js` `update(score, turnIndex, totalTurns, combo)` — same signature as before
- `hud.js` `setInstruction(turn)` — same `turn.type` and `turn.label` and `turn.text` interface
- `hud.js` `setXP(current, max)` — same signature
- `hud.js` `getTimerElement()` — still returns `#hud-timer` element

---

**Plan complete and saved to `docs/superpowers/plans/2026-04-26-rally-design-integration.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — Fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch with checkpoints

**Which approach?**
