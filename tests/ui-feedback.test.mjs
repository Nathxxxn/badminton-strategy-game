import assert from 'node:assert/strict';
import test from 'node:test';

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  add(...items) {
    items.forEach(item => this.values.add(item));
  }

  contains(item) {
    return this.values.has(item);
  }
}

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.attributes = new Map();
    this.classList = new FakeClassList();
    this.textContent = '';
  }

  appendChild(child) {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  remove() {
    if (!this.parent) return;
    this.parent.children = this.parent.children.filter(child => child !== this);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  querySelector(selector) {
    if (selector !== '.rally-toast') return null;
    return this.children.find(child => child.classList.contains('rally-toast')) ?? null;
  }
}

globalThis.document = {
  createElement(tagName) {
    return new FakeElement(tagName);
  },
};

const { showToast } = await import('../src/js/ui-feedback.js');

test('showToast renders one accessible message in the provided root', () => {
  const root = new FakeElement('div');

  const first = showToast(root, 'Match mode is coming soon', 'info');
  const second = showToast(root, 'Profile saved', 'success');

  assert.equal(root.children.length, 1);
  assert.equal(root.children[0], second);
  assert.equal(first.textContent, 'Match mode is coming soon');
  assert.equal(second.textContent, 'Profile saved');
  assert.equal(second.attributes.get('role'), 'status');
  assert.equal(second.attributes.get('data-variant'), 'success');
});
