/**
 * snap.js — 50 cm grid snapping utility
 * Developer A · Rendering & UI
 *
 * The real court is 13.4 m × 6.1 m.
 * The virtual coordinate space is discretized into 50 × 50 cm cells,
 * giving ≈ 12 columns × 27 rows of grid nodes.
 *
 * All player positions and user click inputs MUST pass through snapToGrid()
 * before being rendered or processed.
 */

const CELL_M   = 0.5;    // cell size in meters
const COURT_W  = 6.1;    // court width  (m)
const COURT_H  = 13.4;   // court length (m)

/** Normalized step per grid column (≈ 0.0820) */
export const SNAP_X = CELL_M / COURT_W;

/** Normalized step per grid row (≈ 0.0373) */
export const SNAP_Y = CELL_M / COURT_H;

/** Number of grid columns (intersection count, includes both sidelines) */
export const GRID_COLS = Math.round(COURT_W / CELL_M) + 1;  // 13

/** Number of grid rows */
export const GRID_ROWS = Math.round(COURT_H / CELL_M) + 1;  // 28

/**
 * Snap a normalized position to the nearest 50 cm grid intersection.
 * The result is clamped to [0, 1] on both axes.
 *
 * @param {number} nx  normalized x ∈ [0, 1]
 * @param {number} ny  normalized y ∈ [0, 1]
 * @returns {{ x: number, y: number }}
 */
export function snapToGrid(nx, ny) {
  const sx = Math.round(nx / SNAP_X) * SNAP_X;
  const sy = Math.round(ny / SNAP_Y) * SNAP_Y;
  return {
    x: Math.min(1, Math.max(0, sx)),
    y: Math.min(1, Math.max(0, sy)),
  };
}
