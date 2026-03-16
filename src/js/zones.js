/**
 * zones.js — Zone definitions, lookup, and highlighting
 * Developer A · Rendering & UI
 *
 * Responsibilities:
 *  - Define the 18-zone grid (9 per half) with normalized bounds
 *  - Look up which zone a normalized point belongs to
 *  - Draw zone highlights on canvas (correct, near-miss, wrong)
 *  - Draw a click/tap marker at the player's chosen position
 *
 * Zone ID format:  {side}-{depth}-{lateral}
 *   side    : "opponent" | "ally"
 *   depth   : "front" | "mid" | "back"
 *   lateral : "left"  | "center" | "right"
 *
 * Grid layout (viewed on screen, top = opponent's back):
 *
 *        LEFT       CENTER      RIGHT
 *       (0–0.33)  (0.33–0.67) (0.67–1.0)
 *  BACK  opp-bk-l  opp-bk-c   opp-bk-r    y ∈ [0.000, 0.167)
 *  MID   opp-md-l  opp-md-c   opp-md-r    y ∈ [0.167, 0.333)
 *  FRONT opp-ft-l  opp-ft-c   opp-ft-r    y ∈ [0.333, 0.500)
 *       ─────────────── NET ─────────────── y = 0.5
 *  FRONT aly-ft-l  aly-ft-c   aly-ft-r    y ∈ [0.500, 0.667)
 *  MID   aly-md-l  aly-md-c   aly-md-r    y ∈ [0.667, 0.833)
 *  BACK  aly-bk-l  aly-bk-c   aly-bk-r    y ∈ [0.833, 1.000]
 *
 * (IDs use full words: opponent-front-left, ally-back-center, etc.)
 */

// ─── Zone boundary constants ───────────────────────────────────────────────────

const X_BOUNDARIES = [0, 1 / 3, 2 / 3, 1];   // left · center · right split
const LATERALS     = ['left', 'center', 'right'];

// Opponent half: y 0 → 0.5  (back is top, front is near net)
const OPP_Y = [
  { depth: 'back',  y0: 0,        y1: 1 / 6  },
  { depth: 'mid',   y0: 1 / 6,    y1: 2 / 6  },
  { depth: 'front', y0: 2 / 6,    y1: 0.5    },
];

// Ally half: y 0.5 → 1.0  (front is near net, back is bottom)
const ALY_Y = [
  { depth: 'front', y0: 0.5,      y1: 4 / 6  },
  { depth: 'mid',   y0: 4 / 6,    y1: 5 / 6  },
  { depth: 'back',  y0: 5 / 6,    y1: 1      },
];

// ─── Zone map ─────────────────────────────────────────────────────────────────

/**
 * All 18 zones keyed by their ID string.
 * Each entry: { x0, y0, x1, y1 } — normalized bounds, inclusive on min, exclusive on max
 * (except y1 = 1 on the bottom edge which is inclusive).
 *
 * @type {Record<string, { x0: number, y0: number, x1: number, y1: number }>}
 */
export const ZONES = (() => {
  const map = {};

  const addRows = (side, rows) => {
    rows.forEach(({ depth, y0, y1 }) => {
      LATERALS.forEach((lateral, i) => {
        const id = `${side}-${depth}-${lateral}`;
        map[id] = { x0: X_BOUNDARIES[i], y0, x1: X_BOUNDARIES[i + 1], y1 };
      });
    });
  };

  addRows('opponent', OPP_Y);
  addRows('ally',     ALY_Y);

  return map;
})();

// ─── Lookup helpers ───────────────────────────────────────────────────────────

/**
 * Return the zone ID that contains the given normalized point.
 * Returns null if the point is outside the court [0,1]×[0,1].
 *
 * @param {number} nx  normalized x ∈ [0, 1]
 * @param {number} ny  normalized y ∈ [0, 1]
 * @returns {string|null}
 */
export function getZoneAt(nx, ny) {
  if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return null;

  for (const [id, { x0, y0, x1, y1 }] of Object.entries(ZONES)) {
    // Upper bound is exclusive except at the very edges (x1 = 1, y1 = 1)
    const inX = nx >= x0 && (nx < x1 || x1 === 1);
    const inY = ny >= y0 && (ny < y1 || y1 === 1);
    if (inX && inY) return id;
  }

  return null;
}

/**
 * Return the bounds object for a zone ID, or null if the ID is unknown.
 *
 * @param {string} id
 * @returns {{ x0: number, y0: number, x1: number, y1: number }|null}
 */
export function getZone(id) {
  return ZONES[id] ?? null;
}

/**
 * Return the center point of a zone as a normalized position.
 *
 * @param {string} id
 * @returns {{ x: number, y: number }|null}
 */
export function getZoneCenter(id) {
  const z = ZONES[id];
  if (!z) return null;
  return { x: (z.x0 + z.x1) / 2, y: (z.y0 + z.y1) / 2 };
}

// ─── Visual constants ─────────────────────────────────────────────────────────

const ZONE_ALPHA     = 0.28;   // zone fill opacity
const ZONE_STROKE_W  = 2;      // zone outline thickness (CSS px)

const COLOUR = {
  correct:   { fill: 'rgba(34, 197, 94, ',  stroke: '#16a34a' },   // green-500
  nearMiss:  { fill: 'rgba(251, 146, 60, ', stroke: '#ea580c' },   // orange-400
  wrong:     { fill: 'rgba(239, 68, 68, ',  stroke: '#dc2626' },   // red-500
};

const CLICK_CROSS_SIZE  = 12;   // half-length of the crosshair arms (CSS px)
const CLICK_CROSS_W     = 2.5;  // crosshair line width (CSS px)
const CHECK_RADIUS_RATIO = 0.03; // checkmark circle, fraction of court width

// ─── ZoneOverlay class ────────────────────────────────────────────────────────

export class ZoneOverlay {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {import('./court.js').Court} court
   */
  constructor(canvas, court) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.court  = court;
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Highlight one or more correct zones in green.
   * Typically called after the player answers correctly, or to show correct
   * zones after a wrong answer.
   *
   * @param {string[]} zoneIds
   */
  drawCorrectZones(zoneIds) {
    zoneIds.forEach(id => this._fillZone(id, 'correct'));
  }

  /**
   * Highlight one or more near-miss zones in orange.
   *
   * @param {string[]} zoneIds
   */
  drawNearMissZones(zoneIds) {
    zoneIds.forEach(id => this._fillZone(id, 'nearMiss'));
  }

  /**
   * Highlight one or more wrong zones in red.
   *
   * @param {string[]} zoneIds
   */
  drawWrongZones(zoneIds) {
    zoneIds.forEach(id => this._fillZone(id, 'wrong'));
  }

  /**
   * Draw a red crosshair at the player's (incorrect) click position.
   *
   * @param {number} nx  normalized x
   * @param {number} ny  normalized y
   */
  drawClickMarker(nx, ny) {
    const { ctx, court } = this;
    const { x, y } = court.toCanvas(nx, ny);
    const s = CLICK_CROSS_SIZE;

    ctx.save();
    ctx.strokeStyle = COLOUR.wrong.stroke;
    ctx.lineWidth   = CLICK_CROSS_W;
    ctx.lineCap     = 'round';

    ctx.beginPath();
    ctx.moveTo(x - s, y - s);
    ctx.lineTo(x + s, y + s);
    ctx.moveTo(x + s, y - s);
    ctx.lineTo(x - s, y + s);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Draw a green checkmark circle at the given position.
   * Used to confirm a correct click.
   *
   * @param {number} nx  normalized x
   * @param {number} ny  normalized y
   */
  drawCheckmark(nx, ny) {
    const { ctx, court } = this;
    const { x, y } = court.toCanvas(nx, ny);
    const r = court.courtW * CHECK_RADIUS_RATIO;

    ctx.save();

    // Circle background
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle   = COLOUR.correct.stroke;
    ctx.fill();

    // Tick mark
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth   = r * 0.45;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';

    ctx.beginPath();
    ctx.moveTo(x - r * 0.45, y);
    ctx.lineTo(x - r * 0.1,  y + r * 0.4);
    ctx.lineTo(x + r * 0.5,  y - r * 0.35);
    ctx.stroke();

    ctx.restore();
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /**
   * Fill and outline a single zone rectangle.
   *
   * @param {string} id         zone ID
   * @param {'correct'|'nearMiss'|'wrong'} style
   */
  _fillZone(id, style) {
    const zone = ZONES[id];
    if (!zone) return;

    const { ctx, court } = this;
    const topLeft     = court.toCanvas(zone.x0, zone.y0);
    const bottomRight = court.toCanvas(zone.x1, zone.y1);
    const w = bottomRight.x - topLeft.x;
    const h = bottomRight.y - topLeft.y;
    const { fill, stroke } = COLOUR[style];

    ctx.save();

    // Filled rectangle with transparency
    ctx.fillStyle = fill + ZONE_ALPHA + ')';
    ctx.fillRect(topLeft.x, topLeft.y, w, h);

    // Outline
    ctx.strokeStyle = stroke;
    ctx.lineWidth   = ZONE_STROKE_W;
    ctx.strokeRect(topLeft.x, topLeft.y, w, h);

    ctx.restore();
  }
}
