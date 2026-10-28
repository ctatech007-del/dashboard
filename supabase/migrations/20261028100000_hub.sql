-- Phase 3 (docs/brief-2026-10.md): the public CTA Student Hub.
-- Passport stamps and 100 Post rewards are awarded once and stored with when they were earned;
-- they're never recalculated or removed. The Hub (no login) reads only through the hub_*
-- functions below, which return one student by exact handle or the public leaderboards.

-- ───────────────────────── stamps ─────────────────────────
create table stamps (
  student_id   uuid not null references students(id),
  stamp        text not null,       -- key, e.g. 'wanderer'; names and texts live in src/lib/stamps.ts
  earned_at    timestamptz not null,
  earned_month date not null,       -- IST month it was earned in, shown on the stamp
  awarded_at   timestamptz not null default now(),
  primary key (student_id, stamp)
);

create or replace function award(sid uuid, key text, at timestamptz) returns void
language sql security definer set search_path = public as $$
  insert into stamps (student_id, stamp, earned_at, earned_month)
  values (sid, key, at, date_trunc('month', at at time zone 'Asia/Kolkata')::date)
  on conflict do nothing;
$$;

-- IST midnight of a date, as a timestamp
create or replace function ist_day(d date) returns timestamptz
language sql immutable set search_path = '' as $$ select (d::timestamp at time zone 'Asia/Kolkata') $$;

create or replace function award_stamps() returns void
language plpgsql security definer set search_path = public as $$
declare
  today date := (now() at time zone 'Asia/Kolkata')::date;
  r record;
begin
  -- Only students still in the academy earn new stamps; old ones stay.
  create temp table if not exists _s on commit drop as
    select id, start_date from students where status = 'active';
  truncate _s;
  insert into _s select id, start_date from students where status = 'active';

  -- Academy
  for r in select id, start_date from _s loop
    perform award(r.id, 'takeoff', ist_day(r.start_date));
    if (r.start_date + interval '6 months')::date <= today then
      perform award(r.id, 'silver_wings', ist_day((r.start_date + interval '6 months')::date));
    end if;
    if (r.start_date + interval '1 year')::date <= today then
      perform award(r.id, 'golden_wings', ist_day((r.start_date + interval '1 year')::date));
    end if;
  end loop;

  -- Posts since joining: first post, 100th post, first collab
  for r in
    select p.student_id, p.posted_at, p.is_collab,
           row_number() over (partition by p.student_id order by p.posted_at, p.id) as n
    from counted_posts p join _s on _s.id = p.student_id
    where (p.posted_at at time zone 'Asia/Kolkata')::date >= _s.start_date
  loop
    if r.n = 1 then perform award(r.student_id, 'boarding_pass', r.posted_at); end if;
    if r.n = 100 then perform award(r.student_id, 'around_the_world', r.posted_at); end if;
  end loop;
  perform award(x.student_id, 'co_pilot', x.at) from (
    select p.student_id, min(p.posted_at) as at
    from counted_posts p join _s on _s.id = p.student_id
    where p.is_collab and (p.posted_at at time zone 'Asia/Kolkata')::date >= _s.start_date
    group by 1) x;

  -- Posts per IST calendar month: 15 in a month; 10+ three months in a row
  create temp table if not exists _m on commit drop as
    select null::uuid sid, null::date m, 0 n, null::timestamptz at10, null::timestamptz at15 limit 0;
  truncate _m;
  insert into _m
  select student_id, m, count(*)::int,
         max(posted_at) filter (where k = 10), max(posted_at) filter (where k = 15)
  from (
    select p.student_id, p.posted_at,
           date_trunc('month', p.posted_at at time zone 'Asia/Kolkata')::date as m,
           row_number() over (partition by p.student_id, date_trunc('month', p.posted_at at time zone 'Asia/Kolkata')
                              order by p.posted_at, p.id) as k
    from counted_posts p join _s on _s.id = p.student_id
    where (p.posted_at at time zone 'Asia/Kolkata')::date >= _s.start_date
  ) q group by student_id, m;
  perform award(sid, 'jet_setter', min(at15)) from _m where at15 is not null group by sid;
  perform award(c.sid, 'frequent_flyer', min(c.at10)) from _m c
    join _m b on b.sid = c.sid and b.m = (c.m - interval '1 month')::date and b.n >= 10
    join _m a on a.sid = c.sid and a.m = (c.m - interval '2 months')::date and a.n >= 10
    where c.n >= 10 group by c.sid;

  -- Followers: first day at or above each line
  perform award(f.student_id, x.key, ist_day(min(f.day)) + interval '6 hours')
  from follower_snapshots f join _s on _s.id = f.student_id
  cross join (values ('wanderer', 1000), ('explorer', 5000), ('nomad', 10000), ('globetrotter', 25000),
                     ('trailblazer', 50000), ('legend', 100000)) as x(key, n)
  where f.followers >= x.n
  group by f.student_id, x.key;

  -- Growth in one month: followers minus the count on the 1st (or the first count that month)
  perform award(g.student_id, x.key, ist_day(min(g.day)) + interval '6 hours')
  from (
    select f.student_id, f.day,
           f.followers - coalesce(
             (select b.followers from follower_snapshots b where b.student_id = f.student_id
               and b.day <= date_trunc('month', f.day)::date order by b.day desc limit 1),
             (select b.followers from follower_snapshots b where b.student_id = f.student_id
               and b.day >= date_trunc('month', f.day)::date order by b.day limit 1)) as growth
    from follower_snapshots f join _s on _s.id = f.student_id
  ) g
  cross join (values ('economy_premium', 100), ('business_class', 1000), ('first_class', 10000)) as x(key, n)
  where g.growth >= x.n
  group by g.student_id, x.key;

  -- Views on one post: final (day-7) counts only
  perform award(p.student_id, x.key, min(p.views_final_at))
  from counted_posts p join _s on _s.id = p.student_id
  cross join (values ('hidden_gem', 10000), ('landmark', 100000), ('wonder_of_the_world', 1000000)) as x(key, n)
  where p.final_views >= x.n and p.views_final_at is not null
  group by p.student_id, x.key;

  -- Leaderboards: any daily standing (which includes each month's final one) on Follower Growth
  -- or Total Posts. A zero isn't a standing: nobody becomes captain of an empty board.
  perform award(k.student_id, x.key, ist_day(min(k.day)) + interval '6 hours')
  from ranking_snapshots k join _s on _s.id = k.student_id
  cross join (values ('captain', 3), ('first_captain', 1)) as x(key, n)
  where k.board in ('follower_growth', 'total_posts') and k.value > 0 and k.rank <= x.n
  group by k.student_id, x.key;
end $$;

-- ───────────────────────── 100 Post rewards ─────────────────────────
-- A reward is due the day a student's post count since joining reaches a step. The team marks
-- it sent (Phase 4 sends it on Heartbeat automatically), so nobody gets one twice or is forgotten.
create table rewards (
  student_id uuid not null references students(id),
  step       int  not null check (step in (10, 15, 30, 35, 50, 55, 70, 75, 90, 95, 100)),
  reached_at timestamptz not null,
  sent_at    timestamptz,
  sent_by    text,
  note       text,
  primary key (student_id, step)
);

create or replace function record_rewards() returns void
language sql security definer set search_path = public as $$
  insert into rewards (student_id, step, reached_at)
  select q.student_id, q.n, q.posted_at
  from (
    select p.student_id, p.posted_at,
           row_number() over (partition by p.student_id order by p.posted_at, p.id) as n
    from counted_posts p join students st on st.id = p.student_id
    where st.status = 'active' and (p.posted_at at time zone 'Asia/Kolkata')::date >= st.start_date
  ) q
  where q.n in (10, 15, 30, 35, 50, 55, 70, 75, 90, 95, 100)
  on conflict do nothing;
$$;

-- ───────────────────────── handle changes from students ─────────────────────────
alter table handle_history drop constraint handle_history_detected_by_check;
alter table handle_history add constraint handle_history_detected_by_check
  check (detected_by in ('scraper', 'team', 'student'));

create table rename_requests (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid references students(id),
  old_handle  text not null,
  new_handle  text not null,
  status      text not null default 'checking'
              check (status in ('checking', 'approved', 'needs_review', 'rejected')),
  detail      text,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by text
);
create index rename_requests_open on rename_requests (status, created_at desc);

-- ───────────────────────── daily rollup now awards too ─────────────────────────
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
  perform record_rewards();
  perform award_stamps();
end $$;

-- ───────────────────────── public read functions (no login) ─────────────────────────
-- Exact handle only (current or a previous one): no partial matches, so students can't browse.
create or replace function hub_lookup(h text) returns text
language sql stable security definer set search_path = public as $$
  select st.ig_handle from students st
  where st.status = 'active'
    and (lower(st.ig_handle) = lower(trim(leading '@' from trim(h)))
         or st.id in (select student_id from handle_history
                      where lower(old_handle) = lower(trim(leading '@' from trim(h)))))
  order by (lower(st.ig_handle) = lower(trim(leading '@' from trim(h)))) desc
  limit 1;
$$;

create or replace function hub_student(h text) returns jsonb
language sql stable security definer set search_path = public as $$
  with st as (
    select * from students where status = 'active' and lower(ig_handle) = lower(hub_lookup(h))
  ),
  p as (
    select cp.posted_at from counted_posts cp join st on st.id = cp.student_id
    where (cp.posted_at at time zone 'Asia/Kolkata')::date >= st.start_date
  )
  select jsonb_build_object(
    'name', st.name,
    'handle', st.ig_handle,
    'member_since', coalesce(st.intake_month, date_trunc('month', st.start_date)::date),
    'total_posts', (select count(*) from p),
    'month_posts', (select count(*) from p where date_trunc('month', posted_at at time zone 'Asia/Kolkata')
                                          = date_trunc('month', now() at time zone 'Asia/Kolkata')),
    'stamps', coalesce((select jsonb_agg(jsonb_build_object('stamp', s.stamp, 'earned_at', s.earned_at,
                                         'earned_month', s.earned_month) order by s.earned_at, s.stamp)
                        from stamps s where s.student_id = st.id), '[]'),
    'rewards', coalesce((select jsonb_agg(jsonb_build_object('step', r.step, 'reached_at', r.reached_at) order by r.step)
                         from rewards r where r.student_id = st.id), '[]'),
    'updated_at', (select max(finished_at) from scrape_runs where status = 'done' and student_ids is null)
  )
  from st;
$$;

-- Leaderboards from the latest daily snapshot, compared with the one before it.
create or replace function hub_boards() returns jsonb
language sql stable security definer set search_path = public as $$
  with d as (select max(day) as d from ranking_snapshots),
  prev as (select max(day) as d from ranking_snapshots, d where day < d.d),
  cur as (
    select k.*, st.ig_handle from ranking_snapshots k, d, students st
    where k.day = d.d and st.id = k.student_id and st.status = 'active'
  ),
  growth as (
    select c.rank, c.ig_handle, c.value,
           (select p.rank from ranking_snapshots p, prev
            where p.day = prev.d and p.board = 'follower_growth' and p.item = c.item) as prev_rank
    from cur c where c.board = 'follower_growth' and c.value > 0
    order by c.rank, c.ig_handle limit 3
  ),
  viral as (
    select c.rank, c.ig_handle, c.value, p.url,
           not exists (select 1 from ranking_snapshots y, prev
                       where y.day = prev.d and y.board = 'viral' and y.item = c.item and y.rank <= 5) as is_new
    from cur c join posts p on p.id = c.post_id
    where c.board = 'viral' order by c.rank, c.reached_at limit 5
  ),
  posts_all as (
    select c.rank, c.ig_handle, c.value, c.reached_at,
           row_number() over (order by c.rank, c.reached_at) as pos
    from cur c where c.board = 'total_posts'
  ),
  fifth as (select rank from posts_all where pos = 5)
  select jsonb_build_object(
    'day', (select d from d),
    'updated_at', (select max(finished_at) from scrape_runs where status = 'done' and student_ids is null),
    'follower_growth', coalesce((select jsonb_agg(to_jsonb(g) order by g.rank, g.ig_handle) from growth g), '[]'),
    'viral', coalesce((select jsonb_agg(to_jsonb(v) order by v.rank) from viral v), '[]'),
    'total_posts', coalesce((select jsonb_agg(jsonb_build_object('rank', rank, 'ig_handle', ig_handle, 'value', value) order by pos)
                             from posts_all where pos <= 5), '[]'),
    -- everyone else tied with 5th place, for the "👥 +N" list
    'total_posts_tied', coalesce((select jsonb_agg(ig_handle order by pos) from posts_all, fifth
                                  where posts_all.pos > 5 and posts_all.rank = fifth.rank), '[]')
  );
$$;

-- A student reports a new handle. Checked against their Instagram account ID by the
-- rename-verify Edge Function; anything that doesn't match goes to the team.
create or replace function hub_request_rename(old_h text, new_h text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  sid uuid;
  cur text;
  clean_new text := lower(trim(leading '@' from trim(new_h)));
  rid uuid;
begin
  if clean_new !~ '^[a-z0-9._]{1,30}$' then
    return jsonb_build_object('error', 'That doesn’t look like an Instagram handle.');
  end if;
  cur := hub_lookup(old_h);
  if cur is null then
    return jsonb_build_object('error', 'We couldn’t find that old handle. Check the spelling, or ask the team.');
  end if;
  if lower(cur) = clean_new then
    return jsonb_build_object('error', 'That’s already your handle here.');
  end if;
  select id into sid from students where lower(ig_handle) = lower(cur) and status = 'active';
  -- One check at a time per student
  select id into rid from rename_requests
  where student_id = sid and status = 'checking' and created_at > now() - interval '1 hour';
  if rid is not null then
    return jsonb_build_object('id', rid, 'status', 'checking');
  end if;
  insert into rename_requests (student_id, old_handle, new_handle)
  values (sid, cur, clean_new) returning id into rid;
  return jsonb_build_object('id', rid, 'status', 'checking');
end $$;

create or replace function hub_rename_status(rid uuid) returns text
language sql stable security definer set search_path = public as $$
  select status from rename_requests where id = rid;
$$;

-- ───────────────────────── access ─────────────────────────
alter table stamps enable row level security;
alter table rewards enable row level security;
alter table rename_requests enable row level security;
create policy team_read on stamps for select to authenticated using (true);
create policy team_read on rewards for select to authenticated using (true);
create policy team_mark_sent on rewards for update to authenticated using (true) with check (true);
revoke update on rewards from authenticated;
grant update (sent_at, sent_by, note) on rewards to authenticated;
create policy team_read on rename_requests for select to authenticated using (true);
create policy team_resolve on rename_requests for update to authenticated using (true) with check (true);

revoke execute on function award(uuid, text, timestamptz), award_stamps(), record_rewards()
  from public, anon, authenticated;
grant execute on function award(uuid, text, timestamptz), award_stamps(), record_rewards() to service_role;
revoke execute on function hub_lookup(text), hub_student(text), hub_boards(),
  hub_request_rename(text, text), hub_rename_status(uuid) from public;
grant execute on function hub_lookup(text), hub_student(text), hub_boards(),
  hub_request_rename(text, text), hub_rename_status(uuid) to anon, authenticated, service_role;

create trigger audit_rewards after update of sent_at on rewards
  for each row when (old.sent_at is distinct from new.sent_at) execute function audit();
