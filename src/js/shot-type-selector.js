/**
 * shot-type-selector.js — Pre-shot type picker (SMASH/DROP/DRIVE/CLEAR/KILL/NET_DROP)
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
  KILL:  [0.55, 1.0],
  NET_DROP: [0.0, 0.30],
};

const DEFAULT_TYPE = 'SMASH';
const ALL_SHOT_TYPES = Object.keys(POWER_WINDOWS);

export class ShotTypeSelector {
  /**
   * @param {HTMLElement} rootEl  container with [data-shot-type] buttons
   * @param {{ onChange?: function(string): void }} options
   */
  constructor(rootEl, { onChange = null } = {}) {
    this.root = rootEl;
    this.buttons = Array.from(this.root.querySelectorAll('[data-shot-type]'));
    this.selected = DEFAULT_TYPE;
    this.allowedTypes = new Set(ALL_SHOT_TYPES);
    this.onChange = typeof onChange === 'function' ? onChange : null;
    this.buttons.forEach(btn => {
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
    if (this.allowedTypes.has(DEFAULT_TYPE)) {
      this._select(DEFAULT_TYPE);
      return;
    }

    this.selected = this._firstAllowedType() ?? DEFAULT_TYPE;
    this._refreshActive();
    this._notifyChange();
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

  /**
   * Restrict playable shot types for the current incoming shuttle.
   *
   * @param {string[]} types  allowed reply types from SHOT_PROFILES[incoming].allowed
   */
  setAllowedTypes(types = ALL_SHOT_TYPES) {
    const knownTypes = Array.isArray(types)
      ? types.filter(type => POWER_WINDOWS[type])
      : [];

    this.allowedTypes = new Set(knownTypes.length > 0 ? knownTypes : ALL_SHOT_TYPES);
    const previous = this.selected;
    if (!this.allowedTypes.has(this.selected)) {
      this.selected = this._firstAllowedType() ?? DEFAULT_TYPE;
    }
    this._refreshActive();
    if (this.selected !== previous) this._notifyChange();
  }

  _select(type) {
    if (!POWER_WINDOWS[type] || !this.allowedTypes.has(type)) return;
    const previous = this.selected;
    this.selected = type;
    this._refreshActive();
    if (this.selected !== previous) this._notifyChange();
  }

  _firstAllowedType() {
    return this.buttons.find(btn => this.allowedTypes.has(btn.dataset.shotType))?.dataset.shotType ?? null;
  }

  _refreshActive() {
    this.buttons.forEach(btn => {
      const isAllowed = this.allowedTypes.has(btn.dataset.shotType);
      btn.disabled = !isAllowed;
      if (isAllowed) btn.removeAttribute('aria-disabled');
      else           btn.setAttribute('aria-disabled', 'true');
      btn.classList.toggle('is-disabled', !isAllowed);
      btn.classList.toggle('is-active', isAllowed && btn.dataset.shotType === this.selected);
    });
  }

  _notifyChange() {
    if (this.onChange) this.onChange(this.selected);
  }
}

/**
 * Clamp a raw drag-power value into the coherent window for the chosen type.
 * Unknown types are returned as-is so the caller can fall back gracefully.
 *
 * @param {number} power     drag-derived power, 0..1
 * @param {string} type      one of SMASH/DROP/DRIVE/CLEAR/KILL/NET_DROP
 * @returns {number}         clamped power
 */
export function clampPowerForType(power, type) {
  const w = POWER_WINDOWS[type];
  if (!w) return power;
  return Math.min(Math.max(power, w[0]), w[1]);
}
