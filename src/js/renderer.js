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
const GHOST_ALPHA = 0.30;

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
  drawScene(players, shuttlecock, activePlayerId = null, equipment = null) {
    if (shuttlecock) this._drawTrajectory(shuttlecock);
    this._drawPlayers(players, activePlayerId, equipment);
    if (shuttlecock) this._drawShuttlecock(shuttlecock);
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
   * Draw the choice-vs-optimal feedback:
   *  - choice marker (color reflects scoring tier: good/near/wrong)
   *  - optimal marker (yellow accent star/diamond, ink ring)
   *  - dashed ink line between them with the distance in metres
   *
   * @param {{x:number,y:number}} choice
   * @param {{x:number,y:number}} optimal
   * @param {'good'|'near'|'wrong'} [tier='wrong']
   */
  drawChoiceVsOptimal(choice, optimal, tier = 'wrong') {
    if (!choice || !optimal) return;

    const { ctx, court } = this;
    const c = court.toCanvas(choice.x, choice.y);
    const o = court.toCanvas(optimal.x, optimal.y);

    const ink    = '#0f1a14';
    const cream  = '#f4ecd8';
    const accent = '#ffd23f';
    const choiceColor =
      tier === 'good'  ? '#22c55e' :
      tier === 'near'  ? '#fb923c' :
                         '#e85d3c';

    // Court is 13.4 m long (y) × 6.1 m wide (x)
    const dxM = (choice.x - optimal.x) * 6.1;
    const dyM = (choice.y - optimal.y) * 13.4;
    const distM = Math.hypot(dxM, dyM);

    ctx.save();

    // ─── Dashed ink line between choice and optimal ─────────────────────
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(o.x, o.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // ─── Optimal marker — yellow accent disc with ink ring + star ───────
    const optR = Math.max(8, court.courtW * 0.022);
    ctx.beginPath();
    ctx.arc(o.x, o.y, optR + 2, 0, Math.PI * 2);
    ctx.fillStyle = ink;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(o.x, o.y, optR, 0, Math.PI * 2);
    ctx.fillStyle = accent;
    ctx.fill();
    // Inner star/dot
    ctx.fillStyle = ink;
    ctx.font = `bold ${Math.round(optR * 1.3)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', o.x, o.y + 1);

    // ─── Choice marker — colored disc with ink ring ─────────────────────
    const chR = Math.max(7, court.courtW * 0.018);
    ctx.beginPath();
    ctx.arc(c.x, c.y, chR + 2, 0, Math.PI * 2);
    ctx.fillStyle = ink;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(c.x, c.y, chR, 0, Math.PI * 2);
    ctx.fillStyle = choiceColor;
    ctx.fill();

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
    ctx.textBaseline = 'middle';
    ctx.fillText(distText, mx, my + 1);

    // ─── "OPTIMAL" caption above the star ───────────────────────────────
    ctx.font = `bold ${Math.round(court.courtW * 0.020)}px ` +
               `"JetBrains Mono", ui-monospace, monospace`;
    ctx.fillStyle = ink;
    ctx.textBaseline = 'bottom';
    ctx.fillText('OPTIMAL', o.x, o.y - optR - 6);

    ctx.restore();
  }

  // ─── Players ───────────────────────────────────────────────────────────────

  _drawPlayers(players, activePlayerId, equipment = null) {
    for (const [id, data] of Object.entries(players)) {
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
      const badgeR = r * 0.32;
      const bx = x + r * 0.7;
      const by = y - r * 0.7;
      ctx.beginPath();
      ctx.arc(bx, by, badgeR, 0, Math.PI * 2);
      ctx.fillStyle = '#ffd23f';
      ctx.fill();
      ctx.strokeStyle = '#0f1a14';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#0f1a14';
      ctx.font = `bold ${Math.round(r * 0.3)}px 'JetBrains Mono', monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(hand === 'left' ? 'L' : 'R', bx, by);
    }

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
    ctx.fillStyle   = fill;
    ctx.fill();
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
