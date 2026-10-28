import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mrz, REWARD_STEPS, STAMPS } from '../src/lib/stamps.ts';

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
  assert.equal(by['Economy Premium'], '+100 followers in one month');
  assert.equal(by['Wonder of the World'], '1M views on one post');
  assert.equal(by['First Captain'], '#1 on any leaderboard');
});

test('reward steps from the brief', () => {
  assert.deepEqual(REWARD_STEPS, [10, 15, 30, 35, 50, 55, 70, 75, 90, 95, 100]);
});

test('machine-readable lines: surname first, 44 characters, accents folded', () => {
  const [a, b] = mrz('Julian Bös', 'julian_boes_', '2026-02-01', 11);
  assert.equal(a, 'P<CRT<BOS<<JULIAN' + '<'.repeat(27));
  assert.equal(a.length, 44);
  assert.equal(b.length, 44);
  assert.ok(b.startsWith('JULIANBOES<<CTA2602<<1122'));
});
