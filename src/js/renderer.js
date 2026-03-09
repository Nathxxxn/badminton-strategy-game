/**
 * renderer.js — Player and shuttlecock rendering
 * Developer A · Rendering & UI
 *
 * Responsibilities:
 *  - Draw ally/opponent player circles with labels
 *  - Draw "movingTo" ghost circle + dashed arrow for players in transition
 *  - Highlight the active player with a glow ring
 *  - Draw the shuttlecock (yellow circle + feather cork)
 *  - Draw the trajectory arc as a dotted path
 *
 * All positions are normalized (0–1) and converted via court.toCanvas().
 * This module is purely visual — it does not own game state.
 */

// ─── Visual constants ──────────────────────────────────────────────────────────

// Player radius as a fraction of the court width
const PLAYER_RADIUS_RATIO = 0.038;   // ~3.8 % of court width

// Player colours
const ALLY_FILL     = '#2563eb';    // blue-600
const ALLY_STROKE   = '#1d4ed8';    // blue-700
const OPP_FILL      = '#dc2626';    // red-600
const OPP_STROKE    = '#b91c1c';    // red-700
const GHOST_ALPHA   = 0.25;

// Glow (active player)
const GLOW_COLOUR   = 'rgba(255, 255, 255, 0.55)';
const GLOW_BLUR     = 14;           // shadow blur in CSS px

// Label
const LABEL_FONT_RATIO = 0.45;      // font-size relative to player radius
const LABEL_COLOUR  = '#ffffff';

// Shuttlecock
const SHUTTLE_RADIUS_RATIO = 0.022; // fraction of court width
const SHUTTLE_FILL   = '#fbbf24';   // amber-400
const SHUTTLE_STROKE = '#b45309';   // amber-700
const CORK_RADIUS_RATIO = 0.008;

// Trajectory
const TRAJ_COLOUR   = 'rgba(251, 191, 36, 0.45)';
const TRAJ_DASH     = [4, 6];       // [dash, gap] in CSS px
const TRAJ_WIDTH    = 1.5;

// Speed → trail segment count mapping
const TRAIL_SEGMENTS = { slow: 3, medium: 6, fast: 10 };

// ─── Renderer class ───────────────────────────────────────────────────────────

export class Renderer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {import('./court.js').Court} court  — used for coordinate conversion
   */
  constructor(canvas, court) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.court  = court;
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Draw all players and the shuttlecock for a given exercise state.
   *
   * @param {Object} players       — keyed by role id (ally1, ally2, opponent1, opponent2)
   *                                 Each entry: { x, y, label?, movingTo? }
   * @param {Object|null} shuttlecock — { position, trajectory, speed?, height? }
   * @param {string|null} activePlayerId — role id of the player whose turn it is
   */
  drawScene(players, shuttlecock, activePlayerId = null) {
    if (shuttlecock) this._drawTrajectory(shuttlecock);
    this._drawPlayers(players, activePlayerId);
    if (shuttlecock) this._drawShuttlecock(shuttlecock);
  }

  // ─── Players ───────────────────────────────────────────────────────────────

  _drawPlayers(players, activePlayerId) {
    for (const [id, data] of Object.entries(players)) {
      const isAlly   = id.startsWith('ally');
      const isActive = id === activePlayerId;
      const label    = data.label ?? this._defaultLabel(id);

      // Ghost + arrow for players currently transitioning
      if (data.movingTo) {
        this._drawMovementArrow(data, data.movingTo, isAlly);
        this._drawGhostPlayer(data.movingTo, isAlly);
      }

      this._drawPlayer(data, isAlly, label, isActive);
    }
  }

  _drawPlayer(pos, isAlly, label, isActive) {
    const { ctx, court } = this;
    const { x, y }  = court.toCanvas(pos.x, pos.y);
    const r         = court.courtW * PLAYER_RADIUS_RATIO;
    const fill      = isAlly ? ALLY_FILL   : OPP_FILL;
    const stroke    = isAlly ? ALLY_STROKE : OPP_STROKE;

    ctx.save();

    // Active player glow
    if (isActive) {
      ctx.shadowColor = GLOW_COLOUR;
      ctx.shadowBlur  = GLOW_BLUR;
    }

    // Circle
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle   = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth   = 2;
    ctx.stroke();

    ctx.shadowBlur  = 0;

    // Label
    const fontSize = Math.round(r * LABEL_FONT_RATIO * 2);
    ctx.font        = `bold ${fontSize}px system-ui, sans-serif`;
    ctx.fillStyle   = LABEL_COLOUR;
    ctx.textAlign   = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y);

    ctx.restore();
  }

  _drawGhostPlayer(pos, isAlly) {
    const { ctx, court } = this;
    const { x, y } = court.toCanvas(pos.x, pos.y);
    const r        = court.courtW * PLAYER_RADIUS_RATIO;
    const fill     = isAlly ? ALLY_FILL : OPP_FILL;

    ctx.save();
    ctx.globalAlpha = GHOST_ALPHA;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle   = fill;
    ctx.fill();
    ctx.restore();
  }

  _drawMovementArrow(from, to, isAlly) {
    const { ctx, court } = this;
    const a = court.toCanvas(from.x, from.y);
    const b = court.toCanvas(to.x,   to.y);
    const r = court.courtW * PLAYER_RADIUS_RATIO;

    // Direction unit vector
    const dx  = b.x - a.x;
    const dy  = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) return;
    const ux = dx / len;
    const uy = dy / len;

    // Start just outside player circle edge, end just outside ghost edge
    const sx = a.x + ux * (r + 2);
    const sy = a.y + uy * (r + 2);
    const ex = b.x - ux * (r + 2);
    const ey = b.y - uy * (r + 2);

    const colour = isAlly ? ALLY_FILL : OPP_FILL;

    ctx.save();
    ctx.strokeStyle = colour;
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.globalAlpha = 0.7;

    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    // Arrowhead
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.85;
    this._drawArrowHead(ctx, ex, ey, ux, uy, 7);

    ctx.restore();
  }

  _drawArrowHead(ctx, tx, ty, ux, uy, size) {
    const angle = Math.atan2(uy, ux);
    const a1 = angle + Math.PI * 0.8;
    const a2 = angle - Math.PI * 0.8;

    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx + Math.cos(a1) * size, ty + Math.sin(a1) * size);
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx + Math.cos(a2) * size, ty + Math.sin(a2) * size);
    ctx.stroke();
  }

  // ─── Shuttlecock ───────────────────────────────────────────────────────────

  _drawShuttlecock(shuttlecock) {
    const { ctx, court } = this;
    const { position, height } = shuttlecock;
    const { x, y } = court.toCanvas(position.x, position.y);

    // Radius scales with height ('high' = larger)
    const baseR  = court.courtW * SHUTTLE_RADIUS_RATIO;
    const r      = height === 'high' ? baseR * 1.4 : height === 'low' ? baseR * 0.8 : baseR;
    const corkR  = court.courtW * CORK_RADIUS_RATIO;

    ctx.save();

    // Feather skirt (outer circle, slightly transparent)
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle   = 'rgba(251, 191, 36, 0.25)';
    ctx.fill();
    ctx.strokeStyle = SHUTTLE_STROKE;
    ctx.lineWidth   = 1.2;
    ctx.stroke();

    // Cork (inner filled circle)
    ctx.beginPath();
    ctx.arc(x, y, corkR, 0, Math.PI * 2);
    ctx.fillStyle   = SHUTTLE_FILL;
    ctx.fill();
    ctx.strokeStyle = SHUTTLE_STROKE;
    ctx.lineWidth   = 1;
    ctx.stroke();

    ctx.restore();
  }

  _drawTrajectory(shuttlecock) {
    const { trajectory, speed } = shuttlecock;
    if (!trajectory || trajectory.length < 2) return;

    const { ctx, court } = this;
    const points = trajectory.map(p => court.toCanvas(p.x, p.y));

    // Number of trail dots based on speed
    const segments = TRAIL_SEGMENTS[speed] ?? TRAIL_SEGMENTS.medium;
    // Take last N+1 points (or all if fewer)
    const visible  = points.slice(-Math.min(segments + 1, points.length));

    ctx.save();
    ctx.strokeStyle = TRAJ_COLOUR;
    ctx.lineWidth   = TRAJ_WIDTH;
    ctx.setLineDash(TRAJ_DASH);
    ctx.lineCap     = 'round';

    ctx.beginPath();
    ctx.moveTo(visible[0].x, visible[0].y);
    for (let i = 1; i < visible.length; i++) {
      ctx.lineTo(visible[i].x, visible[i].y);
    }
    ctx.stroke();

    ctx.restore();
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  _defaultLabel(id) {
    const map = {
      ally1:     'YOU',
      ally2:     'A2',
      opponent1: 'B1',
      opponent2: 'B2',
    };
    return map[id] ?? id.toUpperCase();
  }
}
