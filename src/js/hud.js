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
    this._scoreEl   = document.getElementById('hud-score');
    this._turnEl    = document.getElementById('hud-turn');
    this._comboEl   = document.getElementById('hud-combo');
    this._instrEl   = document.getElementById('instruction');
    this._labelEl   = document.getElementById('instr-label');
    this._textEl    = document.getElementById('instr-text');
    this._xpBarEl   = document.getElementById('hud-xp-bar');
    this._xpWrapEl  = document.getElementById('hud-xp-wrap');
    this._levelNumEl = document.getElementById('hud-level-num');
    this._prevScore = 0;
    this._popupEl = null;
  }

  // ─── Visibility ──────────────────────────────────────────────────────────────

  /** Show the entire HUD bar. */
  show() {
    this._scoreEl.closest('#hud').style.display = 'flex';
  }

  /** Hide the entire HUD bar (e.g., during menu screens). */
  hide() {
    this._scoreEl.closest('#hud').style.display = 'none';
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
    // Animate score change
    if (score !== this._prevScore) {
      this._scoreEl.textContent = `${score} pts`;
      this._scoreEl.classList.remove('score-pop');
      void this._scoreEl.offsetWidth; // reflow to restart animation
      this._scoreEl.classList.add('score-pop');
      this._prevScore = score;
    }

    this._turnEl.textContent =
      turnIndex < totalTurns
        ? `Tour ${turnIndex + 1} / ${totalTurns}`
        : 'Fin du rally';

    const hadCombo = this._comboEl.textContent !== '';
    const newCombo = combo >= 2 ? `×${combo} COMBO` : '';
    this._comboEl.textContent = newCombo;

    if (newCombo && !hadCombo) {
      this._comboEl.classList.remove('pop');
      void this._comboEl.offsetWidth;
      this._comboEl.classList.add('pop');
    }
  }

  // ─── Instruction card ─────────────────────────────────────────────────────

  /**
   * Show the instruction card for a turn.
   * @param {{ type: string, label: string, text: string }} turn
   */
  setInstruction(turn) {
    this._instrEl.classList.remove('hidden');
    this._labelEl.textContent = turn.label;
    this._labelEl.className   = `label ${turn.type === 'shot' ? 'shot' : 'pos'}`;
    this._textEl.textContent  = turn.text;
    this._textEl.style.color  = '';
  }

  /** Hide the instruction card. */
  hideInstruction() {
    this._instrEl.classList.add('hidden');
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
    if (this._xpBarEl) {
      this._xpBarEl.style.width = `${pct}%`;
    }
    if (this._xpWrapEl) {
      this._xpWrapEl.setAttribute('aria-valuenow', pct);
    }
  }

  /**
   * Update the level indicator.
   * @param {number} level
   */
  setLevel(level) {
    if (this._levelNumEl) {
      this._levelNumEl.textContent = level;
    }
  }
}
