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
 * All positions are normalized (0–1), snapped to the 50 cm grid via snap.js,
 * then converted to canvas pixels via court.toCanvas().
 * This module is purely visual — it does not own game state.
 */

import { loftedCurveControl } from './trajectory.js';


// ── Player colors — Rally design ───────────────────────────────────────────

// YOU (ally1 with label "YOU") — amber accent
const YOU_FILL    = '#ffd23f';
const YOU_STROKE  = '#0f1a14';
const YOU_LABEL   = '#0f1a14';

// Ally (partner) — blue
const ALLY_FILL   = '#2e6fc5';
const ALLY_STROKE = '#0f1a14';
const ALLY_LABEL  = '#fff8e1';

// Opponents — danger red
const OPP_FILL    = '#e85d3c';
const OPP_STROKE  = '#0f1a14';
const OPP_LABEL   = '#fff8e1';

// Ghost (movingTo preview)
const GHOST_ALPHA = 0.55;

// Glow (active player) — amber
const GLOW_COLOUR = 'rgba(255, 210, 63, 0.70)';
const GLOW_BLUR   = 18;

// Label
const LABEL_FONT_RATIO = 0.45;
const PLAYER_RADIUS_RATIO = 0.038;

// Shuttlecock — feather white with ink border
const SHUTTLE_RADIUS_RATIO = 0.022;
const SHUTTLE_FILL   = '#fff8e1';
const SHUTTLE_STROKE = '#0f1a14';
const CORK_RADIUS_RATIO = 0.008;

// Trajectory — ink dashes
const TRAJ_COLOUR = 'rgba(15, 26, 20, 0.40)';
const TRAJ_DASH   = [5, 5];
const TRAJ_WIDTH  = 1.5;
const IMPACT_SEGMENT_COLOUR = 'rgba(255, 210, 63, 0.88)';
const IMPACT_SEGMENT_WIDTH = 4;
const IMPACT_MARKER_COLOUR = '#ffd23f';

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
   * @param {Object|null} shuttlecock — { position, trajectory, speed?, height?, type? }
   * @param {string|null} activePlayerId — role id of the player whose turn it is
   */
  drawScene(players, shuttlecock, activePlayerId = null, equipment = null) {
    if (shuttlecock) this._drawTrajectory(shuttlecock);
    if (shuttlecock?.showImpactWindow && shuttlecock?.validImpactPoints?.length) {
      this.drawValidImpactSegments(shuttlecock.validImpactPoints, shuttlecock.activeImpactPoint ?? null);
    }
    this._drawPlayers(players, activePlayerId, equipment);
    if (shuttlecock) this._drawShuttlecock(shuttlecock);
  }

  drawValidImpactSegments(points, activePoint = null) {
    if (!Array.isArray(points) || points.length === 0) return;

    const { ctx, court } = this;
    const sorted = [...points].sort((a, b) => (a.t ?? 0) - (b.t ?? 0));
    const groups = [];
    let current = [];

    sorted.forEach((point, index) => {
      const previous = sorted[index - 1];
      if (previous && Number.isFinite(point.t) && Number.isFinite(previous.t) && point.t - previous.t > 0.011) {
        groups.push(current);
        current = [];
      }
      current.push(point);
    });
    if (current.length) groups.push(current);

    ctx.save();
    ctx.strokeStyle = IMPACT_SEGMENT_COLOUR;
    ctx.fillStyle = IMPACT_SEGMENT_COLOUR;
    ctx.lineWidth = IMPACT_SEGMENT_WIDTH;
    ctx.lineCap = 'round';
    ctx.setLineDash([]);

    groups.forEach(group => {
      const canvasPoints = group.map(point => court.toCanvas(point.x, point.y));
      if (canvasPoints.length === 1) {
        ctx.beginPath();
        ctx.arc(canvasPoints[0].x, canvasPoints[0].y, IMPACT_SEGMENT_WIDTH / 2, 0, Math.PI * 2);
        ctx.fill();
        return;
      }

      ctx.beginPath();
      ctx.moveTo(canvasPoints[0].x, canvasPoints[0].y);
      canvasPoints.slice(1).forEach(point => ctx.lineTo(point.x, point.y));
      ctx.stroke();
    });

    if (activePoint) {
      const marker = court.toCanvas(activePoint.x, activePoint.y);
      ctx.strokeStyle = '#0f1a14';
      ctx.fillStyle = IMPACT_MARKER_COLOUR;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(marker.x, marker.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }

  drawReachCircle(playerPos, reachMetres, strokeStyle = 'rgba(15,26,20,0.55)', mode = 'idle') {
    const { ctx, court } = this;
    const reachPx = reachMetres / 6.1 * court.courtW;
    const { x, y } = court.toCanvas(playerPos.x, playerPos.y);
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, reachPx, 0, Math.PI * 2);
    if (mode === 'hover-out') {
      ctx.strokeStyle = '#ffd23f';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = 'rgba(255, 210, 63, 0.6)';
      ctx.shadowBlur = 12;
    } else {
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = 1.5;
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  /**
   * Dim the area outside the move-radius to make the allowed zone read as a
   * "window" of light. The veil is clipped to the court rect so it doesn't
   * bleed over the canvas padding.
   *
   * @param {{ x: number, y: number }} playerPos    normalized player position
   * @param {number}                   reachMetres  radius in metres
   */
  drawOutOfReachVeil(playerPos, reachMetres) {
    const { ctx, court } = this;
    const reachPx = reachMetres / 6.1 * court.courtW;
    const { x: cx, y: cy } = court.toCanvas(playerPos.x, playerPos.y);

    ctx.save();
    ctx.beginPath();
    ctx.rect(court.courtX, court.courtY, court.courtW, court.courtH);
    ctx.clip();

    ctx.beginPath();
    ctx.rect(court.courtX, court.courtY, court.courtW, court.courtH);
    ctx.arc(cx, cy, reachPx, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(15, 26, 20, 0.28)';
    ctx.fill('evenodd');
    ctx.restore();
  }

  drawCorrectionIndicator(from, to) {
    const { ctx, court } = this;
    const f = court.toCanvas(from.x, from.y);
    const t = court.toCanvas(to.x, to.y);
    const cpx = (f.x + t.x) / 2;
    const cpy = (f.y + t.y) / 2 - 0.15 * court.courtH;

    ctx.save();

    ctx.setLineDash([8, 5]);
    ctx.strokeStyle = 'rgba(251,146,60,0.8)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(f.x, f.y);
    ctx.quadraticCurveTo(cpx, cpy, t.x, t.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Arrow head at to using direction from control point
    const ax = t.x - cpx;
    const ay = t.y - cpy;
    const len = Math.hypot(ax, ay);
    if (len > 0) {
      const ux = ax / len;
      const uy = ay / len;
      const headLen = 10;
      const spread = 0.4;
      ctx.fillStyle = 'rgba(251,146,60,0.9)';
      ctx.beginPath();
      ctx.moveTo(t.x, t.y);
      ctx.lineTo(t.x - headLen * (ux - spread * uy), t.y - headLen * (uy + spread * ux));
      ctx.lineTo(t.x - headLen * (ux + spread * uy), t.y - headLen * (uy - spread * ux));
      ctx.closePath();
      ctx.fill();
    }

    // Landing ring
    const ringR = court.courtW * 0.022 * 0.5;
    ctx.strokeStyle = 'rgba(251,146,60,0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(t.x, t.y, ringR, 0, Math.PI * 2);
    ctx.stroke();

    // Label
    ctx.fillStyle = 'rgba(251,146,60,0.9)';
    ctx.font = `bold ${Math.round(court.courtW * 0.022)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Optimal', t.x, t.y - ringR - 4);

    ctx.restore();
  }

  /**
   * Draw minimal choice-vs-optimal feedback:
   *  - dot at choice position (amber) and optimal position (green)
   *  - dashed ink line between them
   *  - distance pill at midpoint
   *
   * @param {{x:number,y:number}} choice
   * @param {{x:number,y:number}} optimal
   * @param {'good'|'near'|'wrong'} [tier='wrong']  — kept for API compatibility, unused visually
   */
  drawChoiceVsOptimal(choice, optimal, tier = 'wrong') {
    if (!choice || !optimal) return;

    const { ctx, court } = this;
    const c = court.toCanvas(choice.x, choice.y);
    const o = court.toCanvas(optimal.x, optimal.y);

    const ink   = '#0f1a14';
    const cream = '#f4ecd8';

    // Court is 13.4 m long (y) × 6.1 m wide (x)
    const dxM = (choice.x - optimal.x) * 6.1;
    const dyM = (choice.y - optimal.y) * 13.4;
    const distM = Math.hypot(dxM, dyM);

    ctx.save();

    const fontSize = Math.round(court.courtW * 0.026);

    // Outward unit vector from other → this point (so labels flee each other)
    const dx = c.x - o.x;
    const dy = c.y - o.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;

    const drawLabel = (px, py, outX, outY, fill, label) => {
      ctx.font = `bold ${fontSize}px "JetBrains Mono", ui-monospace, monospace`;
      const padX = 6, padY = 3;
      const tw = ctx.measureText(label).width;
      const pw = tw + padX * 2;
      const ph = fontSize + padY * 2;
      const cx = px + outX * (ph / 2 + 4);
      const cy = py + outY * (ph / 2 + 4);
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.roundRect(cx - pw / 2, cy - ph / 2, pw, ph, 4);
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      ctx.stroke();
      ctx.fillStyle = ink;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, cx, cy + 0.5);
    };

    // ─── YOU label (amber) — pushed away from optimal ───────────────────
    drawLabel(c.x, c.y, ux, uy, YOU_FILL, 'YOU');

    // ─── OPTIMAL label (green) — pushed away from choice ────────────────
    drawLabel(o.x, o.y, -ux, -uy, '#1f8a4c', 'OPTIMAL');

    // ─── Dashed ink line between choice and optimal ─────────────────────
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(o.x, o.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // ─── Distance label (cream pill on ink) at the line midpoint ────────
    const mx = (c.x + o.x) / 2;
    const my = (c.y + o.y) / 2;
    const distText = distM < 10
      ? `${distM.toFixed(1)} m`
      : `${Math.round(distM)} m`;
    ctx.font = `bold ${Math.round(court.courtW * 0.026)}px ` +
               `"JetBrains Mono", ui-monospace, monospace`;
    const padX = 8, padY = 4;
    const textW = ctx.measureText(distText).width;
    const pillW = textW + padX * 2;
    const pillH = Math.round(court.courtW * 0.026) + padY * 2;

    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.roundRect(mx - pillW / 2, my - pillH / 2, pillW, pillH, 6);
    ctx.fill();
    ctx.fillStyle = cream;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(distText, mx, my + 1);

    ctx.restore();
  }

  // ─── Players ───────────────────────────────────────────────────────────────

  _drawPlayers(players, activePlayerId, equipment = null) {
    // Resolve positions, offsetting any two players that share the same spot
    // so neither is hidden behind the other.
    const entries = Object.entries(players).filter(([, d]) => d != null);
    const JITTER  = 0.025; // ~15 cm offset in normalised coords
    const seen    = [];
    const resolved = entries.map(([id, data]) => {
      let { x, y } = data;
      for (const prev of seen) {
        if (Math.abs(x - prev.x) < 0.005 && Math.abs(y - prev.y) < 0.005) {
          x += JITTER;
          y -= JITTER * 0.5;
        }
      }
      seen.push({ x, y });
      return [id, { ...data, x, y }];
    });

    for (const [id, data] of resolved) {
      const isAlly   = id.startsWith('ally');
      const isActive = id === activePlayerId;
      const label    = data.label ?? this._defaultLabel(id);
      const hand     = this._resolveHand(equipment, id);

      const isYou        = label === 'YOU';
      const resolvedFill = isYou ? YOU_FILL : isAlly ? ALLY_FILL : OPP_FILL;

      if (data.movingTo) {
        this._drawMovementArrow(data, data.movingTo, resolvedFill);
        this._drawGhostPlayer(data.movingTo, resolvedFill);
      }

      this._drawPlayer(data, isAlly, label, isActive, hand);
    }
  }

  _drawPlayer(pos, isAlly, label, isActive, hand = null) {
    const { ctx, court } = this;
    const { x, y } = court.toCanvas(pos.x, pos.y);
    const r = court.courtW * PLAYER_RADIUS_RATIO;

    const isYou = label === 'YOU';
    const fill       = isYou ? YOU_FILL   : isAlly ? ALLY_FILL   : OPP_FILL;
    const stroke     = isYou ? YOU_STROKE : isAlly ? ALLY_STROKE : OPP_STROKE;
    const labelColor = isYou ? YOU_LABEL  : isAlly ? ALLY_LABEL  : OPP_LABEL;

    ctx.save();

    if (isActive) {
      ctx.shadowColor = GLOW_COLOUR;
      ctx.shadowBlur  = GLOW_BLUR;
    }

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle   = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth   = 3;
    ctx.stroke();

    ctx.shadowBlur = 0;

    const fontSize = Math.round(r * LABEL_FONT_RATIO * 2);
    ctx.font        = `800 ${fontSize}px 'JetBrains Mono', monospace`;
    ctx.fillStyle   = labelColor;
    ctx.textAlign   = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y);

    if (hand === 'left' || hand === 'right') {
      // Allies face up (toward opponent half) — racket on the hand side as seen top-down.
      // Opponents face down — their right/left is mirrored from the viewer perspective.
      const handOffset = (hand === 'right') === isAlly ? r * 1.3 : -(r * 1.3);
      this._drawRacketIcon(ctx, x + handOffset, y, r, isAlly);
    }

    ctx.restore();
  }

  /**
   * Draw a small stylised racket icon (oval head + short grip).
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} bx   Centre x of icon
   * @param {number} by   Centre y of icon
   * @param {number} r    Player circle radius (used for scaling)
   * @param {boolean} isAlly
   */
  _drawRacketIcon(ctx, bx, by, r, isAlly) {
    const headRx = r * 0.28;
    const headRy = r * 0.36;
    const gripLen = r * 0.48;
    const angle   = Math.PI * 0.08; // slight tilt
    const colour  = isAlly ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.85)';

    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(angle);
    ctx.strokeStyle = colour;
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([]);

    // Head (oval)
    ctx.beginPath();
    ctx.ellipse(0, 0, headRx, headRy, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Cross strings (simplified: one horizontal, one vertical)
    ctx.lineWidth = 0.8;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(-headRx * 0.7, 0);
    ctx.lineTo( headRx * 0.7, 0);
    ctx.moveTo(0, -headRy * 0.7);
    ctx.lineTo(0,  headRy * 0.7);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Grip (line below the head)
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(0, headRy);
    ctx.lineTo(0, headRy + gripLen);
    ctx.stroke();

    ctx.restore();
  }

  _resolveHand(equipment, id) {
    if (!equipment) return null;
    const direct = equipment[id]?.hand ?? null;
    if (direct) return direct;

    if (id === 'ally1') return equipment.player?.hand ?? null;
    if (id === 'ally2') return equipment.partner?.hand ?? null;
    if (id === 'opponent1') return equipment.opp1?.hand ?? null;
    if (id === 'opponent2') return equipment.opp2?.hand ?? null;
    return null;
  }

  _drawGhostPlayer(pos, fill) {
    const { ctx, court } = this;
    const { x, y } = court.toCanvas(pos.x, pos.y);
    const r        = court.courtW * PLAYER_RADIUS_RATIO;

    ctx.save();
    ctx.globalAlpha = GHOST_ALPHA;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    // Thin stroke ring for legibility over the veil
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = fill;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  _drawMovementArrow(from, to, fill) {
    const { ctx, court } = this;
    const a  = court.toCanvas(from.x, from.y);
    const b  = court.toCanvas(to.x,   to.y);
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

    ctx.save();
    ctx.strokeStyle = fill;
    ctx.lineWidth   = 2.5;
    ctx.setLineDash([5, 4]);
    ctx.shadowColor = 'rgba(255,255,255,0.5)';
    ctx.shadowBlur  = 6;

    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    // Arrowhead
    ctx.setLineDash([]);
    this._drawArrowHead(ctx, ex, ey, ux, uy, 8);

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
    ctx.fillStyle   = 'rgba(255, 248, 225, 0.25)';  // SHUTTLE_FILL at 25% alpha
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

  // ─── Trajectory drawing ───────────────────────────────────────────────────

  /**
   * Draw the shuttle trajectory with visual style differentiated by shot type.
   *
   * Type → style mapping:
   *   DRIVE           — solid straight line
   *   SMASH           — double parallel straight lines
   *   KILL            — triple parallel straight lines
   *   CLEAR           — solid bezier curve (lofted)
   *   DROP            — dashed bezier curve
   *   NET_DROP        — short dotted bezier curve
   *   NET_DROP+spin   — dotted bezier + small spin loops
   *   (other/unknown) — legacy dotted line
   */
  _drawTrajectory(shuttlecock) {
    const { trajectory, speed, type, spinApplied } = shuttlecock;
    if (!trajectory || trajectory.length < 2) return;

    const { ctx, court } = this;
    const points = trajectory.map(p => court.toCanvas(p.x, p.y));

    // Number of trail points based on speed
    const segments = TRAIL_SEGMENTS[speed] ?? TRAIL_SEGMENTS.medium;
    const visible  = points.slice(-Math.min(segments + 1, points.length));

    ctx.save();
    ctx.lineCap  = 'round';
    ctx.lineJoin = 'round';

    switch (type) {
      case 'DRIVE':
        this._strokePath(ctx, visible, [], 1.8, TRAJ_COLOUR);
        break;

      case 'SMASH':
        this._drawParallelLines(ctx, visible, 2, 3.5, 1.5, TRAJ_COLOUR);
        break;

      case 'KILL':
        this._drawParallelLines(ctx, visible, 3, 2.5, 1.4, TRAJ_COLOUR);
        break;

      case 'CLEAR':
        this._strokeCurve(ctx, visible, [], 2.0, TRAJ_COLOUR, type);
        break;

      case 'DROP':
        this._strokeCurve(ctx, visible, [8, 6], 1.8, TRAJ_COLOUR, type);
        break;

      case 'NET_DROP':
        if (spinApplied) {
          this._strokeCurve(ctx, visible, [3, 5], 1.5, TRAJ_COLOUR, type);
          this._drawSpinLoops(ctx, visible, TRAJ_COLOUR);
        } else {
          this._strokeCurve(ctx, visible, [3, 5], 1.5, TRAJ_COLOUR, type);
        }
        break;

      default:
        // Fallback: legacy dotted line
        ctx.strokeStyle = TRAJ_COLOUR;
        ctx.lineWidth   = TRAJ_WIDTH;
        ctx.setLineDash(TRAJ_DASH);
        ctx.beginPath();
        ctx.moveTo(visible[0].x, visible[0].y);
        for (let i = 1; i < visible.length; i++) ctx.lineTo(visible[i].x, visible[i].y);
        ctx.stroke();
    }

    ctx.setLineDash([]);
    ctx.restore();
  }

  /** Stroke a straight polyline through the given canvas points. */
  _strokePath(ctx, pts, dash, width, colour) {
    ctx.strokeStyle = colour;
    ctx.lineWidth   = width;
    ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  }

  /**
   * Stroke a quadratic bezier curve through the visible points.
   * The control point is raised upward to suggest a lofted trajectory.
   */
  _strokeCurve(ctx, pts, dash, width, colour, type = 'DROP') {
    if (pts.length < 2) return;
    const start = pts[0];
    const end   = pts[pts.length - 1];
    const control = loftedCurveControl(this.court, start, end, type);

    ctx.strokeStyle = colour;
    ctx.lineWidth   = width;
    ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.quadraticCurveTo(control.x, control.y, end.x, end.y);
    ctx.stroke();
  }

  /**
   * Draw N parallel lines offset perpendicular to the path direction.
   * Used for SMASH (n=2) and KILL (n=3).
   */
  _drawParallelLines(ctx, pts, n, gap, width, colour) {
    if (pts.length < 2) return;
    const start = pts[0];
    const end   = pts[pts.length - 1];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) return;
    // Perpendicular unit vector
    const px = -dy / len;
    const py =  dx / len;

    // Centre the group of lines
    const totalSpan = gap * (n - 1);
    const startOffset = -totalSpan / 2;

    ctx.strokeStyle = colour;
    ctx.lineWidth   = width;
    ctx.setLineDash([]);

    for (let i = 0; i < n; i++) {
      const off = startOffset + i * gap;
      ctx.beginPath();
      ctx.moveTo(start.x + px * off, start.y + py * off);
      // Draw through all visible points with the same offset
      for (let j = 1; j < pts.length; j++) {
        ctx.lineTo(pts[j].x + px * off, pts[j].y + py * off);
      }
      ctx.stroke();
    }
  }

  /**
   * Draw small elliptical loops along the midpoint of the trajectory
   * to suggest spin (used for NET_DROP with spin).
   */
  _drawSpinLoops(ctx, pts, colour) {
    if (pts.length < 2) return;
    const start = pts[0];
    const end   = pts[pts.length - 1];
    const loopR = 4;
    const count = 3;

    ctx.strokeStyle = colour;
    ctx.lineWidth   = 1;
    ctx.setLineDash([]);

    for (let i = 1; i <= count; i++) {
      const t  = i / (count + 1);
      const lx = start.x + (end.x - start.x) * t;
      const ly = start.y + (end.y - start.y) * t;
      ctx.beginPath();
      ctx.ellipse(lx, ly, loopR, loopR * 0.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
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
