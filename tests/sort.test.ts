import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextSort, parseSort, sortBy } from '../src/lib/sort.ts';

const rows = [{ h: 'b', n: 3 }, { h: 'a', n: null }, { h: 'c', n: 10 }];
const val = (r: { h: string; n: number | null }, k: string) => (k === 'h' ? r.h : r.n);

test('sorts numbers and text both ways; empty values always last', () => {
  assert.deepEqual(sortBy(rows, { key: 'n', dir: 'desc' }, val).map((r) => r.h), ['c', 'b', 'a']);
  assert.deepEqual(sortBy(rows, { key: 'n', dir: 'asc' }, val).map((r) => r.h), ['b', 'c', 'a']);
  assert.deepEqual(sortBy(rows, { key: 'h', dir: 'asc' }, val).map((r) => r.h), ['a', 'b', 'c']);
});

test('reading the sort from the URL falls back safely', () => {
  assert.deepEqual(parseSort({}, ['h', 'n'], { key: 'h', dir: 'asc' }), { key: 'h', dir: 'asc' });
  assert.deepEqual(parseSort({ sort: 'n' }, ['h', 'n'], { key: 'h', dir: 'asc' }), { key: 'n', dir: 'desc' });
  assert.deepEqual(parseSort({ sort: 'x', dir: 'up' }, ['h', 'n'], { key: 'h', dir: 'asc' }), { key: 'h', dir: 'asc' });
});

test('clicking the same header flips it; a new header starts at its default', () => {
  assert.deepEqual(nextSort({ key: 'n', dir: 'desc' }, 'n'), { key: 'n', dir: 'asc' });
  assert.deepEqual(nextSort({ key: 'n', dir: 'desc' }, 'h', 'asc'), { key: 'h', dir: 'asc' });
});
