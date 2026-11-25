import { test } from 'node:test';
import assert from 'node:assert/strict';
import { on, emit, clearAll } from '../src/engine/events.js';

test('on/emit delivers data; unsubscribe stops delivery', () => {
  clearAll();
  const got = [];
  const off = on('x', d => got.push(d));
  emit('x', 1);
  off();
  emit('x', 2);
  assert.deepEqual(got, [1]);
});

test('throwing listener does not block the next', () => {
  clearAll();
  let ran = false;
  const orig = console.error; console.error = () => {};
  on('y', () => { throw new Error('boom'); });
  on('y', () => { ran = true; });
  emit('y');
  console.error = orig;
  assert.equal(ran, true);
});
