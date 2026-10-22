// Runs the real migration in embedded Postgres and checks the metric rules from CLAUDE.md.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();

// Local time in IST → timestamptz literal
const ist = (s) => `${s}+05:30`;
// Fixed "now" for deterministic weeks: Wed 2026-11-25 12:00 IST (week starts Mon 23 Nov)
const NOW = ist('2026-11-25 12:00');

before(async () => {
  const dir = new URL('../supabase/migrations/', import.meta.url);
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.who (email text);
    create function auth.jwt() returns jsonb language sql as
      $$ select coalesce((select jsonb_build_object('email', email) from auth.who limit 1), '{}') $$;`);
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(new URL(f, dir), 'utf8').replace(/create extension[^;]+;/g, ''));
  }
  // Freeze now() for the metrics function.
  await db.exec(`create schema fake; create function fake.now() returns timestamptz
    language sql as $$ select '${NOW}'::timestamptz $$; set search_path = fake, public, pg_catalog;`);
  await db.exec(`alter function recompute_metrics() set search_path = fake, public, pg_catalog;`);
});

async function student(name, handle, batch, start) {
  await db.query(`insert into batches (name) values ($1) on conflict do nothing`, [batch]);
  const { rows } = await db.query(
    `insert into students (name, ig_handle, batch_id, start_date)
     select $1, $2, id, $4 from batches where name = $3 returning id`,
    [name, handle, batch, start]);
  return rows[0].id;
}
async function post(sid, code, when) {
  await db.query(`insert into posts (student_id, shortcode, post_type, posted_at, url)
    values ($1, $2, 'image', $3, 'u')`, [sid, code, ist(when)]);
}
async function metrics(sid) {
  await db.exec(`select recompute_metrics()`);
  const { rows } = await db.query(`select * from student_metrics where student_id = $1`, [sid]);
  return rows[0];
}

test('posts before start date do not count', async () => {
  const s = await student('A', 'aaa', 'Nov', '2026-11-01');
  await post(s, 'a0', '2026-10-31 23:00');
  await post(s, 'a1', '2026-11-01 00:30');
  const m = await metrics(s);
  assert.equal(m.total_posts, 1);
});

test('streak counts consecutive weeks; running week does not break it', async () => {
  // Weeks (Mon start): 2 Nov, 9 Nov, 16 Nov posted; current week 23 Nov empty so far
  const s = await student('B', 'bbb', 'Nov', '2026-11-01');
  await post(s, 'b1', '2026-11-03 10:00');
  await post(s, 'b2', '2026-11-10 10:00');
  await post(s, 'b3', '2026-11-17 10:00');
  const m = await metrics(s);
  assert.equal(m.current_streak, 3);
  assert.equal(m.longest_streak, 3);
  assert.equal(m.posts_this_week, 0);
});

test('a missed full week resets the current streak but keeps the best', async () => {
  const s = await student('C', 'ccc', 'Nov', '2026-11-01');
  await post(s, 'c1', '2026-11-03 10:00');
  await post(s, 'c2', '2026-11-10 10:00');
  // nothing in week of 16 Nov
  await post(s, 'c3', '2026-11-24 10:00'); // current week
  const m = await metrics(s);
  assert.equal(m.current_streak, 1);
  assert.equal(m.longest_streak, 2);
  assert.equal(m.posts_this_week, 1);
});

test('IST week boundary: Sunday 23:30 IST belongs to the earlier week', async () => {
  const s = await student('D', 'ddd', 'Nov', '2026-11-01');
  await post(s, 'd1', '2026-11-22 23:30'); // Sunday IST = Sunday 18:00 UTC
  const { rows } = await db.query(`select week_start::text from weekly_stats where student_id = $1`, [s]);
  await metrics(s);
  const { rows: after } = await db.query(`select week_start::text w from weekly_stats where student_id = $1`, [s]);
  assert.deepEqual(after.map((r) => r.w), ['2026-11-16']);
  assert.ok(rows);
});

test('milestones are recorded once with the crossing post date, and persist', async () => {
  const s = await student('E', 'eee', 'Nov', '2026-11-01');
  for (let i = 1; i <= 12; i++) await post(s, `e${i}`, `2026-11-${String(i + 1).padStart(2, '0')} 09:00`);
  let m = await metrics(s);
  assert.equal(m.last_milestone, 10);
  const { rows } = await db.query(`select milestone, reached_at from milestones_hit where student_id = $1`, [s]);
  assert.equal(rows.length, 1);
  assert.equal(new Date(rows[0].reached_at).toISOString(), new Date(ist('2026-11-11 09:00')).toISOString());
  // a deleted post drops the total below 10, the milestone stays
  await db.query(`delete from posts where shortcode in ('e11','e12','e10')`);
  m = await metrics(s);
  assert.equal(m.total_posts, 9);
  assert.equal(m.last_milestone, 10);
});

test('batch rank: only within batch, ties share a rank', async () => {
  const x = await student('X', 'xxx', 'Dec', '2026-11-01');
  const y = await student('Y', 'yyy', 'Dec', '2026-11-01');
  const z = await student('Z', 'zzz', 'Dec', '2026-11-01');
  await post(x, 'x1', '2026-11-05 10:00'); await post(x, 'x2', '2026-11-06 10:00');
  await post(y, 'y1', '2026-11-05 10:00'); await post(y, 'y2', '2026-11-06 10:00');
  await post(z, 'z1', '2026-11-05 10:00');
  await metrics(x);
  const { rows } = await db.query(
    `select name, batch_rank from leaderboard where batch_name = 'Dec' order by name`);
  assert.deepEqual(rows.map((r) => [r.name, r.batch_rank]), [['X', 1], ['Y', 1], ['Z', 3]]);
});

test('flags: a failed scrape shows up with days without data', async () => {
  const s = await student('F', 'fff', 'Nov', '2026-11-01');
  const { rows: [r1] } = await db.query(`insert into scrape_runs (trigger) values ('manual') returning id`);
  await db.query(`insert into scrape_results (run_id, student_id, outcome, created_at)
    values ($1, $2, 'ok', pg_catalog.now() - interval '9 days')`, [r1.id, s]);
  const { rows: [r2] } = await db.query(`insert into scrape_runs (trigger) values ('manual') returning id`);
  await db.query(`insert into scrape_results (run_id, student_id, outcome, detail, created_at)
    values ($1, $2, 'private', 'Account is private', pg_catalog.now() - interval '2 days')`, [r2.id, s]);
  await metrics(s);
  const { rows } = await db.query(`select reason, days_without_data from open_flags where id = $1`, [s]);
  assert.equal(rows[0].reason, 'private');
  assert.ok([9, 10].includes(rows[0].days_without_data)); // IST date rollover
});

test('a collab post can count for two students', async () => {
  const a = await student('G', 'ggg', 'Nov', '2026-11-01');
  const b = await student('H', 'hhh', 'Nov', '2026-11-01');
  await post(a, 'collab1', '2026-11-05 10:00');
  await post(b, 'collab1', '2026-11-05 10:00');
  assert.equal((await metrics(a)).total_posts, 1);
  assert.equal((await metrics(b)).total_posts, 1);
});

test('saving a new scrape time moves the cron job; non-weekly schedules are refused', async () => {
  // Stand-in for pg_cron, which PGlite doesn't ship.
  await db.exec(`create schema cron;
    create table cron.job (jobid bigint, jobname text, schedule text);
    insert into cron.job values (1, 'cta-weekly-scrape', '30 0 * * 1');
    create function cron.alter_job(job_id bigint, schedule text) returns void language sql as
      $$ update cron.job set schedule = alter_job.schedule where jobid = job_id $$;`);
  await db.exec(`update settings set scrape_cron = '30 20 * * 0'`);
  const { rows } = await db.query(`select schedule from cron.job where jobid = 1`);
  assert.equal(rows[0].schedule, '30 20 * * 0');
  await assert.rejects(db.exec(`update settings set scrape_cron = '*/5 * * * *'`), /scrape_cron_weekly/);
});

test('an excluded post stops counting; a manual post counts; both are in the audit log', async () => {
  const s = await student('I', 'iii', 'Dec', '2026-11-01');
  await post(s, 'keep1', '2026-11-03 10:00');
  await post(s, 'drop1', '2026-11-04 10:00');
  assert.equal((await metrics(s)).total_posts, 2);

  await db.exec(`insert into auth.who values ('coach@cta.test')`);
  await db.query(`update posts set excluded = true, excluded_reason = 'story repost' where shortcode = 'drop1'`);
  await db.query(`insert into posts (student_id, shortcode, post_type, posted_at, url, source)
    values ($1, 'missed1', 'reel', $2, 'u', 'manual')`, [s, ist('2026-11-05 10:00')]);
  await db.exec(`delete from auth.who`);

  const m = await metrics(s);
  assert.equal(m.total_posts, 2); // keep1 + missed1
  const { rows: log } = await db.query(
    `select actor, action from audit_log where student_id = $1 order by id`, [s]);
  assert.deepEqual(log.slice(-2), [
    { actor: 'coach@cta.test', action: 'posts.update' },
    { actor: 'coach@cta.test', action: 'posts.insert' },
  ]);
});

test('monthly counts follow IST calendar months and skip excluded posts', async () => {
  const s = await student('J', 'jjj', 'Dec', '2026-10-01');
  await post(s, 'm1', '2026-10-31 23:30'); // still October in IST
  await post(s, 'm2', '2026-11-01 00:30');
  await post(s, 'm3', '2026-11-02 09:00');
  await db.query(`update posts set excluded = true where shortcode = 'm3'`);
  const { rows } = await db.query(
    `select month::text, posts from monthly_stats where student_id = $1 order by month`, [s]);
  assert.deepEqual(rows, [{ month: '2026-10-01', posts: 1 }, { month: '2026-11-01', posts: 1 }]);
});

test('functions called through the Supabase API never DELETE without a WHERE (pg-safeupdate)', async () => {
  const { rows } = await db.query(`select proname, prosrc from pg_proc
    where proname in ('recompute_metrics', 'refresh_metrics', 'audit', 'sync_scrape_schedule')`);
  for (const r of rows) {
    assert.doesNotMatch(r.prosrc, /delete\s+from\s+[\w.]+\s*;/i, `${r.proname} has an unguarded DELETE`);
  }
});
