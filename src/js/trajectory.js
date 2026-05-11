const CURVED_LIFT_RATIOS = Object.freeze({
  CLEAR: 0.24,
  DROP: 0.18,
  NET_DROP: 0.14,
});

const DEFAULT_CURVED_LIFT_RATIO = 0.18;

export function loftedCurveControl(court, start, end, type = 'DROP') {
  const mx = (start.x + end.x) / 2;
  const liftRatio = CURVED_LIFT_RATIOS[type] ?? DEFAULT_CURVED_LIFT_RATIO;
  const liftPx = court.courtH * liftRatio;
  const my = (start.y + end.y) / 2 - liftPx;

  return { x: mx, y: my };
}

export function sampleLoftedCurvePoint(fromNorm, toNorm, t, court, type = 'DROP') {
  const start = court.toCanvas(fromNorm.x, fromNorm.y);
  const end = court.toCanvas(toNorm.x, toNorm.y);
  const control = loftedCurveControl(court, start, end, type);
  const u = 1 - t;
  const point = {
    x: u * u * start.x + 2 * u * t * control.x + t * t * end.x,
    y: u * u * start.y + 2 * u * t * control.y + t * t * end.y,
  };

  return court.toNormalized(point.x, point.y);
}
