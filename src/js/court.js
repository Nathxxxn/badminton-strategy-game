/**
 * court.js — Badminton court rendering
 * Developer A · Rendering & UI
 *
 * Responsibilities:
 *  - Draw a proportional doubles court with all BWF regulation lines
 *  - Handle responsive canvas scaling and device pixel ratio (DPR)
 *  - Expose coordinate conversion between normalized (0–1) and canvas pixels
 *
 * Coordinate system (normalized):
 *  x: 0.0 = left sideline  →  1.0 = right sideline
 *  y: 0.0 = opponent's back →  1.0 = ally's back (net at y = 0.5)
 */

// ─── BWF court dimensions (meters) ────────────────────────────────────────────

const COURT_LENGTH = 13.4;   // full court length (both halves)
const COURT_WIDTH  = 6.1;    // doubles width

// ─── Normalized measurements ───────────────────────────────────────────────────
//   All values are fractions of COURT_LENGTH or COURT_WIDTH so they map
//   directly to the [0, 1] coordinate system.

const NET_Y = 0.5;

// Distance from net → short service line  (1.98 m)
const SHORT_SVC_DIST = 1.98 / COURT_LENGTH;       // ≈ 0.1478

// Distance from back boundary → long service line for doubles  (0.76 m)
const LONG_SVC_DBL_DIST = 0.76 / COURT_LENGTH;    // ≈ 0.0567

// Distance from outer side line → singles side line  (0.46 m)
const SINGLES_SIDE_DIST = 0.46 / COURT_WIDTH;     // ≈ 0.0754

// Absolute normalized positions
const SHORT_SVC_TOP  = NET_Y - SHORT_SVC_DIST;    // ≈ 0.3522  (top half)
const SHORT_SVC_BOT  = NET_Y + SHORT_SVC_DIST;    // ≈ 0.6478  (bottom half)
const LONG_SVC_TOP   = LONG_SVC_DBL_DIST;         // ≈ 0.0567  (top half, near back)
const LONG_SVC_BOT   = 1 - LONG_SVC_DBL_DIST;    // ≈ 0.9433  (bottom half, near back)
const SINGLES_LEFT   = SINGLES_SIDE_DIST;         // ≈ 0.0754
const SINGLES_RIGHT  = 1 - SINGLES_SIDE_DIST;     // ≈ 0.9246

// ─── Visual constants ──────────────────────────────────────────────────────────

const COLOUR = {
  pageBg:     '#1a1a2e',              // matches body background in style.css
  surfaceA:   '#0d2b0d',              // opponent's half (slightly darker)
  surfaceB:   '#0f3d0f',              // ally's half
  lines:      '#dde8dd',              // court lines (slightly warm white)
  net:        '#ffffff',
  netGlow:    'rgba(255,255,255,0.18)',
};

const LINE_W = 1.5;   // court line thickness (CSS px)
const NET_W  = 3;     // net line thickness (CSS px)

// Inner padding around the court inside the canvas (CSS px)
const PAD = { top: 48, right: 32, bottom: 48, left: 32 };

// ─── Court class ──────────────────────────────────────────────────────────────

export class Court {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');

    // Court rect in CSS pixels — computed by _updateLayout()
    this.courtX = 0;
    this.courtY = 0;
    this.courtW = 0;
    this.courtH = 0;

    this._resize();

    // Keep a reference so we can remove the listener in destroy()
    this._onResize = () => {
      this._resize();
      this.draw();
    };
    window.addEventListener('resize', this._onResize);
  }

  /** Call when the court is no longer needed to release the resize listener. */
  destroy() {
    window.removeEventListener('resize', this._onResize);
  }

  // ─── Coordinate conversion ──────────────────────────────────────────────────

  /**
   * Convert a normalized court position to canvas CSS-pixel coordinates.
   * @param {number} nx  0 = left sideline, 1 = right sideline
   * @param {number} ny  0 = opponent's back, 1 = ally's back
   * @returns {{ x: number, y: number }}
   */
  toCanvas(nx, ny) {
    return {
      x: this.courtX + nx * this.courtW,
      y: this.courtY + ny * this.courtH,
    };
  }

  /**
   * Convert canvas CSS-pixel coordinates to a normalized court position.
   * @param {number} px
   * @param {number} py
   * @returns {{ x: number, y: number }}
   */
  toNormalized(px, py) {
    return {
      x: (px - this.courtX) / this.courtW,
      y: (py - this.courtY) / this.courtH,
    };
  }

  /**
   * Returns true if a normalized point lies within the doubles court boundary.
   * @param {number} nx
   * @param {number} ny
   */
  isInBounds(nx, ny) {
    return nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1;
  }

  // ─── Public draw entry point ────────────────────────────────────────────────

  draw() {
    const { ctx, canvas } = this;
    const dpr  = window.devicePixelRatio || 1;
    const cssW = canvas.width  / dpr;
    const cssH = canvas.height / dpr;

    ctx.clearRect(0, 0, cssW, cssH);

    this._drawPageBackground(cssW, cssH);
    this._drawSurface();
    this._drawCourtLines();
    this._drawNet();
  }

  // ─── Private drawing helpers ────────────────────────────────────────────────

  _drawPageBackground(w, h) {
    this.ctx.fillStyle = COLOUR.pageBg;
    this.ctx.fillRect(0, 0, w, h);
  }

  /** Court surface — two halves with a subtle tonal difference. */
  _drawSurface() {
    const { ctx, courtX, courtY, courtW, courtH } = this;

    // Opponent's half (top)
    ctx.fillStyle = COLOUR.surfaceA;
    ctx.fillRect(courtX, courtY, courtW, courtH * 0.5);

    // Ally's half (bottom)
    ctx.fillStyle = COLOUR.surfaceB;
    ctx.fillRect(courtX, courtY + courtH * 0.5, courtW, courtH * 0.5);
  }

  /** All BWF regulation lines for a doubles court. */
  _drawCourtLines() {
    const ctx = this.ctx;
    ctx.strokeStyle = COLOUR.lines;
    ctx.lineWidth   = LINE_W;
    ctx.lineCap     = 'square';

    // ── Outer boundary ────────────────────────────────────────────────────
    this._hLine(0, 1, 0);   // top back line
    this._hLine(0, 1, 1);   // bottom back line
    this._vLine(0, 0, 1);   // left side line
    this._vLine(1, 0, 1);   // right side line

    // ── Singles side lines ────────────────────────────────────────────────
    this._vLine(SINGLES_LEFT,  0, 1);
    this._vLine(SINGLES_RIGHT, 0, 1);

    // ── Short service lines ───────────────────────────────────────────────
    this._hLine(0, 1, SHORT_SVC_TOP);
    this._hLine(0, 1, SHORT_SVC_BOT);

    // ── Long service lines (doubles only) ─────────────────────────────────
    this._hLine(0, 1, LONG_SVC_TOP);
    this._hLine(0, 1, LONG_SVC_BOT);

    // ── Center service lines ──────────────────────────────────────────────
    // Run from the short service line to the back boundary on each half.
    // (They do NOT extend between the net and the short service line.)
    this._vLine(0.5, 0,            SHORT_SVC_TOP);   // top half
    this._vLine(0.5, SHORT_SVC_BOT, 1);              // bottom half
  }

  /** Net — rendered as a glowing white line across the center. */
  _drawNet() {
    const { ctx } = this;
    const left  = this.toCanvas(0, NET_Y);
    const right = this.toCanvas(1, NET_Y);

    ctx.save();

    // Soft glow behind the net
    ctx.strokeStyle = COLOUR.netGlow;
    ctx.lineWidth   = NET_W + 6;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(left.x, left.y);
    ctx.lineTo(right.x, right.y);
    ctx.stroke();

    // Net line itself
    ctx.strokeStyle = COLOUR.net;
    ctx.lineWidth   = NET_W;
    ctx.lineCap     = 'square';
    ctx.beginPath();
    ctx.moveTo(left.x, left.y);
    ctx.lineTo(right.x, right.y);
    ctx.stroke();

    ctx.restore();
  }

  // ─── Line drawing utilities ─────────────────────────────────────────────────

  /**
   * Stroke a horizontal line at normalized y, from normalized x0 to x1.
   * @param {number} x0
   * @param {number} x1
   * @param {number} ny
   */
  _hLine(x0, x1, ny) {
    const a = this.toCanvas(x0, ny);
    const b = this.toCanvas(x1, ny);
    this.ctx.beginPath();
    this.ctx.moveTo(a.x, a.y);
    this.ctx.lineTo(b.x, b.y);
    this.ctx.stroke();
  }

  /**
   * Stroke a vertical line at normalized x, from normalized y0 to y1.
   * @param {number} nx
   * @param {number} y0
   * @param {number} y1
   */
  _vLine(nx, y0, y1) {
    const a = this.toCanvas(nx, y0);
    const b = this.toCanvas(nx, y1);
    this.ctx.beginPath();
    this.ctx.moveTo(a.x, a.y);
    this.ctx.lineTo(b.x, b.y);
    this.ctx.stroke();
  }

  // ─── Layout ─────────────────────────────────────────────────────────────────

  _resize() {
    const dpr  = window.devicePixelRatio || 1;
    const cssW = this.canvas.clientWidth;
    const cssH = this.canvas.clientHeight;

    if (cssW === 0 || cssH === 0) return;

    // Physical pixel dimensions for crisp rendering on HiDPI screens
    this.canvas.width  = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);

    // Reset transform and apply DPR scale so we can draw in CSS pixels
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this._updateLayout(cssW, cssH);
  }

  /**
   * Compute the court rect (CSS pixels) centred in the canvas,
   * maintaining the official BWF aspect ratio (width / length ≈ 0.4552).
   */
  _updateLayout(cssW, cssH) {
    const availW = cssW - PAD.left - PAD.right;
    const availH = cssH - PAD.top  - PAD.bottom;

    const courtAspect = COURT_WIDTH / COURT_LENGTH;  // ≈ 0.4552
    const availAspect = availW / availH;

    let courtW, courtH;
    if (availAspect > courtAspect) {
      // Canvas is wider than the court aspect — height is the constraint
      courtH = availH;
      courtW = courtH * courtAspect;
    } else {
      // Canvas is taller — width is the constraint
      courtW = availW;
      courtH = courtW / courtAspect;
    }

    // Centre in available area
    this.courtX = PAD.left + (availW - courtW) / 2;
    this.courtY = PAD.top  + (availH - courtH) / 2;
    this.courtW = courtW;
    this.courtH = courtH;
  }
}
