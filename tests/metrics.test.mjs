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
  for (const fn of ['recompute_metrics()', 'record_views(date, jsonb)', 'freeze_months()', 'daily_rollup()',
    'award_stamps()', 'hub_student(text)']) {
    await db.exec(`alter function ${fn} set search_path = fake, public, pg_catalog;`);
  }
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

test('saving a new scrape time moves the cron job; only daily schedules are allowed', async () => {
  // Stand-in for pg_cron, which PGlite doesn't ship.
  await db.exec(`create schema cron;
    create table cron.job (jobid bigint, jobname text, schedule text);
    insert into cron.job values (1, 'cta-weekly-scrape', '30 0 * * *');
    create function cron.alter_job(job_id bigint, schedule text) returns void language sql as
      $$ update cron.job set schedule = alter_job.schedule where jobid = job_id $$;`);
  await db.exec(`update settings set scrape_cron = '0 2 * * *'`);
  const { rows } = await db.query(`select schedule from cron.job where jobid = 1`);
  assert.equal(rows[0].schedule, '0 2 * * *');
  await assert.rejects(db.exec(`update settings set scrape_cron = '*/5 * * * *'`), /scrape_cron_daily/);
  await assert.rejects(db.exec(`update settings set scrape_cron = '30 0 * * 1'`), /scrape_cron_daily/);
  await db.exec(`update settings set scrape_cron = '30 0 * * *'`);
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
    where proname in ('recompute_metrics', 'refresh_metrics', 'audit', 'sync_scrape_schedule',
      'record_views', 'freeze_months', 'snapshot_rankings', 'daily_rollup', 'award_stamps', 'record_rewards',
      'hub_request_rename')`);
  for (const r of rows) {
    assert.doesNotMatch(r.prosrc, /delete\s+from\s+[\w.]+\s*;/i, `${r.proname} has an unguarded DELETE`);
  }
});

// ───────────── Phase 1: daily data (docs/brief-2026-10.md) ─────────────
async function followers(sid, day, n) {
  await db.query(`insert into follower_snapshots (student_id, day, followers) values ($1, $2, $3)`, [sid, day, n]);
}
const one = async (sql, params) => (await db.query(sql, params)).rows[0];

test('intake month rounds the join date to the nearest kickoff; contract end is only ever entered by hand', async () => {
  const late = await student('K1', 'kick30', 'Kick', '2026-10-30');
  const early = await student('K2', 'kick02', 'Kick', '2026-11-02');
  const mid = await student('K3', 'kick20', 'Kick', '2026-11-20');
  const intake = async (id) => (await one(`select intake_month::text m from students where id = $1`, [id])).m;
  assert.equal(await intake(late), '2026-11-01');
  assert.equal(await intake(early), '2026-11-01');
  assert.equal(await intake(mid), '2026-12-01');
  await db.query(`update students set contract_months = 6 where id = $1`, [early]);
  assert.equal((await one(`select contract_end e from students where id = $1`, [early])).e, null);
  await db.query(`update students set contract_end = '2027-05-01' where id = $1`, [early]);
  assert.equal((await one(`select contract_end::text e from students where id = $1`, [early])).e, '2027-05-01');
});

test('reel views: updated daily, final on day 7, never changed after', async () => {
  const s = await student('V', 'vvv', 'Views', '2026-11-01');
  await db.query(`insert into posts (student_id, shortcode, post_type, posted_at, url)
    values ($1, 'fresh', 'reel', $2, 'u'), ($1, 'aged', 'reel', $3, 'u')`,
    [s, ist('2026-11-22 10:00'), ist('2026-11-15 10:00')]);
  const rec = (d, sc, v) => db.query(`select record_views($1, $2)`,
    [d, JSON.stringify([{ student_id: s, shortcode: sc, views: v }])]);
  await rec('2026-11-23', 'fresh', 100);
  await rec('2026-11-25', 'fresh', 500);
  await rec('2026-11-25', 'aged', 900);
  await rec('2026-11-26', 'aged', 1000);   // already final: ignored
  const p = async (sc) => one(`select views, final_views from posts where shortcode = $1`, [sc]);
  assert.deepEqual(await p('fresh'), { views: 500, final_views: null });
  assert.deepEqual(await p('aged'), { views: 900, final_views: 900 });
  const { rows } = await db.query(`select pv.day::text, pv.views from post_views pv join posts p on p.id = pv.post_id
    where p.shortcode = 'fresh' order by day`);
  assert.deepEqual(rows, [{ day: '2026-11-23', views: 100 }, { day: '2026-11-25', views: 500 }]);
});

test('finished months freeze once (after the 7-day view window) and never change', async () => {
  const s = await student('M', 'mmm', 'Months', '2026-09-01');
  await followers(s, '2026-09-01', 900);
  await followers(s, '2026-09-30', 1000);
  await followers(s, '2026-10-15', 1200);
  await followers(s, '2026-10-31', 1500);
  await post(s, 'sep1', '2026-09-10 10:00');
  await post(s, 'sep2', '2026-09-30 23:00');

  // Running month, up to a day: the same-days comparison uses this
  const partial = await one(`select follower_growth from month_rows('2026-10-01', '2026-10-15') where student_id = $1`, [s]);
  assert.equal(partial.follower_growth, 200);

  await db.exec(`select freeze_months()`);   // now = 25 Nov: Sep and Oct are frozen (Oct on 8 Nov); Nov isn't
  const sep = await one(`select posts, followers_start, followers_end, follower_growth, in_community
    from month_stats where month = '2026-09-01' and student_id = $1`, [s]);
  assert.deepEqual(sep, { posts: 2, followers_start: 900, followers_end: 1000, follower_growth: 100, in_community: true });
  const oct = await one(`select follower_growth from month_stats where month = '2026-10-01' and student_id = $1`, [s]);
  assert.equal(oct.follower_growth, 500);
  assert.equal((await one(`select count(*)::int n from month_stats where month = '2026-11-01'`)).n, 0);

  await post(s, 'sep3', '2026-09-15 10:00');   // a late change to a frozen month
  await db.exec(`select freeze_months()`);
  assert.equal((await one(`select posts from month_stats where month = '2026-09-01' and student_id = $1`, [s])).posts, 2);
  assert.ok((await one(`select joined_count from community_months where month = '2026-09-01'`)).joined_count >= 1);
});

test('daily snapshots: follower growth, posts with tie order, viral last 7 days', async () => {
  const a = await student('RA', 'rank_a', 'Rank', '2026-10-01');
  const b = await student('RB', 'rank_b', 'Rank', '2026-10-01');
  await followers(a, '2026-11-01', 100); await followers(a, '2026-11-25', 300);
  await followers(b, '2026-11-01', 100); await followers(b, '2026-11-25', 150);
  for (const [i, d] of ['03', '06', '10'].entries()) await post(a, `ra${i}`, `2026-11-${d} 10:00`);
  for (const [i, d] of ['04', '08', '12'].entries()) await post(b, `rb${i}`, `2026-11-${d} 10:00`);
  await db.query(`insert into posts (student_id, shortcode, post_type, posted_at, url, views)
    values ($1, 'viral1', 'reel', $2, 'u', 5000)`, [a, ist('2026-11-22 10:00')]);

  await db.exec(`select snapshot_rankings('2026-11-25')`);
  const board = async (name, id) => one(`select rank, value from ranking_snapshots
    where day = '2026-11-25' and board = $1 and student_id = $2 order by rank limit 1`, [name, id]);
  assert.ok((await board('follower_growth', a)).rank < (await board('follower_growth', b)).rank);
  assert.equal((await board('follower_growth', a)).value, 200);

  const pa = await board('total_posts', a), pb = await board('total_posts', b);
  assert.equal(pa.value, 4); assert.equal(pb.value, 3);   // a also has the reel

  const v = await one(`select rank, value from ranking_snapshots where day = '2026-11-25' and board = 'viral' and item =
    (select id::text from posts where shortcode = 'viral1')`);
  assert.deepEqual(v, { rank: 1, value: 5000 });
});

test('daily rollup marks a post on two students\' grids as a collab', async () => {
  await db.exec(`select daily_rollup()`);
  const { rows } = await db.query(`select is_collab from posts where shortcode = 'collab1'`);
  assert.deepEqual(rows.map((r) => r.is_collab), [true, true]);
});

// ───────────── Phase 3: Hub, stamps, rewards ─────────────
const stampsOf = async (sid) => (await db.query(
  `select stamp, earned_month::text m from stamps where student_id = $1 order by stamp`, [sid])).rows;

test('rewards are recorded at the post that reaches each step, once, and survive corrections', async () => {
  const s = await student('RW', 'reward_kid', 'Hub', '2026-11-01');
  for (let i = 1; i <= 16; i++) await post(s, `rw${i}`, `2026-11-${String(i).padStart(2, '0')} 09:00`);
  await db.exec(`select record_rewards()`);
  await db.exec(`select record_rewards()`);
  const { rows } = await db.query(`select step, (reached_at at time zone 'Asia/Kolkata')::date::text d
    from rewards where student_id = $1 order by step`, [s]);
  assert.deepEqual(rows, [{ step: 10, d: '2026-11-10' }, { step: 15, d: '2026-11-15' }]);
  await db.query(`update posts set excluded = true where shortcode in ('rw1', 'rw2')`);
  await db.exec(`select record_rewards()`);
  assert.equal((await one(`select count(*)::int n from rewards where student_id = $1`, [s])).n, 2);
});

test('stamps: each family is earned once with its month, and never taken away', async () => {
  const s = await student('Stamp Star', 'stamp_star', 'Hub', '2026-05-01');
  await followers(s, '2026-11-01', 1000);
  await followers(s, '2026-11-20', 1250);
  for (let i = 1; i <= 15; i++) await post(s, `ss${i}`, `2026-11-${String(i).padStart(2, '0')} 10:00`);
  await db.query(`update posts set is_collab = true where shortcode = 'ss3'`);
  await db.query(`update posts set final_views = 12000, views_final_at = $1 where shortcode = 'ss2'`, [ist('2026-11-09 10:00')]);
  await db.query(`insert into ranking_snapshots (day, board, item, rank, student_id, value)
    values ('2026-11-18', 'total_posts', $1, 1, $2, 14)`, [s, s]);
  await db.exec(`select award_stamps()`);
  assert.deepEqual(await stampsOf(s), [
    { stamp: 'boarding_pass', m: '2026-11-01' },
    { stamp: 'captain', m: '2026-11-01' },
    { stamp: 'co_pilot', m: '2026-11-01' },
    { stamp: 'economy_premium', m: '2026-11-01' },
    { stamp: 'first_captain', m: '2026-11-01' },
    { stamp: 'hidden_gem', m: '2026-11-01' },
    { stamp: 'jet_setter', m: '2026-11-01' },
    { stamp: 'silver_wings', m: '2026-11-01' },
    { stamp: 'takeoff', m: '2026-05-01' },
    { stamp: 'wanderer', m: '2026-11-01' },
  ]);
  // Followers drop and posts get excluded: stamps stay
  await db.query(`update follower_snapshots set followers = 500 where student_id = $1`, [s]);
  await db.query(`update posts set excluded = true where student_id = $1`, [s]);
  await db.exec(`select award_stamps()`);
  assert.equal((await stampsOf(s)).length, 10);
});

test('frequent flyer needs 10+ posts in three consecutive months', async () => {
  const s = await student('FF', 'freq_flyer', 'Hub', '2026-08-01');
  for (const [m, n] of [['08', 10], ['09', 12], ['10', 9], ['11', 10]]) {
    for (let i = 1; i <= n; i++) await post(s, `ff${m}${i}`, `2026-${m}-${String(i).padStart(2, '0')} 10:00`);
  }
  await db.exec(`select award_stamps()`);
  assert.ok(!(await stampsOf(s)).some((x) => x.stamp === 'frequent_flyer'));
  for (let i = 10; i <= 11; i++) await post(s, `ff10x${i}`, `2026-10-${i} 12:00`);
  await db.exec(`select award_stamps()`);
  assert.deepEqual((await stampsOf(s)).find((x) => x.stamp === 'frequent_flyer'), { stamp: 'frequent_flyer', m: '2026-10-01' });
});

test('hub lookup: exact current or old handle only; students who left are hidden', async () => {
  const s = await student('Look', 'look_up', 'Hub', '2026-10-01');
  await db.query(`insert into handle_history (student_id, old_handle, new_handle, detected_by)
    values ($1, 'old_look', 'look_up', 'team')`, [s]);
  const find = async (h) => (await one(`select hub_lookup($1) h`, [h])).h;
  assert.equal(await find('@Look_Up'), 'look_up');
  assert.equal(await find('old_look'), 'look_up');
  assert.equal(await find('look'), null);
  const hub = (await one(`select hub_student('old_look') j`)).j;
  assert.equal(hub.handle, 'look_up');
  assert.equal(hub.name, 'Look');
  await db.query(`update students set status = 'left' where id = $1`, [s]);
  assert.equal(await find('look_up'), null);
});

test('hub boards: growth top 3 with rank change, viral NEW tag, ties with +N', async () => {
  const ids = [];
  for (const h of ['bd_a', 'bd_b', 'bd_c', 'bd_d', 'bd_e', 'bd_f', 'bd_g']) ids.push(await student(h, h, 'Board', '2026-10-01'));
  await db.exec(`delete from ranking_snapshots where true`);
  const snap = (day, board, i, rank, value, reached, post_id = null) => db.query(
    `insert into ranking_snapshots (day, board, item, rank, student_id, post_id, value, reached_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [day, board, post_id ? String(post_id) : ids[i], rank, ids[i], post_id, value, reached]);
  // yesterday: a #1, b #2; today: b #1, a #2, c #3
  await snap('2026-11-24', 'follower_growth', 0, 1, 500); await snap('2026-11-24', 'follower_growth', 1, 2, 400);
  await snap('2026-11-25', 'follower_growth', 1, 1, 900); await snap('2026-11-25', 'follower_growth', 0, 2, 600);
  await snap('2026-11-25', 'follower_growth', 2, 3, 100);
  // posts: a 20, then b..g tied on 15 (b reached first)
  await snap('2026-11-25', 'total_posts', 0, 1, 20, ist('2026-11-20 10:00'));
  for (let i = 1; i <= 6; i++) await snap('2026-11-25', 'total_posts', i, 2, 15, ist(`2026-11-2${i} 0${i}:00`));
  const { rows: [vp] } = await db.query(`insert into posts (student_id, shortcode, post_type, posted_at, url)
    values ($1, 'bd_viral', 'reel', $2, 'https://www.instagram.com/p/bd_viral/') returning id`, [ids[3], ist('2026-11-23 10:00')]);
  await snap('2026-11-25', 'viral', 3, 1, 50000, ist('2026-11-23 10:00'), vp.id);

  const b = (await one(`select hub_boards() j`)).j;
  assert.equal(b.day, '2026-11-25');
  assert.deepEqual(b.follower_growth.map((g) => [g.ig_handle, g.rank, g.prev_rank]),
    [['bd_b', 1, 2], ['bd_a', 2, 1], ['bd_c', 3, null]]);
  assert.deepEqual(b.total_posts.map((t) => [t.ig_handle, t.rank]),
    [['bd_a', 1], ['bd_b', 2], ['bd_c', 2], ['bd_d', 2], ['bd_e', 2]]);
  assert.deepEqual(b.total_posts_tied, ['bd_f', 'bd_g']);
  assert.deepEqual(b.viral.map((v) => [v.ig_handle, v.is_new, v.url]), [['bd_d', true, 'https://www.instagram.com/p/bd_viral/']]);
});

test('handle change requests: validated, matched to the student, one at a time', async () => {
  await student('Ren', 'ren_old', 'Hub', '2026-10-01');
  const req = async (a, b) => (await one(`select hub_request_rename($1, $2) j`, [a, b])).j;
  assert.match((await req('ren_old', 'bad handle!')).error, /Instagram handle/);
  assert.match((await req('nobody_here', 'ren_new')).error, /couldn’t find/);
  const first = await req('@ren_old', '@Ren_New');
  assert.equal(first.status, 'checking');
  assert.equal((await req('ren_old', 'ren_new2')).id, first.id);
  const r = await one(`select old_handle, new_handle from rename_requests where id = $1`, [first.id]);
  assert.deepEqual(r, { old_handle: 'ren_old', new_handle: 'ren_new' });
});

test('views stamps count only Reels posted after joining', async () => {
  const s = await student('VJ', 'views_join', 'Hub', '2026-11-10');
  await db.query(`insert into posts (student_id, shortcode, post_type, posted_at, url, final_views, views_final_at)
    values ($1, 'old_hit', 'reel', $2, 'u', 500000, $3)`, [s, ist('2026-11-01 10:00'), ist('2026-11-08 10:00')]);
  await db.exec(`select award_stamps()`);
  assert.ok(!(await stampsOf(s)).some((x) => ['hidden_gem', 'landmark'].includes(x.stamp)));
  await db.query(`insert into posts (student_id, shortcode, post_type, posted_at, url, final_views, views_final_at)
    values ($1, 'new_hit', 'reel', $2, 'u', 20000, $3)`, [s, ist('2026-11-11 10:00'), ist('2026-11-18 10:00')]);
  await db.exec(`select award_stamps()`);
  const got = (await stampsOf(s)).map((x) => x.stamp);
  assert.ok(got.includes('hidden_gem') && !got.includes('landmark'));
});
