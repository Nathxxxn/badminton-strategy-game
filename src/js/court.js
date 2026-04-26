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
  pageBg:   '#f4ecd8',              // cream page background
  surfaceA: '#156b3a',              // opponent's half (darker green)
  surfaceB: '#1f8a4c',              // ally's half (green)
  lines:    '#f4ecd8',              // cream court lines
  net:      '#0f1a14',              // ink net post
  border:   '#0f1a14',              // court frame border / shadow
  netBand:  'rgba(15,26,20,0.22)', // subtle net band overlay
};

const LINE_W = 1.5;   // court line thickness (CSS px)
const NET_W  = 2;     // net line thickness (CSS px)

// Inner padding around the court inside the canvas (CSS px)
const PAD = { top: 72, right: 32, bottom: 48, left: 32 };

const COURT_RADIUS  = 12;   // rounded corner radius (CSS px)
const SHADOW_OFFSET = 6;    // ink shadow offset (CSS px)

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

    // Geometry-change subscribers. Use onGeometryChange() to register a
    // callback that redraws the full scene (court + players + shuttle) when
    // the canvas is resized.
    this._geometryListeners = new Set();

    this._onResize = () => {
      this._resize();
      this._geometryListeners.forEach(cb => cb());
    };
    window.addEventListener('resize', this._onResize);

    // Also react to layout changes that don't fire window.resize — e.g. the
    // instruction banner expanding/collapsing, the workshop screen becoming
    // active, side rails appearing. Without this, courtY/courtH go stale and
    // clicks register at the wrong point on the court.
    if (typeof ResizeObserver !== 'undefined') {
      // Skip the first synchronous callback (initial observe) since the
      // constructor already called _resize() above.
      let initial = true;
      this._resizeObserver = new ResizeObserver(() => {
        if (initial) { initial = false; return; }
        this._onResize();
      });
      this._resizeObserver.observe(canvas);
    }
  }

  /**
   * Register a callback fired after the canvas is resized and the court
   * geometry has been recomputed. Use this to redraw the full scene.
   * @param {() => void} cb
   * @returns {() => void} unsubscribe function
   */
  onGeometryChange(cb) {
    this._geometryListeners.add(cb);
    return () => this._geometryListeners.delete(cb);
  }

  /** Call when the court is no longer needed to release the resize listener. */
  destroy() {
    window.removeEventListener('resize', this._onResize);
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
    this._geometryListeners?.clear();
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

    // The stage container (CSS) now provides the green/cream background
    // around the court — the canvas itself stays transparent.
    this._drawCourtShadow();               // ink offset shadow
    this._drawSurface();                   // green halves (clipped)
    this._drawCourtLines();                // cream lines
    this._drawNet();                       // ink net
    this._drawCourtFrameStroke();          // ink border on top
  }

  // ─── Private drawing helpers ────────────────────────────────────────────────

  _drawCourtShadow() {
    const { ctx, courtX, courtY, courtW, courtH } = this;
    ctx.save();
    ctx.fillStyle = COLOUR.border;
    ctx.beginPath();
    ctx.roundRect(courtX + SHADOW_OFFSET, courtY + SHADOW_OFFSET, courtW, courtH, COURT_RADIUS);
    ctx.fill();
    ctx.restore();
  }

  /** Court surface — two halves with rounded corners clip. */
  _drawSurface() {
    const { ctx, courtX, courtY, courtW, courtH } = this;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(courtX, courtY, courtW, courtH, COURT_RADIUS);
    ctx.clip();

    ctx.fillStyle = COLOUR.surfaceA;
    ctx.fillRect(courtX, courtY, courtW, courtH * 0.5);

    ctx.fillStyle = COLOUR.surfaceB;
    ctx.fillRect(courtX, courtY + courtH * 0.5, courtW, courtH * 0.5);

    ctx.restore();
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

  /** Net — ink style, no glow. */
  _drawNet() {
    const { ctx } = this;
    const left  = this.toCanvas(0, NET_Y);
    const right = this.toCanvas(1, NET_Y);
    const bandH = Math.round(this.courtH * 0.022);

    ctx.save();

    // Subtle net band
    ctx.fillStyle = COLOUR.netBand;
    ctx.fillRect(left.x, left.y - Math.round(bandH * 0.5), this.courtW, bandH);

    // Net post line
    ctx.strokeStyle = COLOUR.net;
    ctx.lineWidth   = NET_W;
    ctx.lineCap     = 'square';
    ctx.beginPath();
    ctx.moveTo(left.x, left.y);
    ctx.lineTo(right.x, right.y);
    ctx.stroke();

    ctx.restore();
  }

  _drawCourtFrameStroke() {
    const { ctx, courtX, courtY, courtW, courtH } = this;
    ctx.save();
    ctx.strokeStyle = COLOUR.border;
    ctx.lineWidth   = 4;
    ctx.beginPath();
    ctx.roundRect(courtX, courtY, courtW, courtH, COURT_RADIUS);
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
