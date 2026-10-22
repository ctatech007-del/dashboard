-- CTA Post Tracker — Phase 1 schema
-- All week/date boundaries use Asia/Kolkata.

create extension if not exists pgcrypto;
create extension if not exists pg_cron;   -- scheduler
create extension if not exists pg_net;

-- ───────────────────────── settings (single row) ─────────────────────────
create table settings (
  id               int primary key default 1 check (id = 1),
  streak_threshold int    not null default 1 check (streak_threshold >= 1),
  milestones       int[]  not null default '{10,25,50,75,100}',
  scrape_cron      text   not null default '30 0 * * 1',  -- Mon 06:00 IST (00:30 UTC)
  sheet_id         text,                                    -- Google Sheet to sync into
  updated_at       timestamptz not null default now()
);
insert into settings default values;

-- ───────────────────────── roster ─────────────────────────
create table batches (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,          -- e.g. "Nov 2026"
  start_date date,
  created_at timestamptz not null default now()
);

create type student_status as enum ('active', 'paused', 'removed');

create table students (
  id           uuid primary key default gen_random_uuid(),  -- fixed internal ID
  name         text not null,
  ig_handle    text not null,                                -- current handle, no '@'
  ig_user_id   text unique,                                  -- Instagram numeric ID, survives renames
  batch_id     uuid not null references batches(id),
  start_date   date not null,
  status       student_status not null default 'active',
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index students_handle_live on students (lower(ig_handle)) where status <> 'removed';
create index students_batch on students (batch_id);

create table handle_history (
  id          bigserial primary key,
  student_id  uuid not null references students(id),
  old_handle  text not null,
  new_handle  text not null,
  detected_by text not null check (detected_by in ('scraper', 'team')),
  changed_at  timestamptz not null default now()
);

-- ───────────────────────── scraping ─────────────────────────
create type run_status as enum ('running', 'ingesting', 'done', 'failed');

create table scrape_runs (
  id             uuid primary key default gen_random_uuid(),
  trigger        text not null check (trigger in ('schedule', 'manual')),
  status         run_status not null default 'running',
  apify_run_id   text,
  started_at     timestamptz not null default now(),
  finished_at    timestamptz,
  profiles_total int,
  profiles_ok    int,
  error          text
);

create type scrape_outcome as enum ('ok', 'private', 'not_found', 'error');

create table scrape_results (
  id          bigserial primary key,
  run_id      uuid not null references scrape_runs(id) on delete cascade,
  student_id  uuid not null references students(id),
  outcome     scrape_outcome not null,
  detail      text,
  new_posts   int not null default 0,
  created_at  timestamptz not null default now(),
  unique (run_id, student_id)
);
create index scrape_results_student on scrape_results (student_id, created_at desc);

create type post_type as enum ('image', 'carousel', 'reel', 'video');

create table posts (
  id          bigserial primary key,
  student_id  uuid not null references students(id),
  shortcode   text not null,
  post_type   post_type not null,
  posted_at   timestamptz not null,
  url         text not null,
  first_seen  uuid references scrape_runs(id),
  raw         jsonb,                       -- full scraper item, kept for future phases
  created_at  timestamptz not null default now(),
  unique (student_id, shortcode)           -- a collab on two students' grids counts for both
);
create index posts_student_time on posts (student_id, posted_at);

-- ───────────────────────── metrics ─────────────────────────
-- Week = Monday-start week in IST.
create or replace function ist_week_start(ts timestamptz) returns date
language sql immutable as $$
  select date_trunc('week', (ts at time zone 'Asia/Kolkata'))::date
$$;

create table weekly_stats (
  student_id  uuid not null references students(id),
  week_start  date not null,
  posts       int  not null,
  primary key (student_id, week_start)
);

create table student_metrics (
  student_id        uuid primary key references students(id),
  total_posts       int  not null default 0,
  posts_this_week   int  not null default 0,
  current_streak    int  not null default 0,
  longest_streak    int  not null default 0,
  last_milestone    int,
  batch_rank        int,
  last_post_at      timestamptz,
  last_ok_scrape_at timestamptz,
  last_outcome      scrape_outcome,
  updated_at        timestamptz not null default now()
);

create table milestones_hit (
  student_id  uuid not null references students(id),
  milestone   int  not null,
  reached_at  timestamptz not null,   -- time of the post that crossed the line
  recorded_at timestamptz not null default now(),
  primary key (student_id, milestone)
);

-- Recompute every metric from posts. Mirrors supabase/functions/_shared/metrics.ts.
create or replace function recompute_metrics() returns void
language plpgsql security definer set search_path = public as $$
declare
  s record;
  cfg settings;
  this_week date := ist_week_start(now());
  w record;
  expected date;
  run int;
  best int;
  cur int;
  counting_current boolean;
begin
  select * into cfg from settings where id = 1;

  -- weekly counts
  delete from weekly_stats;
  insert into weekly_stats (student_id, week_start, posts)
  select p.student_id, ist_week_start(p.posted_at), count(*)
  from posts p join students st on st.id = p.student_id
  where (p.posted_at at time zone 'Asia/Kolkata')::date >= st.start_date
  group by 1, 2;

  for s in select * from students where status <> 'removed' loop
    -- streaks: walk weeks backwards from this week
    cur := 0; best := 0; run := 0; counting_current := true;
    expected := this_week;
    -- the running week only extends a streak, never breaks it
    for w in
      select gs::date as wk, coalesce(ws.posts, 0) as n
      from generate_series(ist_week_start(s.start_date::timestamptz), this_week, interval '7 days') gs
      left join weekly_stats ws on ws.student_id = s.id and ws.week_start = gs::date
      order by gs desc
    loop
      if w.n >= cfg.streak_threshold then
        run := run + 1;
      elsif w.wk = this_week then
        null; -- current week not finished yet
      else
        if counting_current then cur := run; counting_current := false; end if;
        best := greatest(best, run);
        run := 0;
      end if;
    end loop;
    if counting_current then cur := run; end if;
    best := greatest(best, run);

    insert into student_metrics as m (student_id, total_posts, posts_this_week, current_streak,
                                      longest_streak, last_post_at, updated_at)
    select s.id,
           count(*) filter (where (p.posted_at at time zone 'Asia/Kolkata')::date >= s.start_date),
           count(*) filter (where ist_week_start(p.posted_at) = this_week
                              and (p.posted_at at time zone 'Asia/Kolkata')::date >= s.start_date),
           cur, best, max(p.posted_at), now()
    from (select s.id) x left join posts p on p.student_id = s.id
    on conflict (student_id) do update set
      total_posts = excluded.total_posts, posts_this_week = excluded.posts_this_week,
      current_streak = excluded.current_streak, longest_streak = excluded.longest_streak,
      last_post_at = excluded.last_post_at, updated_at = now();

    -- milestones: record the post that crossed each line, once
    insert into milestones_hit (student_id, milestone, reached_at)
    select s.id, ms, (
      select posted_at from (
        select posted_at, row_number() over (order by posted_at, id) rn
        from posts where student_id = s.id
          and (posted_at at time zone 'Asia/Kolkata')::date >= s.start_date
      ) q where rn = ms)
    from unnest(cfg.milestones) ms
    where (select total_posts from student_metrics where student_id = s.id) >= ms
    on conflict do nothing;

    update student_metrics set last_milestone =
      (select max(milestone) from milestones_hit where student_id = s.id)
    where student_id = s.id;

    -- latest scrape outcome + last good scrape
    update student_metrics set
      last_outcome = (select outcome from scrape_results where student_id = s.id
                      order by created_at desc limit 1),
      last_ok_scrape_at = (select max(created_at) from scrape_results
                           where student_id = s.id and outcome = 'ok')
    where student_id = s.id;
  end loop;

  -- batch rank: total posts desc; ties share a rank
  update student_metrics m set batch_rank = r.rnk
  from (
    select st.id, rank() over (partition by st.batch_id order by sm.total_posts desc) rnk
    from students st join student_metrics sm on sm.student_id = st.id
    where st.status = 'active'
  ) r where r.id = m.student_id;
end $$;

-- ───────────────────────── views for the UI ─────────────────────────
create or replace view leaderboard as
select st.id, st.name, st.ig_handle, st.status, st.start_date,
       b.id as batch_id, b.name as batch_name,
       sm.total_posts, sm.posts_this_week, sm.current_streak, sm.longest_streak,
       sm.last_milestone, sm.batch_rank, sm.last_post_at, sm.last_outcome, sm.last_ok_scrape_at
from students st
join batches b on b.id = st.batch_id
left join student_metrics sm on sm.student_id = st.id
where st.status <> 'removed';

-- Flags: latest outcome is not ok, or no successful scrape yet.
create or replace view open_flags as
select st.id, st.name, st.ig_handle, b.name as batch_name,
       coalesce(sm.last_outcome::text, 'never_scraped') as reason,
       (select detail from scrape_results r where r.student_id = st.id
        order by created_at desc limit 1) as detail,
       sm.last_ok_scrape_at,
       case when sm.last_ok_scrape_at is null then null
            else (now()::date - (sm.last_ok_scrape_at at time zone 'Asia/Kolkata')::date) end
         as days_without_data
from students st
join batches b on b.id = st.batch_id
left join student_metrics sm on sm.student_id = st.id
where st.status = 'active'
  and (sm.last_outcome is null or sm.last_outcome <> 'ok');

-- ───────────────────────── security ─────────────────────────
-- Team-only app: any signed-in user is a team member. Sign-ups are disabled in Supabase Auth;
-- the team is invited from the dashboard.
alter table settings        enable row level security;
alter table batches         enable row level security;
alter table students        enable row level security;
alter table handle_history  enable row level security;
alter table scrape_runs     enable row level security;
alter table scrape_results  enable row level security;
alter table posts           enable row level security;
alter table weekly_stats    enable row level security;
alter table student_metrics enable row level security;
alter table milestones_hit  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['settings','batches','students','handle_history','scrape_runs',
    'scrape_results','posts','weekly_stats','student_metrics','milestones_hit'] loop
    execute format('create policy team_read on %I for select to authenticated using (true)', t);
  end loop;
  foreach t in array array['settings','batches','students','handle_history'] loop
    execute format('create policy team_write on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

alter view leaderboard set (security_invoker = on);
alter view open_flags  set (security_invoker = on);
revoke execute on function recompute_metrics() from public, anon, authenticated;
grant execute on function recompute_metrics() to service_role;

-- ───────────────────────── schedule ─────────────────────────
-- The weekly cron job is created after deploy: see README.md, step 1.6.
