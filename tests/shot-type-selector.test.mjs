import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { ShotTypeSelector, clampPowerForType } from '../src/js/shot-type-selector.js';

class FakeClassList {
  constructor(initial = []) {
    this.values = new Set(initial);
  }

  toggle(name, force) {
    if (force) this.values.add(name);
    else       this.values.delete(name);
  }

  contains(name) {
    return this.values.has(name);
  }
}

class FakeShotButton {
  constructor(type) {
    this.dataset = { shotType: type };
    this.classList = new FakeClassList(type === 'SMASH' ? ['is-active'] : []);
    this.disabled = false;
    this.attributes = new Map();
    this.listeners = new Map();
  }

  addEventListener(eventName, handler) {
    this.listeners.set(eventName, handler);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }
}

class FakeShotRoot {
  constructor(types = ['SMASH', 'DROP', 'DRIVE', 'CLEAR', 'KILL', 'NET_DROP']) {
    this.hidden = true;
    this.buttons = types.map(type => new FakeShotButton(type));
  }

  querySelectorAll(selector) {
    assert.equal(selector, '[data-shot-type]');
    return this.buttons;
  }
}

test('clampPowerForType supports kill and net drop power windows', () => {
  assert.equal(clampPowerForType(0.2, 'KILL'), 0.55);
  assert.equal(clampPowerForType(0.8, 'KILL'), 0.8);
  assert.equal(clampPowerForType(0.6, 'NET_DROP'), 0.30);
  assert.equal(clampPowerForType(0.1, 'NET_DROP'), 0.1);
  assert.equal(clampPowerForType(0.42, 'UNKNOWN'), 0.42);
});

test('shot type selector exposes all playable shot buttons', async () => {
  const html = await readFile(path.join(process.cwd(), 'index.html'), 'utf8');
  const matches = [...html.matchAll(/data-shot-type="([^"]+)"/g)].map(match => match[1]);

  assert.deepEqual(matches, ['SMASH', 'DROP', 'DRIVE', 'CLEAR', 'KILL', 'NET_DROP']);
  assert.match(html, />NET DROP<\/button>/);
});

test('shot type selector disables shots outside the incoming shuttle allowed list', () => {
  const root = new FakeShotRoot();
  const selector = new ShotTypeSelector(root);

  selector.setAllowedTypes(['NET_DROP', 'DRIVE']);

  const byType = Object.fromEntries(root.buttons.map(button => [button.dataset.shotType, button]));
  assert.equal(selector.getSelected(), 'DRIVE');
  assert.equal(byType.SMASH.disabled, true);
  assert.equal(byType.SMASH.attributes.get('aria-disabled'), 'true');
  assert.equal(byType.SMASH.classList.contains('is-disabled'), true);
  assert.equal(byType.DROP.disabled, true);
  assert.equal(byType.CLEAR.disabled, true);
  assert.equal(byType.KILL.disabled, true);
  assert.equal(byType.DRIVE.disabled, false);
  assert.equal(byType.NET_DROP.disabled, false);

  selector.select('SMASH');
  assert.equal(selector.getSelected(), 'DRIVE');

  selector.select('NET_DROP');
  assert.equal(selector.getSelected(), 'NET_DROP');
});

test('shot type selector notifies when the selected type changes', () => {
  const root = new FakeShotRoot();
  const changes = [];
  const selector = new ShotTypeSelector(root, { onChange: type => changes.push(type) });

  selector.select('DROP');
  selector.select('DROP');
  selector.setAllowedTypes(['DRIVE', 'NET_DROP']);

  assert.deepEqual(changes, ['DROP', 'DRIVE']);
});

test('main wires the shot selector allowed list from SHOT_PROFILES', async () => {
  const mainJs = await readFile(path.join(process.cwd(), 'src/js/main.js'), 'utf8');

  assert.match(mainJs, /SHOT_PROFILES/);
  assert.match(mainJs, /shotTypeSelector\.setAllowedTypes\(/);
  assert.match(mainJs, /SHOT_PROFILES\[incomingType\]\?\.allowed/);
});
