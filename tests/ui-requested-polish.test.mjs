import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('home page declares the shuttle favicon asset', async () => {
  const html = await readFile(path.join(process.cwd(), 'index.html'), 'utf8');

  assert.match(html, /<link rel="icon" type="image\/svg\+xml" href="assets\/favicon\.svg">/);
});

test('drills tutorial uses the shuttle mark and aligns with the drill feature card', async () => {
  const screens = await readFile(path.join(process.cwd(), 'src/js/screens.js'), 'utf8');
  const css = await readFile(path.join(process.cwd(), 'src/css/style.css'), 'utf8');

  assert.match(screens, /<span class="tutorial-icon">\$\{SVG_SHUTTLE\}<\/span>/);
  assert.doesNotMatch(screens, /<span class="tutorial-icon">📖<\/span>/);
  assert.match(css, /\.tutorial-card\s*\{[^}]*margin:\s*0 36px 24px;/s);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*\.tutorial-card \{ margin-left: 18px; margin-right: 18px; \}/);
});

test('leaderboard tabs keep the same horizontal inset as rating cards', async () => {
  const css = await readFile(path.join(process.cwd(), 'src/css/style.css'), 'utf8');

  assert.match(css, /\.lb-tabs\s*\{[^}]*margin:\s*0 36px 20px;/s);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*\.lb-tabs \{ margin-left: 18px; margin-right: 18px; \}/);
});

test('shot test page uses the current shot mechanic and UI modules', async () => {
  const html = await readFile(path.join(process.cwd(), 'shot-test.html'), 'utf8');

  assert.match(html, /type="module"/);
  assert.match(html, /import \{ Court \} from '\.\/src\/js\/court\.js'/);
  assert.match(html, /import \{ Renderer \} from '\.\/src\/js\/renderer\.js'/);
  assert.match(html, /import \{ DragShooter \} from '\.\/src\/js\/drag\.js'/);
  assert.match(html, /import \{ ShotTypeSelector, clampPowerForType \} from '\.\/src\/js\/shot-type-selector\.js'/);
  assert.match(html, /class="shot-type-selector"/);
  assert.doesNotMatch(html, /function projectLanding/);
  assert.doesNotMatch(html, /const MAX_DRAG_PX/);
  assert.match(html, /id="tuning-panel"/);
  assert.match(html, /id="shot-count"/);
  assert.match(html, /function updateLabReadout/);
  assert.match(html, /shotTypeSelector\.show\(\)/);
  assert.match(html, /drag\.activate/);
});

test('shot test page keeps a grounded shuttle at the last impact point', async () => {
  const html = await readFile(path.join(process.cwd(), 'shot-test.html'), 'utf8');

  assert.match(html, /function drawGroundedShuttle/);
  assert.match(html, /drawGroundedShuttle\(lab\.lastShot\.aimPoint\)/);
  assert.match(html, /lab\.flight \|\| !lab\.lastShot/);
});

test('shot lab fades the active shot trace from color to grey during flight', async () => {
  const html = await readFile(path.join(process.cwd(), 'shot-test.html'), 'utf8');

  assert.match(html, /function drawLiveShotTrace/);
  assert.match(html, /1 - lab\.flightProgress/);
  assert.match(html, /drawLiveShotTrace\(lab\.flight\.from, lab\.flight\.to, lab\.flight\.type, lab\.flight\.power, 1 - lab\.flightProgress\)/);
  assert.match(html, /drag\.setShotType\(shotTypeSelector\.getSelected\(\)\)/);
});

test('curved shot lab traces and shuttle flight share one lofted curve sampler', async () => {
  const trajectory = await readFile(path.join(process.cwd(), 'src/js/trajectory.js'), 'utf8');
  const animations = await readFile(path.join(process.cwd(), 'src/js/animations.js'), 'utf8');
  const drag = await readFile(path.join(process.cwd(), 'src/js/drag.js'), 'utf8');
  const main = await readFile(path.join(process.cwd(), 'src/js/main.js'), 'utf8');
  const renderer = await readFile(path.join(process.cwd(), 'src/js/renderer.js'), 'utf8');
  const html = await readFile(path.join(process.cwd(), 'shot-test.html'), 'utf8');

  assert.match(trajectory, /export function loftedCurveControl/);
  assert.match(trajectory, /export function sampleLoftedCurvePoint/);
  assert.match(trajectory, /DROP:\s*0\.18/);
  assert.match(animations, /import \{ sampleLoftedCurvePoint/);
  assert.match(animations, /sampleLoftedCurvePoint\(f\.from, f\.to, t, court, curveType\)/);
  assert.match(drag, /import \{ loftedCurveControl/);
  assert.match(main, /flyShuttle\(impactPoint, bridedShot\.aimPoint, flightSpeed, 'low', bridedShot\.type\)/);
  assert.match(renderer, /import \{ loftedCurveControl/);
  assert.match(html, /import \{ loftedCurveControl, sampleLoftedCurvePoint \}/);
  assert.match(html, /type:\s*lab\.lastShot\?\.type \?\? shotTypeSelector\.getSelected\(\)/);
  assert.match(html, /sampleLoftedCurvePoint\(flight\.from, flight\.to, eased, court, flight\.type\)/);
  assert.doesNotMatch(drag, /arcFraction\s*=/);
  assert.doesNotMatch(html, /function arcLift/);
  assert.doesNotMatch(html, /arcFraction\s*=/);
});

test('shuttle flight animation does not draw extra yellow trail dots', async () => {
  const animations = await readFile(path.join(process.cwd(), 'src/js/animations.js'), 'utf8');

  assert.doesNotMatch(animations, /TRAIL_DOTS/);
  assert.doesNotMatch(animations, /TRAIL_DOT_SPACING/);
  assert.doesNotMatch(animations, /ctx\.arc\(tp\.x, tp\.y, tr/);
});

test('valid impact points are not rendered as yellow dots by default', async () => {
  const renderer = await readFile(path.join(process.cwd(), 'src/js/renderer.js'), 'utf8');
  const html = await readFile(path.join(process.cwd(), 'shot-test.html'), 'utf8');

  assert.match(renderer, /if \(shuttlecock\?\.showImpactWindow && shuttlecock\?\.validImpactPoints\?\.length\)/);
  assert.doesNotMatch(html, /showImpactWindow:\s*true/);
});

test('shot lab opts into experimental slingshot profiles without changing main game drag setup', async () => {
  const html = await readFile(path.join(process.cwd(), 'shot-test.html'), 'utf8');
  const main = await readFile(path.join(process.cwd(), 'src/js/main.js'), 'utf8');

  assert.match(html, /const LAB_DRAG_PROFILES\s*=\s*Object\.freeze/);
  assert.match(html, /new DragShooter\(canvas, court, onShotFired, \{\s*profiles:\s*LAB_DRAG_PROFILES,\s*\}\)/s);
  assert.match(html, /SMASH:\s*\{\s*maxDragPx:\s*205/);
  assert.match(html, /SMASH:[^\n]*targetYMax:\s*0\.42/);
  assert.match(html, /DROP:\s*\{\s*maxDragPx:\s*120/);
  assert.match(html, /CLEAR:[^\n]*targetYMax:\s*0\.12/);
  assert.match(html, /NET_DROP:\s*\{\s*maxDragPx:\s*95/);
  assert.match(main, /new DragShooter\(canvas, court, onShotFired\)/);
  assert.doesNotMatch(main, /LAB_DRAG_PROFILES|profiles:\s*LAB_DRAG_PROFILES/);
});
