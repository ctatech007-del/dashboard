import { test } from 'node:test';
import assert from 'node:assert/strict';
import { needs } from '../src/lib/needs.ts';

const ok = { status: 'active', noPostDays: 2, contractDays: 120, lastOutcome: 'ok' };

test('an active, posting student with a long contract needs nothing', () => {
  assert.deepEqual(needs(ok), []);
});

test('defaults: 14+ days without a post, contract within 30 days, unreadable profile', () => {
  assert.deepEqual(needs({ ...ok, noPostDays: 14 }), ['no_post']);
  assert.deepEqual(needs({ ...ok, contractDays: 30 }), ['contract']);
  assert.deepEqual(needs({ ...ok, contractDays: -3 }), ['contract']);   // already ended
  assert.deepEqual(needs({ ...ok, lastOutcome: 'private' }), ['data']);
  assert.deepEqual(needs({ ...ok, lastOutcome: null }), ['data']);       // never scraped
});

test('thresholds can be changed per filter; no contract date means no contract flag', () => {
  assert.deepEqual(needs({ ...ok, noPostDays: 8 }, { no_post: 7 }), ['no_post']);
  assert.deepEqual(needs({ ...ok, contractDays: null }), []);
});

test('students who left or are paused never need attention', () => {
  assert.deepEqual(needs({ ...ok, status: 'left', noPostDays: 90 }), []);
  assert.deepEqual(needs({ ...ok, status: 'paused', lastOutcome: 'error' }), []);
});
