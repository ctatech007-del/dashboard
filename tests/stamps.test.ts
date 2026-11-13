import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mrz, passportOrder, placement, REWARD_STEPS, STAMPS, visaPages } from '../src/lib/stamps.ts';

test('22 stamps, keys unique, and every key is one the database awards', () => {
  assert.equal(STAMPS.length, 22);
  assert.equal(new Set(STAMPS.map((s) => s.key)).size, 22);
  const sql = readFileSync(new URL('../supabase/migrations/20261028100000_hub.sql', import.meta.url), 'utf8');
  for (const s of STAMPS) assert.ok(sql.includes(`'${s.key}'`), `${s.key} is never awarded`);
});

test('stamp texts match the brief word for word', () => {
  const by = Object.fromEntries(STAMPS.map((s) => [s.name, s.text]));
  assert.equal(by['Takeoff'], 'Welcome to Creator Takeoff Academy');
  assert.equal(by['Frequent Flyer'], '10+ posts 3 months in a row');
  assert.equal(by['Economy Plus'], '+100 followers in one month');
  assert.equal(by['Pioneer'], '50K followers');
  assert.equal(by['Wonder of the World'], '1M views on one post');
  assert.equal(by['First Captain'], '#1 on any leaderboard');
});

test('reward steps from the brief', () => {
  assert.deepEqual(REWARD_STEPS, [10, 15, 30, 35, 50, 55, 70, 75, 90, 95, 100]);
});

test('machine-readable lines in the client\'s format: 44 characters, accents folded', () => {
  const [a, b] = mrz('Julian Bös', '2026-02-01', 11);
  assert.equal(a, 'P<CRT<<JULIAN<BOS' + '<'.repeat(27));
  assert.equal(b, '11<22<<FEB2026<<CREATOR<TAKEOFF<ACADEMY' + '<'.repeat(5));
  assert.equal(a.length, 44);
  assert.equal(b.length, 44);
});

test('visa pages hold five stamps each, and a passport is never empty', () => {
  assert.deepEqual(visaPages([1, 2, 3, 4, 5, 6, 7]), [[1, 2, 3, 4, 5], [6, 7]]);
  assert.deepEqual(visaPages([]), [[]]);
});

test('stamp placement is stable per member and tilted at most 17 degrees', () => {
  const a = placement('julian_boes_', 'takeoff', 0);
  assert.deepEqual(a, placement('julian_boes_', 'takeoff', 0));
  for (let i = 0; i < 50; i++) assert.ok(Math.abs(placement(`h${i}`, 'nomad', i).tilt) <= 17);
});

test('passport order: Takeoff first, oldest first, same-moment stamps in collect order', () => {
  const at = '2026-11-10T00:30:00Z', later = '2026-11-11T00:30:00Z';
  const got = passportOrder([
    { stamp: 'co_pilot', earned_at: later },
    { stamp: 'legend', earned_at: at }, { stamp: 'globetrotter', earned_at: at },
    { stamp: 'wanderer', earned_at: at }, { stamp: 'explorer', earned_at: at },
    { stamp: 'takeoff', earned_at: '2026-11-10T00:00:00Z' },
  ]).map((x) => x.stamp);
  assert.deepEqual(got, ['takeoff', 'wanderer', 'explorer', 'globetrotter', 'legend', 'co_pilot']);
});
