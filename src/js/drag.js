/**
 * drag.js — Drag-to-shoot mechanic
 * Developer A · Rendering & UI
 *
 * Responsibilities:
 *  - Listen for mouse/touch events on the canvas
 *  - Activate when the player presses near a valid shuttle impact point
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

import { snapToGrid }        from './snap.js';
import { deriveShuttleType } from './payload-builder.js';
import { loftedCurveControl } from './trajectory.js';

// ─── Tuning constants ─────────────────────────────────────────────────────────

/** Maximum drag distance in CSS pixels — maps to power = 1.0 */
const MAX_DRAG_PX = 160;

/**
 * Drag length below this stays at power = 0. Avoids ghost shots on a stray
 * tap, and gives the slingshot a tactile "engage" point.
 */
const DEADZONE_PX = 14;

const DEFAULT_DRAG_PROFILE = Object.freeze({
  maxDragPx: MAX_DRAG_PX,
  deadzonePx: DEADZONE_PX,
  tensionExponent: 1,
  targetYMin: 0.08,
  targetYMax: 0.42,
  lineWidthBoost: 1,
  ringBoost: 1,
});

/**
 * Power threshold (post-easing) at which the max-tension cue appears.
 * Picked just below 1.0 so the player sees the cue before bottoming out.
 */
const MAX_TENSION_T = 0.96;

/** Radius of the activation zone around the shuttlecock (CSS px) */
const ACTIVATION_RADIUS_PX = 36;

/** Spin sensitivity: pixels of perpendicular deviation → ±1.0 */
const MAX_SPIN_DEVIATION_PX = 60;

// ─── Visual constants ─────────────────────────────────────────────────────────

/** Base thickness of the aim line (CSS px) — grows with power for the tension effect */
const LINE_W_MIN = 3;
const LINE_W_MAX = 8;

/** Radius of the drag start indicator ring (CSS px) — grows slightly with tension */
const START_RING_R = 10;
const START_RING_R_MAX = 16;

/** Radius of the aim endpoint dot (CSS px) */
const END_DOT_R = 5;

/** Rally palette */
const INK = '#0f1a14';

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
const TRAJ_COLOUR = 'rgba(15, 26, 20, 0.40)';
const SHOT_TRACE_TYPES = new Set(['SMASH', 'DROP', 'DRIVE', 'CLEAR', 'KILL', 'NET_DROP']);

// Trajectory preview
/** Number of points to sample along the preview arc */
const TRAJ_PREVIEW_STEPS = 28;
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
   * @typedef {{ aimPoint: {x:number,y:number}, power: number, spin: number, impactPoint?: {x:number,y:number,t?:number} }} ShotDescriptor
   */
  constructor(canvas, court, onShot, { profiles = null } = {}) {
    this.canvas  = canvas;
    this.ctx     = canvas.getContext('2d');
    this.court   = court;
    this.onShot  = onShot;
    this._profiles = profiles && typeof profiles === 'object' ? profiles : null;

    /** Normalized position of the shuttlecock — set via activate() */
    this._shuttleNorm = null;

    /** Valid normalized impact points for this turn, if provided */
    this._impactPoints = [];

    /** Impact point selected by the pointerdown that started the drag */
    this._selectedImpactPoint = null;

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

    /** Selected intended shot type, used for type-specific preview traces. */
    this._shotType = 'SMASH';

    // Bind listeners (kept so we can remove them in destroy())
    this._onPointerDown  = this._handlePointerDown.bind(this);
    this._onPointerMove  = this._handlePointerMove.bind(this);
    this._onPointerUp    = this._handlePointerUp.bind(this);
    this._onPointerLeave = this._handlePointerLeave.bind(this);
    this._onPointerCancel = this._handlePointerCancel.bind(this);
    this._onKeyDown      = this._handleKeyDown.bind(this);

    canvas.addEventListener('pointerdown',  this._onPointerDown);
    canvas.addEventListener('pointermove',  this._onPointerMove);
    canvas.addEventListener('pointerup',    this._onPointerUp);
    canvas.addEventListener('pointerleave', this._onPointerLeave);
    canvas.addEventListener('pointercancel', this._onPointerCancel);
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
    this.canvas.removeEventListener('pointercancel', this._onPointerCancel);
    window.removeEventListener('keydown',           this._onKeyDown);
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  /**
   * Arm the mechanic for a shot exercise turn.
   * Call this every time a new shot exercise is presented.
   *
   * @param {{ x: number, y: number }} shuttleNorm  fallback normalized shuttlecock position
   * @param {Array<{ x: number, y: number, t?: number }>} impactPoints valid impact points
   */
  activate(shuttleNorm, impactPoints = []) {
    this._shuttleNorm = snapToGrid(shuttleNorm.x, shuttleNorm.y);
    this._impactPoints = Array.isArray(impactPoints)
      ? impactPoints.filter(point => Number.isFinite(point?.x) && Number.isFinite(point?.y))
      : [];
    this._selectedImpactPoint = null;
    this._armed   = true;
    this._dragging = false;
    this._origin   = null;
    this._current  = null;
  }

  /**
   * Set the intended shot type so the live drag preview matches the selected
   * post-shot trace convention.
   * @param {string} type
   */
  setShotType(type) {
    if (SHOT_TRACE_TYPES.has(type)) this._shotType = type;
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
    this._impactPoints = [];
    this._selectedImpactPoint = null;
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
    const closest = this._findClosestActivationPoint(pos);
    if (!closest || closest.dist > ACTIVATION_RADIUS_PX) return;

    this._selectedImpactPoint = { ...closest.point };
    this._shuttleNorm = { x: closest.point.x, y: closest.point.y };

    this._dragging = true;
    this._origin   = closest.canvasPoint;
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
    // Pointer capture keeps delivering move/up events after the pointer exits
    // the canvas, which is required for bottom-court slingshot pulls.
  }

  _handlePointerCancel() {
    if (this._dragging) {
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
    const profile = this._activeProfile();
    const dx = this._current.x - this._origin.x;
    const dy = this._current.y - this._origin.y;
    const len = Math.hypot(dx, dy);

    // Power: deadzone clears any drag below DEADZONE_PX, then we re-normalize
    // the remaining range so the curve still spans 0..1, then we apply a
    // symmetric cosine ease-in-out so the engage and the ceiling both feel
    // soft while the mid-pull is the steepest — matches "rope tightening".
    let power;
    if (len <= profile.deadzonePx) {
      power = 0;
    } else {
      const dragRange = Math.max(1, profile.maxDragPx - profile.deadzonePx);
      const tRaw = Math.min(1, (len - profile.deadzonePx) / dragRange);
      // Ease-in-out (cosine): slow start, fast middle, slow finish.
      const eased = 0.5 - 0.5 * Math.cos(Math.PI * tRaw);
      power = Math.pow(eased, profile.tensionExponent);
    }

    // Spin: perpendicular deviation of the midpoint, normalized to [-1, 1]
    const spin = Math.max(-1, Math.min(1, this._spinDeviation / MAX_SPIN_DEVIATION_PX));

    // Slingshot: the player drags AWAY from the target (toward themselves).
    // Aim direction is therefore the OPPOSITE of the drag delta.
    let aimNorm;
    if (len < 1) {
      // No movement — default aim to the shuttlecock position.
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

    const landing = this._projectLanding(aimNorm, power);
    const shotAimPoint = landing ?? aimNorm;

    return {
      aimPoint: shotAimPoint,
      power,
      spin,
      shuttleType: deriveShuttleType({ power, aimPoint: shotAimPoint }),
      ...(this._selectedImpactPoint && { impactPoint: { ...this._selectedImpactPoint } }),
    };
  }

  /** Emit the shot to the consumer and reset state. */
  _fireShot() {
    const shot = this._computeShot();
    this._armed   = false;  // disarm until activate() is called again
    this._origin  = null;
    this._current = null;
    this._impactPoints = [];
    this.onShot(shot);
  }

  _findClosestActivationPoint(pos) {
    const candidates = this._impactPoints.length > 0 ? this._impactPoints : [this._shuttleNorm];
    let closest = null;

    candidates.forEach(point => {
      const canvasPoint = this.court.toCanvas(point.x, point.y);
      const dist = Math.hypot(pos.x - canvasPoint.x, pos.y - canvasPoint.y);
      if (!closest || dist < closest.dist) {
        closest = { point, canvasPoint, dist };
      }
    });

    return closest;
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
    const profile = this._activeProfile();
    // Slingshot: the player drags AWAY from the target (downward, toward
    // themselves), so a valid backward drag has current.y > origin.y.
    if (!this._current || !this._origin ||
        this._current.y <= this._origin.y) return null;

    // The aimPoint is already inverted in _computeShot. With the legacy profile,
    // keep the old direct-aim behavior. Lab profiles intentionally constrain
    // depth into type-specific bands so each shot keeps a strong identity.
    if (aimPoint.y < 0.5 && !this._hasActiveCustomProfile()) {
      return { x: aimPoint.x, y: aimPoint.y };
    }

    // Project using the INVERTED raw direction (slingshot).
    const raw = this.court.toNormalized(this._current.x, this._current.y);
    const sx  = this._shuttleNorm.x;
    const sy  = this._shuttleNorm.y;
    const rdx = sx - raw.x;
    const rdy = sy - raw.y;

    if (rdy >= 0) return null;  // guard: drag direction does not aim forward

    // power≈1 lands toward targetYMin (deep); power≈0 lands toward targetYMax (nearer).
    const targetY = profile.targetYMin + (1 - power) * (profile.targetYMax - profile.targetYMin);
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

    const colour = this._powerColour(power);
    const points = this._tracePoints(from, to, this._shotType, power);

    this._strokeShotTrace(points, this._shotType, TRAJ_COLOUR, 0.28);
    this._strokeShotTrace(points, this._shotType, colour, 0.78);

    // Landing indicator: pulsing circle + crosshair
    ctx.save();
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

  _tracePoints(from, to, type, power) {
    return [from, to];
  }

  _strokeShotTrace(points, type, colour, alpha) {
    if (!points || points.length < 2) return;

    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = colour;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (type) {
      case 'SMASH':
        this._strokeParallelTrace(points, 2, 3.5, 1.5);
        break;
      case 'KILL':
        this._strokeParallelTrace(points, 3, 2.5, 1.4);
        break;
      case 'CLEAR':
        this._strokeCurveTrace(points, [], 2);
        break;
      case 'DROP':
        this._strokeCurveTrace(points, [8, 6], 1.8);
        break;
      case 'NET_DROP':
        this._strokeCurveTrace(points, [3, 5], 1.5);
        break;
      case 'DRIVE':
      default:
        this._strokeTracePath(points, [], 1.8);
        break;
    }

    ctx.restore();
  }

  _strokeCurveTrace(points, dash, width) {
    const { ctx } = this;
    const start = points[0];
    const end = points[points.length - 1];
    const control = loftedCurveControl(this.court, start, end, this._shotType);

    ctx.setLineDash(dash);
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.quadraticCurveTo(control.x, control.y, end.x, end.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  _strokeTracePath(points, dash, width) {
    const { ctx } = this;
    ctx.setLineDash(dash);
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach(point => ctx.lineTo(point.x, point.y));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  _strokeParallelTrace(points, count, offsetPx, width) {
    const start = points[0];
    const end = points[points.length - 1];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const mid = (count - 1) / 2;

    for (let i = 0; i < count; i++) {
      const offset = (i - mid) * offsetPx;
      const shifted = points.map(point => ({
        x: point.x + nx * offset,
        y: point.y + ny * offset,
      }));
      this._strokeTracePath(shifted, [], width);
    }
  }

  _drawAimLine(power, spin) {
    const { ctx } = this;
    const o = this._origin;
    const c = this._current;
    const colour = this._powerColour(power);
    const profile = this._activeProfile();

    // Tension effect: line thickens and start ring grows as the slingshot is stretched.
    const lineW    = LINE_W_MIN + (LINE_W_MAX - LINE_W_MIN) * power * profile.lineWidthBoost;
    const ringR    = START_RING_R + (START_RING_R_MAX - START_RING_R) * power * profile.ringBoost;

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

    // ── Slingshot rope (ink outline + colored core, thickens with tension) ───
    const drawPath = () => {
      ctx.beginPath();
      if (Math.abs(spin) > 0.08) {
        const mx = (o.x + c.x) / 2;
        const my = (o.y + c.y) / 2;
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
    };

    // Ink outline for legibility against the green court
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth   = lineW + 3;
    drawPath();
    ctx.stroke();

    // Colored core
    ctx.strokeStyle = colour;
    ctx.lineWidth   = lineW;
    drawPath();
    ctx.stroke();

    // ── Spin indicator (separate arc near midpoint) ──────────────────────────
    if (Math.abs(spin) > 0.08) {
      this._drawSpinIndicator(o, c, spin);
    }

    // ── Endpoint pull-handle (ink ring + colored fill) ───────────────────────
    ctx.beginPath();
    ctx.arc(c.x, c.y, END_DOT_R + 1, 0, Math.PI * 2);
    ctx.fillStyle = INK;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(c.x, c.y, END_DOT_R, 0, Math.PI * 2);
    ctx.fillStyle = colour;
    ctx.fill();

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

  _activeProfile() {
    const profile = this._profiles?.[this._shotType] ?? null;
    if (!profile) return DEFAULT_DRAG_PROFILE;

    return {
      ...DEFAULT_DRAG_PROFILE,
      ...profile,
    };
  }

  _hasActiveCustomProfile() {
    return Boolean(this._profiles?.[this._shotType]);
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
