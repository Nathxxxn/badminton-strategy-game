import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.requestAnimationFrame = callback => {
  callback();
  return 1;
};

globalThis.document = {
  getElementById() {
    return null;
  },
};

const { ScreenManager } = await import('../src/js/screens.js');

function fakeClassList(initial = []) {
  const values = new Set(initial);
  return {
    add(value) {
      values.add(value);
    },
    remove(value) {
      values.delete(value);
    },
    contains(value) {
      return values.has(value);
    },
    toArray() {
      return [...values];
    },
  };
}

function fakeElement() {
  return {
    style: { display: 'flex' },
    classList: fakeClassList(['active']),
    addEventListener(event, callback) {
      if (event === 'transitionend') this.transitionCallback = callback;
    },
    removeEventListener() {},
  };
}

test('show is idempotent when asked to show the current screen', async () => {
  const manager = Object.create(ScreenManager.prototype);
  const auth = fakeElement();
  manager._authenticated = false;
  manager._currentScreen = 'auth';
  manager._screens = { auth };

  manager.show('auth');
  auth.transitionCallback?.();

  assert.equal(auth.style.display, 'flex');
  assert.equal(auth.classList.contains('active'), true);
});
