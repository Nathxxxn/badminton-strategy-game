/**
 * tutorial.js — Immersive step-by-step tutorial
 * Developer A · Rendering & UI
 */

import { getZoneAt, ZONES }              from './zones.js';
import { startTutorialTurn, retryTutorialTurn, endTutorialMode } from './main.js';

// ─── Tutorial scenarios ────────────────────────────────────────────────────────

const ATTACK_SCENARIO = Object.freeze({
  type: 'shot',
  label: 'Tutorial · Attack',
  text: 'Smash it into the opponent\'s back corner.',
  // scenario.incomingShotType is what prepareTurnForRuntime reads to unlock SMASH
  scenario: { incomingShotType: 'CLEAR' },
  players: {
    ally1:     { x: 0.50, y: 0.72 },
    ally2:     { x: 0.70, y: 0.62 },
    opponent1: { x: 0.30, y: 0.22 },
    opponent2: { x: 0.68, y: 0.18 },
  },
  shuttlecock: {
    from:     { x: 0.38, y: 0.08 },
    position: { x: 0.50, y: 0.70 },
    type: 'CLEAR',
    speed: 'medium',
  },
  passingScore: 0,
  opponentRank: 'P12',
});

const DEFENSE_SCENARIO = Object.freeze({
  type: 'positioning',
  label: 'Tutorial · Defense',
  text: 'Move to mid-court center to recover your position.',
  players: {
    ally1:     { x: 0.25, y: 0.87 },
    ally2:     { x: 0.72, y: 0.80 },
    opponent1: { x: 0.35, y: 0.20 },
    opponent2: { x: 0.65, y: 0.20 },
  },
  playedShuttle: { position: { x: 0.25, y: 0.87 }, type: 'CLEAR' },
  // moveRadius in metres — 2.8m gives a visible circle covering mid-court
  moveRadius: 2.8,
  playerReach: 2.2,
  passingScore: 0,
  opponentRank: 'P12',
});

// ─── Step definitions ──────────────────────────────────────────────────────────

const STEPS = Object.freeze([
  {
    id: 'intro-1',
    kind: 'panel',
    eyebrow: 'WELCOME',
    title: 'Rally — Strategic Badminton',
    body: "I'm your coach. Rally is a tactical training simulator — not just a reflex game.\n\nEvery session consists of simulated situations where your decision-making is evaluated. Think like a coach, move like a player.",
    btn: 'Continue',
  },
  {
    id: 'intro-2',
    kind: 'panel',
    eyebrow: 'TWO PHASES',
    title: 'Attack & Defense',
    body: "ATTACK turns: a shuttle is incoming — you pick a shot type, then drag to aim and fire. Your choice of shot and target zone is evaluated.\n\nDEFENSE turns: a shot was just played — you click the court to reposition yourself tactically. Your new position is scored.",
    btn: 'Continue',
  },
  {
    id: 'intro-3',
    kind: 'panel',
    eyebrow: 'HOW IT WORKS',
    title: 'Shots & Zones',
    body: "The court is split into 18 zones — 9 per half. You aim for specific zones depending on the game situation.\n\nEvery shot type has a purpose: SMASH for finishing points, DROP to draw opponents forward, CLEAR to reset from defense, DRIVE for fast flat exchanges.",
    btn: 'Show me the UI',
    afterStep: 'tour',
  },
  {
    id: 'tour-court',
    kind: 'spotlight',
    selector: '#stage',
    tooltip: 'The court. You play the bottom half — the top belongs to your opponents.\n\nThe dashed circle around your player shows your movement radius: how far you can reach or reposition in one turn.',
    arrow: 'right',
  },
  {
    id: 'tour-instr',
    kind: 'spotlight',
    selector: '#instruction',
    tooltip: 'Your objective for the current turn. Read this first — it tells you what shot to play or where to move.',
    arrow: 'top',
  },
  {
    id: 'tour-shots',
    kind: 'spotlight',
    selector: '#shot-type-selector',
    tooltip: 'Shot type selector. During attack turns, pick one of six shot types here before dragging to aim.',
    arrow: 'top',
  },
  {
    id: 'tour-shots-grayed',
    kind: 'spotlight',
    selector: '#shot-type-selector',
    tooltip: 'Some shots are grayed out based on context. You cannot play a NET DROP when the shuttle is deep in your court — the game only enables shots that are physically realistic.',
    arrow: 'top',
    grayedShots: ['NET_DROP', 'DROP', 'KILL'],
  },
  {
    id: 'tour-stats',
    kind: 'spotlight',
    selector: '.side-rail-left',
    tooltip: 'Live stats and coach tips. Track your shot accuracy, backhand rate, and positioning quality here.',
    arrow: 'right',
  },
  {
    id: 'tour-hud',
    kind: 'spotlight',
    selector: '.hud-center',
    tooltip: 'Score, turn counter, XP bar, and combo badge. Do well on consecutive turns to build your combo.',
    arrow: 'bottom',
  },
  {
    id: 'atk-intro',
    kind: 'panel',
    eyebrow: 'ATTACK PHASE',
    title: 'Time to shoot',
    body: "A CLEAR is incoming — your opponents sent it deep into your half.\n\nNot all shots are always available. Grayed-out buttons mean that shot type is not a realistic reply to what the opponent just played.\n\nYour task: select SMASH and aim into the opponent's court. Select SMASH first, then drag from the shuttle outward in the direction you want to hit.",
    btn: "Let's go →",
  },
  {
    id: 'atk-play',
    kind: 'attack',
    scenario: ATTACK_SCENARIO,
    successCheck: (shot) => {
      if (shot.type !== 'SMASH') return false;
      const zone = getZoneAt(shot.aimPoint.x, shot.aimPoint.y);
      return zone !== null && zone.startsWith('opponent-');
    },
    goalZone: 'opponent-mid-left',
    actionHint: 'SELECT SMASH · drag to aim at the opponent\'s side',
    retryMessage: 'Not quite — select SMASH and aim into the opponent\'s court.',
  },
  {
    id: 'def-intro',
    kind: 'panel',
    eyebrow: 'DEFENSE PHASE',
    title: 'Recover your position',
    body: "You just returned a shot from the back-left corner — now you're out of position.\n\nIn defense turns, you click anywhere on your half to reposition. But you can only move so far: the dashed circle shows your movement radius for this turn.\n\nThe radius depends on how fast the previous rally was — after a slow clear you have more time to cover ground than after a fast smash.\n\nClick inside the highlighted zone to recover to mid-court center.",
    btn: "Let's go →",
  },
  {
    id: 'def-play',
    kind: 'defense',
    scenario: DEFENSE_SCENARIO,
    successCheck: (pos) => {
      const zone = getZoneAt(pos.x, pos.y);
      return zone !== null && zone.startsWith('ally-mid');
    },
    goalZone: 'ally-mid-center',
    actionHint: 'CLICK mid-court center to recover',
    retryMessage: 'Step back toward mid-court — aim for the center area.',
  },
  {
    id: 'end',
    kind: 'end',
    eyebrow: 'TUTORIAL COMPLETE',
    title: 'You know the essentials',
    body: "Position beats power. Shot selection beats raw speed. Keep these principles in mind every turn.\n\nHead back to Home to start your first drill and put this into practice.",
    btn: 'Go to Home',
  },
]);

// ─── TutorialManager ──────────────────────────────────────────────────────────

export class TutorialManager {
  /** @param {{ screens: ScreenManager, court: Court, hud: HUD }} deps */
  constructor({ screens, court, hud }) {
    this._screens = screens;
    this._court   = court;
    this._hud     = hud;
    this._root    = document.getElementById('tutorial-root');
    this._step    = 0;
    this._resolve = null;
    this._goalHighlight = null;
  }

  async start() {
    this._root.classList.add('tut-active');
    await this._runStep(0);
  }

  _next() {
    if (this._resolve) {
      const r = this._resolve;
      this._resolve = null;
      r();
    }
  }

  async abort() {
    this._cleanup();
    endTutorialMode();
    this._screens.show('menu');
  }

  // ── Step runner ─────────────────────────────────────────────────────────────

  async _runStep(i) {
    if (i >= STEPS.length) {
      this._complete();
      return;
    }
    this._step = i;
    const step = STEPS[i];

    this._clearStep();

    if      (step.kind === 'panel')    await this._showPanel(step, i);
    else if (step.kind === 'spotlight') await this._showSpotlight(step, i);
    else if (step.kind === 'attack')   await this._runInteractive(step);
    else if (step.kind === 'defense')  await this._runInteractive(step);
    else if (step.kind === 'end')      await this._showEnd(step);

    if (step.afterStep === 'tour') {
      this._screens.show('exercise');
      this._hud.show();
      this._hud.setMode('training');
      this._court.draw();
    }

    await this._runStep(i + 1);
  }

  // ── Cinematic panel ─────────────────────────────────────────────────────────

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

  // ── Spotlight (outline only, no screen darkening) ───────────────────────────

  _showSpotlight(step, stepIndex) {
    return new Promise(resolve => {
      const el = document.querySelector(step.selector);
      if (!el) { resolve(); return; }

      // Temporarily reveal elements hidden via HTML attribute or CSS class
      const wasHiddenAttr  = el.hidden;
      const wasHiddenClass = el.classList.contains('hidden');
      if (wasHiddenAttr)  el.hidden = false;
      if (wasHiddenClass) el.classList.remove('hidden');
      el.offsetHeight; // force layout flush before measuring

      // Temporarily gray out specified shots
      const grayedEls = [];
      if (step.grayedShots) {
        step.grayedShots.forEach(type => {
          const btn = document.querySelector(`[data-shot-type="${type}"]`);
          if (btn) { btn.disabled = true; grayedEls.push(btn); }
        });
      }

      // Temporarily override instruction text
      let instrTextEl = null;
      let instrOrigText = null;
      let instrCard = null;
      let instrCardWasHidden = false;
      if (step.instructionText) {
        instrCard = document.querySelector('#instruction');
        instrTextEl = document.querySelector('#instr-text');
        if (instrCard) {
          instrCardWasHidden = instrCard.classList.contains('hidden') || instrCard.hidden;
          instrCard.hidden = false;
          instrCard.classList.remove('hidden');
        }
        if (instrTextEl) {
          instrOrigText = instrTextEl.textContent;
          instrTextEl.textContent = step.instructionText;
        }
      }

      this._resolve = () => {
        if (wasHiddenAttr)  el.hidden = true;
        if (wasHiddenClass) el.classList.add('hidden');
        grayedEls.forEach(btn => { btn.disabled = false; });
        if (instrTextEl)  instrTextEl.textContent = instrOrigText;
        if (instrCard && instrCardWasHidden) {
          instrCard.hidden = true;
          instrCard.classList.add('hidden');
        }
        resolve();
      };

      const pad  = 8;
      const rect = el.getBoundingClientRect();

      // Outline veil — no box-shadow darkening, just a border
      const veil = document.createElement('div');
      veil.className = 'tut-spotlight-veil';
      veil.style.cssText = [
        `left: ${rect.left - pad}px`,
        `top: ${rect.top - pad}px`,
        `width: ${rect.width + pad * 2}px`,
        `height: ${rect.height + pad * 2}px`,
      ].join(';');

      // Tooltip
      const tooltip = document.createElement('div');
      tooltip.className = 'tut-tooltip';
      tooltip.dataset.arrow = step.arrow ?? 'bottom';

      const spotlightSteps = STEPS.filter(s => s.kind === 'spotlight');
      const sIdx   = spotlightSteps.indexOf(step);
      const sTotal = spotlightSteps.length;

      tooltip.innerHTML = `
        <p class="tut-tooltip-text">${escHtml(step.tooltip)}</p>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
          <span style="font-family:var(--font-rally-mono);font-size:10px;color:var(--rally-ink-soft);opacity:0.5;letter-spacing:0.06em">${sIdx + 1} / ${sTotal}</span>
          <button class="tut-tooltip-next" type="button">Next ›</button>
        </div>
      `;
      tooltip.querySelector('.tut-tooltip-next').addEventListener('click', () => this._next());

      this._root.appendChild(veil);
      this._root.appendChild(tooltip);

      this._positionTooltip(tooltip, rect, step.arrow ?? 'bottom');

      requestAnimationFrame(() => tooltip.classList.add('tut-visible'));

      const onResize = () => {
        const r2 = el.getBoundingClientRect();
        veil.style.left   = `${r2.left - pad}px`;
        veil.style.top    = `${r2.top  - pad}px`;
        veil.style.width  = `${r2.width  + pad * 2}px`;
        veil.style.height = `${r2.height + pad * 2}px`;
        this._positionTooltip(tooltip, r2, step.arrow ?? 'bottom');
      };
      window.addEventListener('resize', onResize);
      veil._onResize = onResize;
    });
  }

  _positionTooltip(tooltip, rect, arrow) {
    const GAP = 16;
    const TW  = 300;
    const VW  = window.innerWidth;
    const VH  = window.innerHeight;
    tooltip.style.maxWidth = `${TW}px`;

    let left, top;

    if (arrow === 'right') {
      left = rect.right + GAP;
      top  = Math.max(8, rect.top);
    } else if (arrow === 'left') {
      left = rect.left - TW - GAP;
      top  = Math.max(8, rect.top);
    } else if (arrow === 'top') {
      left = rect.left;
      top  = rect.bottom + GAP;
      tooltip.dataset.arrow = 'top';
    } else {
      left = rect.left;
      top  = rect.top - GAP - 160;
    }

    left = Math.max(8, Math.min(left, VW - TW - 8));
    top  = Math.max(8, Math.min(top,  VH - 180));

    tooltip.style.left = `${left}px`;
    tooltip.style.top  = `${top}px`;
  }

  // ── Interactive turn ────────────────────────────────────────────────────────

  _runInteractive(step) {
    return new Promise(resolve => {
      this._clearStep();

      // Let all clicks reach the game canvas
      this._root.style.pointerEvents = 'none';

      // Listen for back-button navigation so we don't leave orphaned overlays
      const backBtn = document.getElementById('hud-back-btn');
      const onBack = () => {
        this._removeGoalHighlight();
        this._cleanup();
        endTutorialMode();
        this._screens.show('menu');
      };
      if (backBtn) backBtn.addEventListener('click', onBack, { once: true });

      let autoAdvanceId = null;

      const advanceAfterSuccess = () => {
        clearTimeout(autoAdvanceId);
        if (backBtn) backBtn.removeEventListener('click', onBack);
        this._root.style.pointerEvents = '';
        this._removeGoalHighlight();
        setTimeout(() => resolve(), 1200);
      };

      // 45 s fallback — auto-advance even if the user never completes the exercise.
      autoAdvanceId = setTimeout(() => {
        endTutorialMode();
        this._removeGoalHighlight();
        this._root.style.pointerEvents = '';
        if (backBtn) backBtn.removeEventListener('click', onBack);
        resolve();
      }, 30000);

      const observer = {
        onShotResult: ({ shot }) => {
          if (step.successCheck(shot)) {
            advanceAfterSuccess();
          } else {
            this._showRetry(step.retryMessage, () => retryTutorialTurn());
          }
        },
        onPositionResult: ({ pos }) => {
          if (step.successCheck(pos)) {
            advanceAfterSuccess();
          } else {
            this._showRetry(step.retryMessage, () => retryTutorialTurn());
          }
        },
      };

      // Compute goal zone center to pin the optimal indicator inside the zone.
      let goalCenter = null;
      if (step.goalZone && ZONES[step.goalZone]) {
        const z = ZONES[step.goalZone];
        goalCenter = { x: (z.x0 + z.x1) / 2, y: (z.y0 + z.y1) / 2 };
      }

      startTutorialTurn(step.scenario, observer, goalCenter);

      // Goal zone rendered after startTutorialTurn so canvas is initialised
      setTimeout(() => this._showGoalHighlight(step.goalZone), 400);
    });
  }

  // ── End panel ───────────────────────────────────────────────────────────────

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

  // ── Goal zone highlight ─────────────────────────────────────────────────────

  _showGoalHighlight(zoneId) {
    if (!zoneId || !this._court) return;
    const zone = ZONES[zoneId];
    if (!zone) return;

    const tl = this._court.toCanvas(zone.x0, zone.y0);
    const br = this._court.toCanvas(zone.x1, zone.y1);

    const canvas = document.getElementById('game-canvas');
    if (!canvas) return;
    const canvasRect = canvas.getBoundingClientRect();

    const el = document.createElement('div');
    el.className = 'tut-goal-highlight';
    el.style.left   = `${canvasRect.left + tl.x}px`;
    el.style.top    = `${canvasRect.top  + tl.y}px`;
    el.style.width  = `${br.x - tl.x}px`;
    el.style.height = `${br.y - tl.y}px`;

    this._root.appendChild(el);
    this._goalHighlight = el;

    const onResize = () => {
      const cr = canvas.getBoundingClientRect();
      const t2 = this._court.toCanvas(zone.x0, zone.y0);
      const b2 = this._court.toCanvas(zone.x1, zone.y1);
      el.style.left   = `${cr.left + t2.x}px`;
      el.style.top    = `${cr.top  + t2.y}px`;
      el.style.width  = `${b2.x - t2.x}px`;
      el.style.height = `${b2.y - t2.y}px`;
    };
    window.addEventListener('resize', onResize);
    el._onResize = onResize;
  }

  _removeGoalHighlight() {
    if (this._goalHighlight) {
      if (this._goalHighlight._onResize) {
        window.removeEventListener('resize', this._goalHighlight._onResize);
      }
      this._goalHighlight.remove();
      this._goalHighlight = null;
    }
  }

  // ── Retry banner ────────────────────────────────────────────────────────────

  _showRetry(message, onRetry) {
    const existing = this._root.querySelector('.tut-retry-banner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.className = 'tut-retry-banner';
    banner.textContent = message;
    this._root.appendChild(banner);

    setTimeout(() => {
      banner.remove();
      onRetry();
    }, 1600);
  }

  // ── Cleanup helpers ─────────────────────────────────────────────────────────

  _clearStep() {
    const children = Array.from(this._root.children);
    for (const el of children) {
      if (el._onResize) window.removeEventListener('resize', el._onResize);
      el.remove();
    }
    this._goalHighlight = null;
  }

  _cleanup() {
    const children = Array.from(this._root.children);
    for (const el of children) {
      if (el._onResize) window.removeEventListener('resize', el._onResize);
      el.remove();
    }
    this._root.classList.remove('tut-active');
    this._root.innerHTML = '';
    this._root.style.pointerEvents = '';
  }

  _complete() {
    localStorage.setItem('rally.tutorialDone', '1');
    endTutorialMode();
    this._cleanup();
    this._screens.show('menu');
  }
}

// ─── Utilities ─────────────────────────────────────────────────────────────────

function escHtml(str = '') {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\n/g, '<br>');
}
