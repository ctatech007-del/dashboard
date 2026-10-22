import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pace, reasons, type StudentRow } from '../src/lib/attention.ts';

const rules = { goal: 100, quietDays: 14, challengeWeeks: 50 };
const now = new Date('2026-11-25T12:00:00+05:30');
const base: StudentRow = {
  start_date: '2026-09-02', total_posts: 24, current_streak: 3, longest_streak: 3,
  last_post_at: '2026-11-24T10:00:00+05:30', last_outcome: 'ok',
};

test('on track: no reasons', () => {
  assert.deepEqual(reasons(base, rules, now), []);
});

test('scrape problems and never-scraped students are data problems', () => {
  assert.deepEqual(reasons({ ...base, last_outcome: 'private' }, rules, now), ['data']);
  assert.deepEqual(reasons({ ...base, last_outcome: null }, rules, now), ['data']);
});

test('quiet after the threshold, but not in a brand-new student\'s first days', () => {
  assert.ok(reasons({ ...base, last_post_at: '2026-11-10T10:00:00+05:30' }, rules, now).includes('quiet'));
  assert.ok(!reasons({ ...base, last_post_at: '2026-11-12T10:00:00+05:30' }, rules, now).includes('quiet'));
  const fresh = { ...base, start_date: '2026-11-20', total_posts: 0, last_post_at: null,
    current_streak: 0, longest_streak: 0 };
  assert.deepEqual(reasons(fresh, rules, now), []);
});

test('lost streak only after a real one (2+ weeks)', () => {
  assert.ok(reasons({ ...base, current_streak: 0, longest_streak: 2 }, rules, now).includes('streak_lost'));
  assert.ok(!reasons({ ...base, current_streak: 0, longest_streak: 1 }, rules, now).includes('streak_lost'));
});

test('behind pace: under 80% of the posts needed by now', () => {
  // 12 weeks in, 50-week challenge → needs 24 by now; 19 is under 80% (19.2)
  assert.ok(reasons({ ...base, total_posts: 19 }, rules, now).includes('behind'));
  assert.ok(!reasons({ ...base, total_posts: 20 }, rules, now).includes('behind'));
  assert.ok(!reasons({ ...base, total_posts: 100 }, rules, now).includes('behind'));
});

test('pace projects a finish date from posts per week so far', () => {
  const p = pace(base, rules, now);
  assert.equal(Math.round(p.weeks), 12);
  assert.ok(p.finish && p.finish > now);
  assert.equal(pace({ ...base, total_posts: 100 }, rules, now).finish, null);
});
