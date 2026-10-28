import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addMonths, average, boardValue, buckets, daysBetween, followersOn, istToday, monthEnd, monthList,
  monthWindow, move, pctChange, rank,
} from '../src/lib/period.ts';

test('IST today: 23:30 UTC is already the next day in India', () => {
  assert.equal(istToday(new Date('2026-10-12T19:00:00Z')), '2026-10-13');
  assert.equal(istToday(new Date('2026-10-12T18:00:00Z')), '2026-10-12');
});

test('month maths', () => {
  assert.equal(addMonths('2026-01-01', -1), '2025-12-01');
  assert.equal(monthEnd('2026-02-01'), '2026-02-28');
  assert.equal(daysBetween('2026-10-01', '2026-10-12'), 11);
  assert.deepEqual(monthList('2026-08-15', '2026-10-12'), ['2026-10-01', '2026-09-01', '2026-08-01']);
});

test('running month compares with the same days of the previous month', () => {
  assert.deepEqual(monthWindow('2026-10-01', '2026-10-12'),
    { m: '2026-10-01', upto: '2026-10-12', current: true, prev: '2026-09-01', prevUpto: '2026-09-12' });
  // 31 March vs February: clamp to Feb's last day
  assert.equal(monthWindow('2026-03-01', '2026-03-31').prevUpto, '2026-02-28');
  // a finished month compares whole months
  assert.deepEqual(monthWindow('2026-09-01', '2026-10-12'),
    { m: '2026-09-01', upto: '2026-09-30', current: false, prev: '2026-08-01', prevUpto: '2026-08-31' });
});

test('averages skip missing values; percent change needs a base', () => {
  assert.equal(average([2, null, 4]), 3);
  assert.equal(average([null]), null);
  assert.equal(pctChange(110, 100), 10);
  assert.equal(pctChange(5, 0), null);
});

test('buckets', () => {
  const b = buckets([0, 3, 5, 12, 40], [0, 5, 10, 20], (lo, hi) => (hi === null ? `${lo}+` : `${lo}–${hi - 1}`));
  assert.deepEqual(b, [
    { label: '0–4', value: 2 }, { label: '5–9', value: 1 }, { label: '10–19', value: 1 }, { label: '20+', value: 1 },
  ]);
});

test('ties share a rank; the tiebreak only orders within the tie', () => {
  const r = rank([{ n: 'a', v: 15, t: 2 }, { n: 'b', v: 20, t: 9 }, { n: 'c', v: 15, t: 1 }, { n: 'd', v: 3, t: 0 }],
    (x) => x.v, (x, y) => x.t - y.t);
  assert.deepEqual(r.map((x) => [x.item.n, x.rank]), [['b', 1], ['c', 2], ['a', 2], ['d', 4]]);
});

test('board values for each period', () => {
  const snaps = [
    { day: '2026-09-30', followers: 1000 }, { day: '2026-10-05', followers: 1100 },
    { day: '2026-10-11', followers: 1180 }, { day: '2026-10-12', followers: 1200 },
  ];
  const posts = ['2026-09-29', '2026-10-01', '2026-10-06', '2026-10-12'];
  assert.equal(followersOn(snaps, '2026-10-10'), 1100);
  assert.equal(boardValue('followers', 'month', '2026-10-12', snaps, posts, '2026-01-01'), 1200);
  assert.equal(boardValue('growth', 'month', '2026-10-12', snaps, posts, '2026-01-01'), 200);
  assert.equal(boardValue('growth', '1d', '2026-10-12', snaps, posts, '2026-01-01'), 20);
  assert.equal(boardValue('growth', '7d', '2026-10-12', snaps, posts, '2026-01-01'), 100);
  assert.equal(boardValue('posts', 'month', '2026-10-12', snaps, posts, '2026-01-01'), 3);
  assert.equal(boardValue('posts', '7d', '2026-10-12', snaps, posts, '2026-01-01'), 2);
  assert.equal(boardValue('posts', 'month', '2026-10-12', snaps, posts, '2026-10-02'), 2);  // joined on the 2nd
  assert.equal(boardValue('growth', 'month', '2026-10-12', [], posts, '2026-01-01'), null);
});

test('rank move: up is positive, new entries have no move', () => {
  assert.equal(move(3, 5), 2);
  assert.equal(move(5, 3), -2);
  assert.equal(move(1, undefined), null);
});
