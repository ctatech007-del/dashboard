-- Phase 1 of the October 2026 brief (docs/brief-2026-10.md): daily data foundation.
-- Daily scrape, follower counts per day, reel views for 7 days, collabs, student master data,
-- a daily snapshot of every leaderboard, and months that freeze once they're over.

-- ───────────────────────── student master data ─────────────────────────
alter type student_status add value if not exists 'left';   -- left the academy: not scraped, history kept

alter table students
  add column heartbeat_url   text,
  add column leave_date      date,
  add column contract_months int check (contract_months > 0),
  add column contract_end    date,
  -- The kickoff a student belongs to. Kickoffs fall on a weekend around the 1st (the 30th, 2nd,
  -- 3rd…), so the default rounds the join date to the nearest month start; the team can override.
  add column intake_month    date check (intake_month = date_trunc('month', intake_month)::date);
comment on column students.start_date is 'Join date (IST). Posts count from this day.';

create or replace function student_defaults() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.intake_month is null then
    new.intake_month := date_trunc('month', new.start_date + 16)::date;
  end if;
  if new.contract_end is null and new.contract_months is not null then
    new.contract_end := (new.start_date + make_interval(months => new.contract_months))::date;
  end if;
  return new;
end $$;
create trigger students_defaults before insert or update on students
  for each row execute function student_defaults();
update students set intake_month = date_trunc('month', start_date + 16)::date where intake_month is null;

-- ───────────────────────── daily Instagram data ─────────────────────────
create table follower_snapshots (
  student_id  uuid not null references students(id),
  day         date not null,                -- IST date of the scrape
  followers   int  not null,
  following   int,
  posts_count int,
  run_id      uuid references scrape_runs(id) on delete set null,
  captured_at timestamptz not null default now(),
  primary key (student_id, day)
);

-- Reel and video views: checked every day for the first 7 days; the day-7 value is final.
-- Instagram shows no public view count for images or carousels.
alter table posts
  add column views          int,
  add column final_views    int,
  add column views_final_at timestamptz,
  add column is_collab      boolean not null default false;
-- `select *` views are expanded when created, so pick up the new columns.
create or replace view counted_posts with (security_invoker = on) as
select * from posts where not excluded;

create table post_views (
  post_id bigint not null references posts(id),
  day     date   not null,
  views   int    not null,
  primary key (post_id, day)
);

-- Called by scrape-ingest with today's counts. Final counts never change once set.
create or replace function record_views(d date, items jsonb) returns void
language sql security definer set search_path = public as $$
  with i as (
    select (x ->> 'student_id')::uuid as sid, x ->> 'shortcode' as sc, (x ->> 'views')::int as v
    from jsonb_array_elements(items) x
    where x ->> 'views' is not null
  ),
  p as (
    select posts.id, posts.posted_at, i.v
    from posts join i on posts.student_id = i.sid and posts.shortcode = i.sc
    where posts.final_views is null
  ),
  logged as (
    insert into post_views (post_id, day, views) select id, d, v from p
    on conflict (post_id, day) do update set views = excluded.views
  )
  update posts set
    views = p.v,
    final_views    = case when p.posted_at <= now() - interval '7 days' then p.v end,
    views_final_at = case when p.posted_at <= now() - interval '7 days' then now() end
  from p where posts.id = p.id;
$$;

-- ───────────────────────── months ─────────────────────────
-- One row per student for month `m`, counting up to `upto` (the month end, or today for the
-- running month, or the same day of the previous month for a fair comparison).
create or replace function month_rows(m date, upto date) returns table (
  student_id uuid, in_community boolean, posts int, reels int,
  followers_start int, followers_end int, follower_growth int, views_final bigint, best_views int
) language sql stable set search_path = public as $$
  with s as (
    select st.* from students st
    where st.status <> 'removed' and st.start_date <= upto
      and (st.leave_date is null or st.leave_date >= m)
  ),
  p as (
    select cp.student_id,
           count(*)::int as posts,
           count(*) filter (where cp.post_type in ('reel', 'video'))::int as reels,
           coalesce(sum(cp.final_views), 0)::bigint as views_final,
           max(coalesce(cp.final_views, cp.views))::int as best_views
    from counted_posts cp join s on s.id = cp.student_id
    where (cp.posted_at at time zone 'Asia/Kolkata')::date between greatest(m, s.start_date) and upto
    group by 1
  ),
  f as (
    select s.id as student_id,
           -- count on the 1st (or the closest before it); a newcomer's first count in the month
           coalesce(
             (select fs.followers from follower_snapshots fs
              where fs.student_id = s.id and fs.day <= m order by fs.day desc limit 1),
             (select fs.followers from follower_snapshots fs
              where fs.student_id = s.id and fs.day between m and upto order by fs.day limit 1)) as f0,
           (select fs.followers from follower_snapshots fs
            where fs.student_id = s.id and fs.day between m and upto order by fs.day desc limit 1) as f1
    from s
  )
  select s.id,
         -- counts towards averages: their kickoff was this month or earlier, and they didn't
         -- leave in the first half of it
         (s.intake_month <= m and (s.leave_date is null or s.leave_date >= m + 15)),
         coalesce(p.posts, 0), coalesce(p.reels, 0), f.f0, f.f1, f.f1 - f.f0,
         coalesce(p.views_final, 0), p.best_views
  from s left join p on p.student_id = s.id left join f on f.student_id = s.id;
$$;

create table month_stats (
  month           date not null,
  student_id      uuid not null references students(id),
  in_community    boolean not null,
  posts           int  not null,
  reels           int  not null,
  followers_start int,
  followers_end   int,
  follower_growth int,
  views_final     bigint not null,
  best_views      int,
  primary key (month, student_id)
);
create table community_months (
  month         date primary key,
  students      int not null,   -- counted towards averages
  joined_count  int not null,   -- intake this month
  left_count    int not null,   -- leave date this month
  frozen_at     timestamptz not null default now()
);

-- Freeze every finished month once. It waits until the 8th of the next month so the month's last
-- Reels have their day-7 views; followers and posts are still counted up to the month's last day.
create or replace function freeze_months() returns int
language plpgsql security definer set search_path = public as $$
declare
  today date := (now() at time zone 'Asia/Kolkata')::date;
  m date;
  n int := 0;
begin
  select date_trunc('month', min(day))::date into m from follower_snapshots;
  while m is not null and (m + interval '1 month' + interval '7 days')::date <= today loop
    if not exists (select 1 from community_months where month = m) then
      insert into month_stats
      select m, r.* from month_rows(m, (m + interval '1 month' - interval '1 day')::date) r
      on conflict do nothing;
      insert into community_months (month, students, joined_count, left_count)
      values (m,
        (select count(*) from month_stats where month = m and in_community),
        (select count(*) from students where intake_month = m and status <> 'removed'),
        (select count(*) from students where status <> 'removed'
           and leave_date >= m and leave_date < (m + interval '1 month')::date));
      n := n + 1;
    end if;
    m := (m + interval '1 month')::date;
  end loop;
  return n;
end $$;

-- ───────────────────────── daily leaderboard snapshots ─────────────────────────
-- The full ranking of every active student, stored each day: rank changes (▲/▼), the "NEW" tag
-- and the Captain stamps all compare against these.
create table ranking_snapshots (
  day        date   not null,
  board      text   not null check (board in ('follower_growth', 'total_posts', 'viral')),
  item       text   not null,          -- student id, or post id for 'viral'
  rank       int    not null,
  student_id uuid   not null references students(id),
  post_id    bigint references posts(id),
  value      bigint not null,
  reached_at timestamptz,              -- total_posts: when they reached that count (breaks ties)
  primary key (day, board, item)
);
create index ranking_snapshots_student on ranking_snapshots (student_id, day);

create or replace function snapshot_rankings(d date) returns void
language plpgsql security definer set search_path = public as $$
declare m date := date_trunc('month', d)::date;
begin
  delete from ranking_snapshots where day = d;   -- a re-run on the same day replaces that day

  -- Follower growth this month (latest count minus the count on the 1st)
  insert into ranking_snapshots (day, board, item, rank, student_id, value)
  select d, 'follower_growth', r.student_id::text,
         rank() over (order by r.follower_growth desc), r.student_id, r.follower_growth
  from month_rows(m, d) r join students st on st.id = r.student_id
  where st.status = 'active' and r.follower_growth is not null;

  -- Feed posts this month; ties share a rank, and whoever got there first is listed first
  insert into ranking_snapshots (day, board, item, rank, student_id, value, reached_at)
  select d, 'total_posts', c.student_id::text, rank() over (order by c.n desc), c.student_id, c.n, c.reached
  from (
    select cp.student_id, count(*) as n, max(cp.posted_at) as reached
    from counted_posts cp join students st on st.id = cp.student_id
    where st.status = 'active'
      and (cp.posted_at at time zone 'Asia/Kolkata')::date between greatest(m, st.start_date) and d
    group by 1
  ) c;

  -- Most viral: Reels and videos from the last 7 days, by views so far
  insert into ranking_snapshots (day, board, item, rank, student_id, post_id, value, reached_at)
  select d, 'viral', p.id::text, rank() over (order by coalesce(p.final_views, p.views) desc),
         p.student_id, p.id, coalesce(p.final_views, p.views), p.posted_at
  from counted_posts p join students st on st.id = p.student_id
  where st.status = 'active' and p.post_type in ('reel', 'video')
    and coalesce(p.final_views, p.views) is not null
    and (p.posted_at at time zone 'Asia/Kolkata')::date between d - 6 and d;
end $$;

-- Runs at the end of every scrape, after recompute_metrics().
create or replace function daily_rollup() returns void
language plpgsql security definer set search_path = public as $$
begin
  -- A Reel that dropped off the profile before day 7 keeps its last count as final.
  update posts set final_views = views, views_final_at = now()
  where final_views is null and views is not null and posted_at < now() - interval '8 days';
  -- The same post on two students' grids is a collab for both.
  update posts set is_collab = true
  where not is_collab and shortcode in (
    select shortcode from posts group by shortcode having count(distinct student_id) > 1);
  perform snapshot_rankings((now() at time zone 'Asia/Kolkata')::date);
  perform freeze_months();
end $$;

-- ───────────────────────── daily schedule ─────────────────────────
-- Tests run without pg_cron, so the schedule sync skips quietly when it isn't installed.
create or replace function sync_scrape_schedule() returns trigger
language plpgsql security definer set search_path = '' as $$
declare job bigint;
begin
  if to_regclass('cron.job') is null then return new; end if;
  select jobid into job from cron.job where jobname = 'cta-weekly-scrape';
  if job is null then
    raise warning 'cron job cta-weekly-scrape not found; schedule it as in README step 1.6';
  else
    perform cron.alter_job(job, schedule := new.scrape_cron);
  end if;
  return new;
end $$;

alter table settings drop constraint scrape_cron_weekly;
update settings set scrape_cron = '30 0 * * *', updated_at = now()   -- 06:00 IST every day
where id = 1 and scrape_cron ~ '\* \* [0-6]$';
alter table settings alter column scrape_cron set default '30 0 * * *';
alter table settings add constraint scrape_cron_daily
  check (scrape_cron ~ '^[0-5]?[0-9] (1?[0-9]|2[0-3]) \* \* \*$');

-- ───────────────────────── access ─────────────────────────
alter table follower_snapshots enable row level security;
alter table post_views         enable row level security;
alter table month_stats        enable row level security;
alter table community_months   enable row level security;
alter table ranking_snapshots  enable row level security;
do $$
declare t text;
begin
  foreach t in array array['follower_snapshots','post_views','month_stats','community_months','ranking_snapshots'] loop
    execute format('create policy team_read on %I for select to authenticated using (true)', t);
  end loop;
end $$;

revoke execute on function record_views(date, jsonb), freeze_months(), snapshot_rankings(date),
  daily_rollup() from public, anon, authenticated;
grant execute on function record_views(date, jsonb), freeze_months(), snapshot_rankings(date),
  daily_rollup() to service_role;
