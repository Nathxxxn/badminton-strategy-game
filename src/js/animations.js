/**
 * animations.js — Shuttlecock flight and feedback transition animations
 * Developer A · Rendering & UI
 *
 * Responsibilities:
 *  - Animate the shuttlecock along a parabolic arc from `from` to `to`
 *  - Animate player movement arrows sliding toward a target position
 *  - Play a short feedback flash (correct = green, wrong = red) over the canvas
 *
 * Design principles:
 *  - All animations are time-based (requestAnimationFrame + elapsed ms),
 *    not frame-count-based, so they run at the same speed on any device.
 *  - Each animation returns a Promise that resolves when it completes,
 *    so callers can await or chain them easily.
 *  - Animations are purely visual — they never mutate game state.
 *  - The Animator class manages a queue so only one flight/feedback
 *    animation runs at a time; movement arrows can overlap freely.
 *
 * Coordinate system: normalized (0–1), converted via court.toCanvas().
 */

import { snapToGrid } from './snap.js';

// ─── Timing constants ─────────────────────────────────────────────────────────

/** Default shuttlecock flight duration per speed tier (ms) */
const FLIGHT_DURATION = { slow: 900, medium: 600, fast: 380 };

/** Player movement arrow animation duration (ms) */
const MOVE_DURATION = 420;

/** Feedback flash total duration (ms) */
const FEEDBACK_DURATION = 600;

/** Feedback flash fade-out starts at this fraction of the total duration */
const FEEDBACK_FADE_START = 0.55;

// ─── Visual constants ─────────────────────────────────────────────────────────

/** Peak height of the shuttle arc, as a fraction of the normalized distance */
const ARC_HEIGHT_RATIO = 0.28;

/** Minimum arc peak in normalized units (so short shots still look arced) */
const ARC_MIN_HEIGHT = 0.06;

/** Shuttle radius during flight (fraction of court width) */
const SHUTTLE_RADIUS_RATIO = 0.022;

/** Trail dot count behind the shuttle during flight */
const TRAIL_DOTS = 6;
const TRAIL_DOT_SPACING = 0.06;  // fraction of total progress per dot

// Feedback overlay colors
const FEEDBACK_COLOURS = {
  correct:  'rgba(34, 197, 94, ',   // green-500
  wrong:    'rgba(239, 68, 68, ',   // red-500
  nearMiss: 'rgba(251, 146, 60, ',  // orange-400
};
/** Peak opacity of the feedback flash overlay */
const FEEDBACK_PEAK_ALPHA = 0.22;

// ─── Easing functions ─────────────────────────────────────────────────────────

/** Ease-out cubic — fast start, smooth stop */
const easeOut = t => 1 - Math.pow(1 - t, 3);

/** Ease-in-out sine — smooth start and stop */
const easeInOut = t => -(Math.cos(Math.PI * t) - 1) / 2;

// ─── Animator class ───────────────────────────────────────────────────────────

export class Animator {
  /**
   * @param {HTMLCanvasElement}           canvas
   * @param {import('./court.js').Court}  court
   */
  constructor(canvas, court) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.court  = court;

    /** Active flight animation state, or null */
    this._flight = null;

    /** Active feedback animation state, or null */
    this._feedback = null;

    /** Active movement animations — array of states (can overlap) */
    this._movements = [];

    /** rAF handle */
    this._rafId = null;
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  /**
   * Animate the shuttlecock flying from `from` to `to` in an arc.
   * Resolves when the flight is complete.
   *
   * @param {{ x: number, y: number }} from   normalized start position
   * @param {{ x: number, y: number }} to     normalized end position
   * @param {'slow'|'medium'|'fast'}   speed
   * @param {'low'|'normal'|'high'}    height — affects arc peak
   * @returns {Promise<void>}
   */
  flyShuttle(from, to, speed = 'medium', height = 'normal') {
    return new Promise(resolve => {
      this._flight = {
        from:     snapToGrid(from.x, from.y),
        to:       snapToGrid(to.x,   to.y),
        duration: FLIGHT_DURATION[speed] ?? FLIGHT_DURATION.medium,
        height,
        startMs:  null,
        resolve,
      };
      this._scheduleFrame();
    });
  }

  /**
   * Animate a player sliding from `from` to `to`.
   * Resolves when the movement is complete.
   *
   * @param {{ x: number, y: number }} from
   * @param {{ x: number, y: number }} to
   * @param {boolean} isAlly   — controls arrow color
   * @returns {Promise<void>}
   */
  movePlayer(from, to, isAlly = true) {
    return new Promise(resolve => {
      this._movements.push({
        from:     snapToGrid(from.x, from.y),
        to:       snapToGrid(to.x,   to.y),
        isAlly,
        duration: MOVE_DURATION,
        startMs:  null,
        resolve,
      });
      this._scheduleFrame();
    });
  }

  /**
   * Flash the canvas with a colored overlay to signal feedback.
   * Resolves when the flash fades out.
   *
   * @param {'correct'|'wrong'|'nearMiss'} type
   * @returns {Promise<void>}
   */
  flashFeedback(type = 'correct') {
    return new Promise(resolve => {
      this._feedback = {
        type,
        duration: FEEDBACK_DURATION,
        startMs:  null,
        resolve,
      };
      this._scheduleFrame();
    });
  }

  /**
   * Cancel all running animations immediately.
   * All pending Promises resolve without completing their visual.
   */
  cancelAll() {
    if (this._flight)   { this._flight.resolve();   this._flight   = null; }
    if (this._feedback) { this._feedback.resolve();  this._feedback = null; }
    this._movements.forEach(m => m.resolve());
    this._movements = [];

    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  /**
   * Returns true if any animation is currently running.
   */
  get isPlaying() {
    return this._flight !== null ||
           this._feedback !== null ||
           this._movements.length > 0;
  }

  // ─── Frame loop ──────────────────────────────────────────────────────────────

  _scheduleFrame() {
    if (this._rafId !== null) return;
    this._rafId = requestAnimationFrame(ts => this._tick(ts));
  }

  _tick(ts) {
    this._rafId = null;
    let stillActive = false;

    if (this._flight)   stillActive = this._tickFlight(ts)   || stillActive;
    if (this._feedback) stillActive = this._tickFeedback(ts) || stillActive;

    this._movements = this._movements.filter(m => this._tickMovement(m, ts));
    stillActive = stillActive || this._movements.length > 0;

    if (stillActive) {
      this._rafId = requestAnimationFrame(ts2 => this._tick(ts2));
    }
  }

  // ─── Flight animation ─────────────────────────────────────────────────────────

  _tickFlight(ts) {
    const f = this._flight;
    if (f.startMs === null) f.startMs = ts;

    const elapsed = ts - f.startMs;
    const t       = Math.min(1, elapsed / f.duration);
    const te      = easeInOut(t);

    this._drawFlightFrame(f, te);

    if (t >= 1) {
      f.resolve();
      this._flight = null;
      return false;
    }
    return true;
  }

  _drawFlightFrame(f, t) {
    const { ctx, court } = this;

    // Parabolic arc: lerp x linearly, lerp y with an added sine arc
    const nx = f.from.x + (f.to.x - f.from.x) * t;
    const ny = f.from.y + (f.to.y - f.from.y) * t;

    // Arc peak height based on distance and height parameter
    const dist = Math.hypot(f.to.x - f.from.x, f.to.y - f.from.y);
    const arcH = Math.max(ARC_MIN_HEIGHT, dist * ARC_HEIGHT_RATIO) *
                 (f.height === 'high' ? 1.5 : f.height === 'low' ? 0.5 : 1.0);
    const arcY = ny - arcH * Math.sin(Math.PI * t);  // bell curve over flight

    const pos    = court.toCanvas(nx, arcY);
    const r      = court.courtW * SHUTTLE_RADIUS_RATIO;

    // ── Trail dots ──────────────────────────────────────────────────────────
    for (let i = TRAIL_DOTS; i >= 1; i--) {
      const tTrail = Math.max(0, t - i * TRAIL_DOT_SPACING);
      const tnx    = f.from.x + (f.to.x - f.from.x) * tTrail;
      const tny    = f.from.y + (f.to.y - f.from.y) * tTrail;
      const tarc   = tny - arcH * Math.sin(Math.PI * tTrail);
      const tp     = court.toCanvas(tnx, tarc);
      const alpha  = (1 - i / (TRAIL_DOTS + 1)) * 0.4;
      const tr     = r * (1 - i / (TRAIL_DOTS + 1)) * 0.7;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(tp.x, tp.y, tr, 0, Math.PI * 2);
      ctx.fillStyle = '#fbbf24';
      ctx.fill();
      ctx.restore();
    }

    // ── Shuttle circle ──────────────────────────────────────────────────────
    ctx.save();

    // Feather skirt
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
    ctx.fillStyle   = 'rgba(251, 191, 36, 0.28)';
    ctx.fill();
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth   = 1.2;
    ctx.stroke();

    // Cork
    const corkR = court.courtW * 0.008;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, corkR, 0, Math.PI * 2);
    ctx.fillStyle   = '#fbbf24';
    ctx.fill();
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth   = 1;
    ctx.stroke();

    ctx.restore();
  }

  // ─── Movement animation ───────────────────────────────────────────────────────

  _tickMovement(m, ts) {
    if (m.startMs === null) m.startMs = ts;

    const elapsed = ts - m.startMs;
    const t       = Math.min(1, elapsed / m.duration);
    const te      = easeOut(t);

    this._drawMovementFrame(m, te);

    if (t >= 1) {
      m.resolve();
      return false;  // remove from array
    }
    return true;
  }

  _drawMovementFrame(m, t) {
    const { ctx, court } = this;

    // Interpolated player position
    const nx = m.from.x + (m.to.x - m.from.x) * t;
    const ny = m.from.y + (m.to.y - m.from.y) * t;
    const { x, y } = court.toCanvas(nx, ny);
    const r = court.courtW * 0.038;  // matches PLAYER_RADIUS_RATIO in renderer.js

    const fill   = m.isAlly ? '#2563eb' : '#dc2626';
    const stroke = m.isAlly ? '#1d4ed8' : '#b91c1c';

    // Fading ghost at origin
    const ghostAlpha = (1 - t) * 0.25;
    if (ghostAlpha > 0.01) {
      const origin = court.toCanvas(m.from.x, m.from.y);
      ctx.save();
      ctx.globalAlpha = ghostAlpha;
      ctx.beginPath();
      ctx.arc(origin.x, origin.y, r, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.restore();
    }

    // Player circle at interpolated position
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle   = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth   = 2;
    ctx.stroke();
    ctx.restore();
  }

  // ─── Feedback flash ───────────────────────────────────────────────────────────

  _tickFeedback(ts) {
    const f = this._feedback;
    if (f.startMs === null) f.startMs = ts;

    const elapsed  = ts - f.startMs;
    const t        = Math.min(1, elapsed / f.duration);

    // Alpha: ramp up then fade out
    let alpha;
    if (t < FEEDBACK_FADE_START) {
      alpha = easeOut(t / FEEDBACK_FADE_START) * FEEDBACK_PEAK_ALPHA;
    } else {
      alpha = (1 - easeOut((t - FEEDBACK_FADE_START) / (1 - FEEDBACK_FADE_START))) * FEEDBACK_PEAK_ALPHA;
    }

    this._drawFeedbackFrame(f.type, alpha);

    if (t >= 1) {
      f.resolve();
      this._feedback = null;
      return false;
    }
    return true;
  }

  _drawFeedbackFrame(type, alpha) {
    const { ctx } = this;
    const dpr     = window.devicePixelRatio || 1;
    const cssW    = this.canvas.width  / dpr;
    const cssH    = this.canvas.height / dpr;

    const colour = FEEDBACK_COLOURS[type] ?? FEEDBACK_COLOURS.correct;

    ctx.save();
    ctx.fillStyle = colour + alpha + ')';
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.restore();
  }
}
