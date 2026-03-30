/**
 * drag.js — Drag-to-shoot mechanic
 * Developer A · Rendering & UI
 *
 * Responsibilities:
 *  - Listen for mouse/touch events on the canvas
 *  - Activate when the player presses near the shuttlecock position
 *  - Track drag direction (aim), length (power), and curvature (spin)
 *  - Render a live aim line (color-coded by power) + spin arc indicator
 *  - Emit a shot descriptor on release: { aimPoint, power, spin }
 *  - Cancel cleanly on Escape or pointer-leave
 *
 * Power zones (mapped from drag length vs MAX_DRAG_PX):
 *   0.0 – 0.3  →  drop / net shot  (green)
 *   0.3 – 0.6  →  drive / push     (yellow)
 *   0.6 – 1.0  →  smash / clear    (red)
 *
 * Spin (derived from perpendicular deviation of midpoint):
 *   < 0  →  slice left
 *   > 0  →  slice right
 *   ≈ 0  →  flat
 *
 * All positions flowing into this module are normalized (0–1).
 * All canvas drawing is in CSS pixels via court.toCanvas().
 */

import { snapToGrid } from './snap.js';

// ─── Tuning constants ─────────────────────────────────────────────────────────

/** Maximum drag distance in CSS pixels — maps to power = 1.0 */
const MAX_DRAG_PX = 160;

/** Radius of the activation zone around the shuttlecock (CSS px) */
const ACTIVATION_RADIUS_PX = 36;

/** Spin sensitivity: pixels of perpendicular deviation → ±1.0 */
const MAX_SPIN_DEVIATION_PX = 60;

// ─── Visual constants ─────────────────────────────────────────────────────────

/** Thickness of the aim line (CSS px) */
const LINE_W = 3;

/** Radius of the drag start indicator ring (CSS px) */
const START_RING_R = 10;

/** Radius of the aim endpoint dot (CSS px) */
const END_DOT_R = 5;

/**
 * Color stops for the aim line, keyed by power threshold.
 * Interpolated linearly between stops.
 */
const POWER_COLOURS = [
  { t: 0.0,  r: 74,  g: 222, b: 128 },  // green-400  (soft)
  { t: 0.3,  r: 74,  g: 222, b: 128 },  // green-400
  { t: 0.6,  r: 250, g: 204, b: 21  },  // yellow-400
  { t: 0.8,  r: 249, g: 115, b: 22  },  // orange-400
  { t: 1.0,  r: 239, g: 68,  b: 68  },  // red-400    (full power)
];

/** Alpha of the aim line */
const LINE_ALPHA = 0.88;

/** Spin arc color */
const SPIN_COLOUR = 'rgba(196, 181, 253, 0.7)';  // violet-300

// Trajectory preview
/** Number of points to sample along the preview arc */
const TRAJ_PREVIEW_STEPS = 28;
/** Dash pattern for the preview arc */
const TRAJ_PREVIEW_DASH = [5, 5];
/** Landing indicator outer radius (CSS px) */
const LANDING_OUTER_R = 10;
/** Landing indicator crosshair arm length (CSS px) */
const LANDING_CROSS   = 7;

// ─── DragShooter class ────────────────────────────────────────────────────────

export class DragShooter {
  /**
   * @param {HTMLCanvasElement}            canvas
   * @param {import('./court.js').Court}   court
   * @param {function(ShotDescriptor): void} onShot  — called on release with shot data
   *
   * @typedef {{ aimPoint: {x:number,y:number}, power: number, spin: number }} ShotDescriptor
   */
  constructor(canvas, court, onShot) {
    this.canvas  = canvas;
    this.ctx     = canvas.getContext('2d');
    this.court   = court;
    this.onShot  = onShot;

    /** Normalized position of the shuttlecock — set via activate() */
    this._shuttleNorm = null;

    /** Canvas-pixel origin of the drag (at shuttlecock) */
    this._origin = null;

    /** Current pointer canvas-pixel position */
    this._current = null;

    /** Midpoint deviation used for spin (CSS px, signed) */
    this._spinDeviation = 0;

    /** Whether a drag is in progress */
    this._dragging = false;

    /** Whether the mechanic is armed for the current exercise turn */
    this._armed = false;

    // Bind listeners (kept so we can remove them in destroy())
    this._onPointerDown  = this._handlePointerDown.bind(this);
    this._onPointerMove  = this._handlePointerMove.bind(this);
    this._onPointerUp    = this._handlePointerUp.bind(this);
    this._onPointerLeave = this._handlePointerLeave.bind(this);
    this._onKeyDown      = this._handleKeyDown.bind(this);

    canvas.addEventListener('pointerdown',  this._onPointerDown);
    canvas.addEventListener('pointermove',  this._onPointerMove);
    canvas.addEventListener('pointerup',    this._onPointerUp);
    canvas.addEventListener('pointerleave', this._onPointerLeave);
    window.addEventListener('keydown',      this._onKeyDown);

    // Prevent default touch behavior (scroll, zoom) on the canvas
    canvas.style.touchAction = 'none';
  }

  /** Release all event listeners when the mechanic is no longer needed. */
  destroy() {
    this.canvas.removeEventListener('pointerdown',  this._onPointerDown);
    this.canvas.removeEventListener('pointermove',  this._onPointerMove);
    this.canvas.removeEventListener('pointerup',    this._onPointerUp);
    this.canvas.removeEventListener('pointerleave', this._onPointerLeave);
    window.removeEventListener('keydown',           this._onKeyDown);
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  /**
   * Arm the mechanic for a shot exercise turn.
   * Call this every time a new shot exercise is presented.
   *
   * @param {{ x: number, y: number }} shuttleNorm  normalized shuttlecock position
   */
  activate(shuttleNorm) {
    this._shuttleNorm = snapToGrid(shuttleNorm.x, shuttleNorm.y);
    this._armed   = true;
    this._dragging = false;
    this._origin   = null;
    this._current  = null;
  }

  /**
   * Disarm the mechanic (e.g. when switching to a positioning exercise).
   * Any active drag is cancelled silently.
   */
  deactivate() {
    this._armed    = false;
    this._dragging = false;
    this._origin   = null;
    this._current  = null;
  }

  /**
   * Draw the live aim line and spin indicator.
   * Must be called every render frame while dragging (after court and renderer draw).
   */
  draw() {
    if (!this._dragging || !this._origin || !this._current) return;

    const { aimPoint, power, spin } = this._computeShot();
    this._drawTrajectoryPreview(aimPoint, power);
    this._drawAimLine(power, spin);
  }

  // ─── Event handlers ──────────────────────────────────────────────────────────

  _handlePointerDown(e) {
    if (!this._armed || !this._shuttleNorm) return;

    const pos = this._getCanvasPos(e);
    const shuttle = this.court.toCanvas(this._shuttleNorm.x, this._shuttleNorm.y);
    const dist = Math.hypot(pos.x - shuttle.x, pos.y - shuttle.y);

    if (dist > ACTIVATION_RADIUS_PX) return;

    this._dragging = true;
    this._origin   = { x: shuttle.x, y: shuttle.y };
    this._current  = { ...pos };
    this._spinDeviation = 0;

    this.canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  _handlePointerMove(e) {
    if (!this._dragging) return;

    this._current = this._getCanvasPos(e);
    this._spinDeviation = this._computeSpinDeviation(e);
    e.preventDefault();
  }

  _handlePointerUp(e) {
    if (!this._dragging) return;

    this._current = this._getCanvasPos(e);
    this._fireShot();
    this._dragging = false;
  }

  _handlePointerLeave() {
    if (this._dragging) {
      // Cancel the drag if pointer leaves the canvas
      this._dragging = false;
      this._origin   = null;
      this._current  = null;
    }
  }

  _handleKeyDown(e) {
    if (e.key === 'Escape' && this._dragging) {
      this._dragging = false;
      this._origin   = null;
      this._current  = null;
    }
  }

  // ─── Shot computation ─────────────────────────────────────────────────────────

  /**
   * Compute { aimPoint, power, spin } from current drag state.
   * @returns {{ aimPoint: {x:number,y:number}, power: number, spin: number }}
   */
  _computeShot() {
    const dx = this._current.x - this._origin.x;
    const dy = this._current.y - this._origin.y;
    const len = Math.hypot(dx, dy);

    // Power: clamped drag length normalized to [0, 1]
    const power = Math.min(1, len / MAX_DRAG_PX);

    // Spin: perpendicular deviation of the midpoint, normalized to [-1, 1]
    const spin = Math.max(-1, Math.min(1, this._spinDeviation / MAX_SPIN_DEVIATION_PX));

    // Aim point: normalize the drag direction back into court coordinates.
    // The aim is in the direction of the drag FROM the shuttlecock.
    let aimNorm;
    if (len < 1) {
      // No movement — default to shuttlecock position
      aimNorm = { ...this._shuttleNorm };
    } else {
      const aimCanvasX = this._origin.x + dx;
      const aimCanvasY = this._origin.y + dy;
      const raw = this.court.toNormalized(aimCanvasX, aimCanvasY);
      aimNorm = snapToGrid(
        Math.max(0, Math.min(1, raw.x)),
        Math.max(0, Math.min(1, raw.y)),
      );
    }

    return { aimPoint: aimNorm, power, spin };
  }

  /** Emit the shot to the consumer and reset state. */
  _fireShot() {
    const shot = this._computeShot();
    this._armed   = false;  // disarm until activate() is called again
    this._origin  = null;
    this._current = null;
    this.onShot(shot);
  }

  // ─── Spin deviation tracking ──────────────────────────────────────────────────

  /**
   * Compute the perpendicular deviation of the current pointer from the
   * straight line between origin and current — used as spin input.
   *
   * Positive = deviation to the right of the drag direction (slice right).
   * Negative = deviation to the left (slice left).
   *
   * This uses a simplified approach: we accumulate lateral drift via the
   * cross-product of the drag direction and the pointer movement delta.
   *
   * @param {PointerEvent} e
   * @returns {number}  signed pixels of deviation
   */
  _computeSpinDeviation(e) {
    if (!this._origin || !this._current) return 0;

    const dx = this._current.x - this._origin.x;
    const dy = this._current.y - this._origin.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) return 0;

    // Perpendicular unit vector (rotated 90° clockwise)
    const px = dy / len;
    const py = -dx / len;

    // Project the movement delta onto the perpendicular axis
    const movX = e.movementX ?? 0;
    const movY = e.movementY ?? 0;

    return this._spinDeviation + (movX * px + movY * py);
  }

  // ─── Drawing ──────────────────────────────────────────────────────────────────

  /**
   * Draw a dashed parabolic arc from the shuttlecock to the predicted landing
   * point, plus a landing indicator circle+crosshair.
   * Only rendered when aim is directed toward the opponent's half (y < 0.5).
   *
   * Arc height adapts to power: tall arc for drop, flat arc for smash.
   */
  /**
   * Project the drag direction to a landing point in the opponent's half.
   * Returns null if the player is dragging away from the net.
   *
   * When the pointer is already in the opponent's half, we use it directly.
   * When the pointer is still in the ally half, we extend the direction vector
   * to a realistic target depth (deep for smash, near-net for drop).
   *
   * @param {{ x: number, y: number }} aimPoint  Normalized pointer position
   * @param {number} power
   * @returns {{ x: number, y: number }|null}
   */
  _projectLanding(aimPoint, power) {
    // Use raw canvas direction to avoid snap-grid dead zone:
    // when pointer and shuttle share the same snap row, snapped dy=0 would
    // wrongly suppress the preview even though the user is dragging upward.
    if (!this._current || !this._origin ||
        this._current.y >= this._origin.y) return null;

    // Pointer already in opponent's half — use snapped aim directly
    if (aimPoint.y < 0.5) return { x: aimPoint.x, y: aimPoint.y };

    // Project using raw (unsnapped) normalized direction for accuracy
    const raw = this.court.toNormalized(this._current.x, this._current.y);
    const sx  = this._shuttleNorm.x;
    const sy  = this._shuttleNorm.y;
    const rdx = raw.x - sx;
    const rdy = raw.y - sy;

    if (rdy >= 0) return null;  // guard: should not happen given canvas check

    // smash (power≈1): lands deep (y≈0.08) — drop (power≈0): lands close (y≈0.42)
    const targetY = 0.08 + (1 - power) * 0.34;
    const t       = (targetY - sy) / rdy;
    const landX   = Math.max(0.02, Math.min(0.98, sx + t * rdx));

    return snapToGrid(landX, targetY);
  }

  _drawTrajectoryPreview(aimPoint, power) {
    const landing = this._projectLanding(aimPoint, power);
    if (!landing) return;  // dragging away from net

    const { ctx, court } = this;
    const from = court.toCanvas(this._shuttleNorm.x, this._shuttleNorm.y);
    const to   = court.toCanvas(landing.x, landing.y);

    // Arc height: inversely proportional to power (drop = tall, smash = flat)
    const arcFraction = 0.35 - power * 0.28;  // 0.35 (drop) → 0.07 (smash)
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    const arcH = Math.max(18, dist * arcFraction);

    const colour = this._powerColour(power);

    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = colour;
    ctx.lineWidth   = 1.8;
    ctx.setLineDash(TRAJ_PREVIEW_DASH);
    ctx.lineCap     = 'round';

    // Sample the parabolic arc and draw as polyline
    ctx.beginPath();
    for (let i = 0; i <= TRAJ_PREVIEW_STEPS; i++) {
      const t  = i / TRAJ_PREVIEW_STEPS;
      const px = from.x + (to.x - from.x) * t;
      const py = from.y + (to.y - from.y) * t - arcH * Math.sin(Math.PI * t);
      if (i === 0) ctx.moveTo(px, py);
      else         ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Landing indicator: pulsing circle + crosshair
    ctx.globalAlpha = 0.75;
    ctx.strokeStyle = colour;
    ctx.lineWidth   = 1.5;

    // Outer ring
    ctx.beginPath();
    ctx.arc(to.x, to.y, LANDING_OUTER_R, 0, Math.PI * 2);
    ctx.stroke();

    // Crosshair
    const s = LANDING_CROSS;
    ctx.beginPath();
    ctx.moveTo(to.x - s, to.y); ctx.lineTo(to.x + s, to.y);
    ctx.moveTo(to.x, to.y - s); ctx.lineTo(to.x, to.y + s);
    ctx.stroke();

    ctx.restore();
  }

  _drawAimLine(power, spin) {
    const { ctx } = this;
    const o = this._origin;
    const c = this._current;
    const colour = this._powerColour(power);

    ctx.save();
    ctx.globalAlpha = LINE_ALPHA;

    // ── Start ring at shuttlecock ────────────────────────────────────────────
    ctx.beginPath();
    ctx.arc(o.x, o.y, START_RING_R, 0, Math.PI * 2);
    ctx.strokeStyle = colour;
    ctx.lineWidth   = 2;
    ctx.stroke();

    // ── Aim line (straight or curved for spin) ───────────────────────────────
    ctx.beginPath();
    ctx.strokeStyle = colour;
    ctx.lineWidth   = LINE_W;
    ctx.lineCap     = 'round';

    if (Math.abs(spin) > 0.08) {
      // Draw a quadratic curve to indicate spin direction
      const mx = (o.x + c.x) / 2;
      const my = (o.y + c.y) / 2;

      // Perpendicular offset for the control point
      const dx = c.x - o.x;
      const dy = c.y - o.y;
      const len = Math.hypot(dx, dy);
      const spinOffset = spin * MAX_SPIN_DEVIATION_PX * 0.5;
      const cpx = mx + (dy / len) * spinOffset;
      const cpy = my - (dx / len) * spinOffset;

      ctx.moveTo(o.x, o.y);
      ctx.quadraticCurveTo(cpx, cpy, c.x, c.y);
    } else {
      ctx.moveTo(o.x, o.y);
      ctx.lineTo(c.x, c.y);
    }
    ctx.stroke();

    // ── Spin indicator (separate arc near midpoint) ──────────────────────────
    if (Math.abs(spin) > 0.08) {
      this._drawSpinIndicator(o, c, spin);
    }

    // ── Endpoint dot ────────────────────────────────────────────────────────
    ctx.beginPath();
    ctx.arc(c.x, c.y, END_DOT_R, 0, Math.PI * 2);
    ctx.fillStyle = colour;
    ctx.fill();

    // ── Power label (shot type) ───────────────────────────────────────────────
    this._drawPowerLabel(o, c, power);

    ctx.restore();
  }

  /**
   * Draw a small curved arrow near the midpoint to indicate spin direction.
   */
  _drawSpinIndicator(o, c, spin) {
    const { ctx } = this;
    const mx  = (o.x + c.x) / 2;
    const my  = (o.y + c.y) / 2;
    const r   = 10;
    const dir = spin > 0 ? 1 : -1;

    ctx.save();
    ctx.strokeStyle = SPIN_COLOUR;
    ctx.lineWidth   = 2;
    ctx.globalAlpha = 0.85;

    // Small arc
    const startAngle = dir > 0 ? -Math.PI * 0.6 : -Math.PI * 0.4;
    const endAngle   = dir > 0 ?  Math.PI * 0.4 :  Math.PI * 0.6;
    ctx.beginPath();
    ctx.arc(mx, my, r, startAngle, endAngle, dir < 0);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Draw a small text label above the endpoint indicating shot type.
   */
  _drawPowerLabel(o, c, power) {
    const { ctx } = this;
    const label =
      power < 0.3 ? 'Drop' :
      power < 0.6 ? 'Drive' : 'Smash';

    const dx = c.x - o.x;
    const dy = c.y - o.y;
    const len = Math.hypot(dx, dy);
    if (len < 20) return;

    // Offset the label slightly perpendicular to the drag line
    const px = -dy / len;
    const py =  dx / len;
    const lx = c.x + px * 18;
    const ly = c.y + py * 18;

    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.font        = 'bold 11px system-ui, sans-serif';
    ctx.fillStyle   = this._powerColour(power);
    ctx.textAlign   = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, lx, ly);
    ctx.restore();
  }

  // ─── Color interpolation ──────────────────────────────────────────────────────

  /**
   * Interpolate a CSS rgba color string from the POWER_COLOURS stops.
   * @param {number} t  power value 0–1
   * @returns {string}
   */
  _powerColour(t) {
    // Find surrounding stops
    let lo = POWER_COLOURS[0];
    let hi = POWER_COLOURS[POWER_COLOURS.length - 1];

    for (let i = 0; i < POWER_COLOURS.length - 1; i++) {
      if (t >= POWER_COLOURS[i].t && t <= POWER_COLOURS[i + 1].t) {
        lo = POWER_COLOURS[i];
        hi = POWER_COLOURS[i + 1];
        break;
      }
    }

    const range = hi.t - lo.t;
    const f     = range === 0 ? 0 : (t - lo.t) / range;
    const r     = Math.round(lo.r + (hi.r - lo.r) * f);
    const g     = Math.round(lo.g + (hi.g - lo.g) * f);
    const b     = Math.round(lo.b + (hi.b - lo.b) * f);

    return `rgb(${r}, ${g}, ${b})`;
  }

  // ─── Utilities ────────────────────────────────────────────────────────────────

  /**
   * Get pointer position relative to the canvas in CSS pixels,
   * accounting for canvas bounding rect offset.
   *
   * @param {PointerEvent} e
   * @returns {{ x: number, y: number }}
   */
  _getCanvasPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }
}
