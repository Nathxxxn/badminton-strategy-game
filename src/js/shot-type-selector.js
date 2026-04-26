/**
 * shot-type-selector.js — Pre-shot type picker (SMASH/DROP/DRIVE/CLEAR)
 * Developer A · Rendering & UI
 *
 * Exposes the type the player intends to play before they drag. The drag
 * (drag.js) still produces aim/power/spin; the selected type is forced into
 * the payload AND clamps the power into a coherent window so the visualised
 * flight matches the chosen intent.
 */

const POWER_WINDOWS = {
  SMASH: [0.72, 1.0],
  DROP:  [0.30, 0.55],
  DRIVE: [0.30, 0.72],
  CLEAR: [0.85, 1.0],
};

const DEFAULT_TYPE = 'SMASH';

export class ShotTypeSelector {
  /**
   * @param {HTMLElement} rootEl  container with [data-shot-type] buttons
   */
  constructor(rootEl) {
    this.root = rootEl;
    this.selected = DEFAULT_TYPE;
    this.root.querySelectorAll('[data-shot-type]').forEach(btn => {
      btn.addEventListener('click', () => this._select(btn.dataset.shotType));
    });
  }

  show() {
    this.root.hidden = false;
    this._refreshActive();
  }

  hide() {
    this.root.hidden = true;
  }

  reset() {
    this._select(DEFAULT_TYPE);
  }

  getSelected() {
    return this.selected;
  }

  /** True iff the selector is currently visible (shot turn). */
  isShown() {
    return this.root.hidden !== true;
  }

  /** Public selector — used by keyboard hotkey wiring. */
  select(type) {
    this._select(type);
  }

  _select(type) {
    if (!POWER_WINDOWS[type]) return;
    this.selected = type;
    this._refreshActive();
  }

  _refreshActive() {
    this.root.querySelectorAll('[data-shot-type]').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.shotType === this.selected);
    });
  }
}

/**
 * Clamp a raw drag-power value into the coherent window for the chosen type.
 * Unknown types are returned as-is so the caller can fall back gracefully.
 *
 * @param {number} power     drag-derived power, 0..1
 * @param {string} type      one of SMASH/DROP/DRIVE/CLEAR
 * @returns {number}         clamped power
 */
export function clampPowerForType(power, type) {
  const w = POWER_WINDOWS[type];
  if (!w) return power;
  return Math.min(Math.max(power, w[0]), w[1]);
}
