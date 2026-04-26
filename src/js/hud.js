/**
 * hud.js — HUD (heads-up display) DOM management
 * Developer A · Rendering & UI
 *
 * Responsibilities:
 *  - Update score, turn counter, combo indicator
 *  - Show/hide and update the instruction card (exercise text)
 *  - Show timed explanation feedback and resolve a Promise when done
 *  - XP bar and level display (wired via setXP / setLevel from Developer B)
 *
 * ── INTEGRATION POINT ────────────────────────────────────────────────────────
 * Developer B: call setXP(current, max) and setLevel(level) from progression.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

export class HUD {
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

  // ─── Visibility ──────────────────────────────────────────────────────────────

  /** Show the entire HUD bar. */
  show() {
    const hud = document.getElementById('hud');
    if (hud) hud.style.display = '';
  }

  /** Hide the entire HUD bar (e.g., during menu screens). */
  hide() {
    const hud = document.getElementById('hud');
    if (hud) hud.style.display = 'none';
  }

  /** @returns {HTMLElement|null} Timer display element used by ExerciseTimer. */
  getTimerElement() {
    return this._timerEl;
  }

  // ─── Score / turn / combo ─────────────────────────────────────────────────

  /**
   * Refresh score, turn counter, and combo badge.
   * @param {number} score
   * @param {number} turnIndex  0-based current turn
   * @param {number} totalTurns Total turns in the rally
   * @param {number} combo      Current combo streak
   */
  update(score, turnIndex, totalTurns, combo) {
    if (score !== this._prevScore) {
      const delta = score - this._prevScore;

      this._scoreEl.textContent = score;
      this._scoreEl.classList.remove('score-pop');
      void this._scoreEl.offsetWidth;
      this._scoreEl.classList.add('score-pop');

      if (this._scorePillEl && delta !== 0 && score !== 0) {
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

  _renderTurnDots(currentIndex, total) {
    if (!this._turnDotsEl) return;
    this._turnDotsEl.innerHTML = '';
    const visible = Math.min(total, 8);
    for (let i = 0; i < visible; i++) {
      const dot = document.createElement('span');
      if (i < currentIndex)        dot.className = 'turn-dot done';
      else if (i === currentIndex) dot.className = 'turn-dot cur';
      else                         dot.className = 'turn-dot';
      this._turnDotsEl.appendChild(dot);
    }
  }

  // ─── Instruction card ─────────────────────────────────────────────────────

  static get _SHOT_ICON() {
    return `<svg viewBox="0 0 24 24" fill="none" width="28" height="28"><path d="M7 16.5L12 7L17 16.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 5.5V3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M5.5 20.5H18.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="12.4" r="1.5" fill="currentColor"/></svg>`;
  }

  static get _POS_ICON() {
    return `<svg viewBox="0 0 24 24" fill="none" width="28" height="28"><rect x="4" y="4" width="16" height="16" rx="4" stroke="currentColor" stroke-width="1.8"/><path d="M8 12H16M12 8V16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="9" cy="15" r="1.4" fill="currentColor"/></svg>`;
  }

  /**
   * Show the instruction card for a turn.
   * @param {{ type: string, label: string, text: string }} turn
   */
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

  /** Hide the instruction card. */
  hideInstruction() {
    this._instrEl.classList.add('hidden');
    this._instrEl.classList.remove('feedback-correct', 'feedback-wrong', 'feedback-near');
  }

  // ─── Feedback explanation ──────────────────────────────────────────────────

  /**
   * Display a feedback explanation in the instruction card for durationMs,
   * then resolve the returned Promise.
   * @param {string} text
   * @param {string} color  CSS color value
   * @param {number} [durationMs=1800]
   * @returns {Promise<void>}
   */
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

  showPopup(type, durationMs = 1400) {
    return new Promise(resolve => {
      if (!this._popupEl) {
        this._popupEl = document.createElement('div');
        Object.assign(this._popupEl.style, {
          position: 'fixed', top: '30%', left: '50%',
          transform: 'translateX(-50%)', padding: '10px 22px',
          borderRadius: '8px', font: 'bold 20px system-ui',
          color: 'white', zIndex: '100', pointerEvents: 'none',
          transition: 'opacity 150ms ease', display: 'none',
        });
        document.body.appendChild(this._popupEl);
      }
      this._popupEl.textContent = type === 'backhand' ? '⬅ REVERS' : '⚠ AU CORPS';
      this._popupEl.style.background = type === 'backhand' ? '#7c3aed' : '#dc2626';
      this._popupEl.style.display = 'block';
      this._popupEl.style.opacity = '1';
      setTimeout(() => {
        this._popupEl.style.opacity = '0';
        setTimeout(() => {
          this._popupEl.style.display = 'none';
          resolve();
        }, 150);
      }, durationMs - 150);
    });
  }

  // ─── Progression (Developer B integration) ──────────────────────────────

  /**
   * Update the XP bar fill.
   * @param {number} current  Current XP
   * @param {number} max      XP needed for next level
   */
  setXP(current, max) {
    const pct = max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 0;
    if (this._xpBarEl) this._xpBarEl.style.width = `${pct}%`;
    if (this._xpTrackEl) this._xpTrackEl.setAttribute('aria-valuenow', pct);

    const curEl = document.getElementById('hud-xp-current');
    const maxEl = document.getElementById('hud-xp-max');
    if (curEl) curEl.textContent = `${current} XP`;
    if (maxEl) maxEl.textContent = `/ ${max}`;
  }

  /**
   * Update the level indicator.
   * @param {number} level
   */
  setLevel(level) {
    if (this._levelNumEl) this._levelNumEl.textContent = level;

    if (this._levelChipEl && this._prevLevel !== null && level > this._prevLevel) {
      this._levelChipEl.classList.remove('level-up');
      void this._levelChipEl.offsetWidth;
      this._levelChipEl.classList.add('level-up');
    }
    this._prevLevel = level;
  }

  // ─── Mode chip / back button ──────────────────────────────────────────────

  /**
   * Wire the back-button click handler. Call once at startup.
   * @param {() => void} callback
   */
  onBack(callback) {
    const btn = document.getElementById('hud-back-btn');
    if (btn && typeof callback === 'function') {
      btn.addEventListener('click', () => callback());
    }
  }

  /**
   * Update the mode chip label + class to reflect the active workshop.
   * @param {'attack'|'defense'|'match'|null} workshop
   */
  setMode(workshop) {
    const chip  = document.getElementById('hud-mode-chip');
    const label = document.getElementById('hud-mode-label');
    if (chip) {
      chip.classList.remove('attack', 'defense', 'match');
      if (workshop) chip.classList.add(workshop);
    }
    if (label) {
      label.textContent =
        workshop === 'attack'  ? 'Attaque' :
        workshop === 'defense' ? 'Défense' :
        workshop === 'match'   ? 'Match'   :
                                 'Entraînement';
    }
  }
}
