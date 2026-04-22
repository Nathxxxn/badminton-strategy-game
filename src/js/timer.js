/**
 * ExerciseTimer — countdown timer for turn-based exercises.
 *
 * Time allocation is based on the player's ranking classification:
 *   Beginner     (P12, P11, P10) → 15s base
 *   Intermediate (D9,  D8,  D7)  → 12s base
 *   Advanced     (R6,  R5,  R4)  →  9s base
 *   Expert       (N3,  N2,  N1)  →  7s base
 *
 * Multipliers per exercise type:
 *   'shot'        → base × 1.0
 *   'positioning' → base × 1.4 (floored)
 *
 * Unknown ranks fall back to 'P12' (15s).
 */

const RANK_BASE_SECONDS = {
  P12: 15, P11: 15, P10: 15,
  D9: 12,  D8: 12,  D7: 12,
  R6: 9,   R5: 9,   R4: 9,
  N3: 7,   N2: 7,   N1: 7,
};

const POSITIONING_MULTIPLIER = 1.4;
const URGENT_THRESHOLD_SECONDS = 3;

export class ExerciseTimer {
  /**
   * @param {string}      rank        - Player classification e.g. 'P12', 'R5', 'N1'
   * @param {Function}    onTick      - Called every second: onTick(remaining, total)
   * @param {Function}    onExpired   - Called when countdown reaches 0
   * @param {HTMLElement} [displayEl] - Optional DOM element for HUD display
   */
  constructor(rank, onTick, onExpired, displayEl = null) {
    this._rank = Object.prototype.hasOwnProperty.call(RANK_BASE_SECONDS, rank)
      ? rank
      : 'P12';
    this._onTick = onTick;
    this._onExpired = onExpired;
    this._displayEl = displayEl;

    this._intervalId = null;
    this._remaining = 0;
    this._total = 0;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Start the countdown for the given exercise type.
   * Cancels any timer that is already running.
   *
   * @param {'shot'|'positioning'} exerciseType
   * @returns {number} Total seconds allocated for this turn
   */
  start(exerciseType) {
    this.stop();

    const base = RANK_BASE_SECONDS[this._rank];
    const total = exerciseType === 'positioning'
      ? Math.floor(base * POSITIONING_MULTIPLIER)
      : base;

    this._total = total;
    this._remaining = total;

    // Fire an immediate tick so the HUD reflects the starting value right away.
    this._tick();

    this._intervalId = setInterval(() => {
      this._remaining -= 1;

      if (this._remaining <= 0) {
        this._remaining = 0;
        this._tick();
        this.stop();
        this._onExpired();
      } else {
        this._tick();
      }
    }, 1000);

    return total;
  }

  /**
   * Stop and reset the timer. Call when the turn ends normally.
   */
  stop() {
    if (this._intervalId !== null) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }

    this._remaining = 0;
    this._total = 0;

    if (this._displayEl) {
      this._displayEl.textContent = '';
      this._displayEl.classList.remove('timer-urgent');
    }
  }

  /**
   * @returns {boolean} True if the countdown is currently running.
   */
  get isRunning() {
    return this._intervalId !== null;
  }

  get remaining() {
    return this._remaining;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** Update HUD element and invoke the onTick callback. */
  _tick() {
    if (this._displayEl) {
      this._displayEl.textContent = `${this._remaining}s`;

      if (this._remaining <= URGENT_THRESHOLD_SECONDS) {
        this._displayEl.classList.add('timer-urgent');
      } else {
        this._displayEl.classList.remove('timer-urgent');
      }
    }

    this._onTick(this._remaining, this._total);
  }
}
