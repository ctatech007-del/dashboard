-- Hub rules from the client (docs/feedback-2026-11-10.md):
-- * Follower stamps a member already qualifies for at joining are dated with the join day.
-- * Takeoff is given the moment a student is added, is always the first stamp, and is "Member since".
-- * The NEW tag on Most Viral Posts stays for 48 hours after a post first enters the top 5.

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

  -- Followers: first day at or above each line. Lines a member already had at joining (their first
  -- count, taken within a week of joining) are dated with the join day, right after Takeoff.
  perform award(f.student_id, x.key,
                case when min(f.day) = (select min(b.day) from follower_snapshots b where b.student_id = f.student_id)
                      and min(f.day) <= min(_s.start_date) + 7
                     then ist_day(min(_s.start_date)) else ist_day(min(f.day)) end + interval '6 hours')
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
    and (p.posted_at at time zone 'Asia/Kolkata')::date >= _s.start_date   -- Reels from the academy period
  group by p.student_id, x.key;

  -- Leaderboards: any daily standing (which includes each month's final one) on Follower Growth
  -- or Total Posts. A zero isn't a standing: nobody becomes captain of an empty board.
  perform award(k.student_id, x.key, ist_day(min(k.day)) + interval '6 hours')
  from ranking_snapshots k join _s on _s.id = k.student_id
  cross join (values ('captain', 3), ('first_captain', 1)) as x(key, n)
  where k.board in ('follower_growth', 'total_posts') and k.value > 0 and k.rank <= x.n
  group by k.student_id, x.key;
end $$;

create or replace function award_takeoff() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform award(new.id, 'takeoff', ist_day(new.start_date));
  return new;
end $$;

create trigger students_takeoff after insert on students
  for each row execute function award_takeoff();

create or replace function hub_student(h text) returns jsonb
language sql stable security definer set search_path = public as $$
  with st as (
    select * from students where status = 'active' and lower(ig_handle) = lower(hub_lookup(h))
  ),
  p as (
    select cp.posted_at from counted_posts cp join st on st.id = cp.student_id
    where (cp.posted_at at time zone 'Asia/Kolkata')::date >= st.start_date
  ),
  board as (
    select k.student_id, k.rank from ranking_snapshots k
    where k.board = 'total_posts' and k.day = (select max(day) from ranking_snapshots)
  )
  select jsonb_build_object(
    'name', st.name,
    'handle', st.ig_handle,
    -- "Member since" is the date of the Takeoff stamp
    'member_since', coalesce((select (s.earned_at at time zone 'Asia/Kolkata')::date from stamps s
                              where s.student_id = st.id and s.stamp = 'takeoff'), st.start_date),
    'total_posts', (select count(*) from p),
    'month_posts', (select count(*) from p where date_trunc('month', posted_at at time zone 'Asia/Kolkata')
                                          = date_trunc('month', now() at time zone 'Asia/Kolkata')),
    'month_rank', (select rank from board where student_id = st.id),
    'players', (select count(*) from board),
    'stamps', coalesce((select jsonb_agg(jsonb_build_object('stamp', s.stamp, 'earned_at', s.earned_at,
                                         'earned_month', s.earned_month)
                                         order by s.stamp <> 'takeoff', s.earned_at, s.stamp)
                        from stamps s where s.student_id = st.id), '[]'),
    'rewards', coalesce((select jsonb_agg(jsonb_build_object('step', r.step, 'reached_at', r.reached_at) order by r.step)
                         from rewards r where r.student_id = st.id), '[]'),
    'updated_at', (select max(finished_at) from scrape_runs where status = 'done' and student_ids is null)
  )
  from st;
$$;

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
           -- NEW for 48 hours: first in the top 5 on today's or yesterday's update
           (select min(y.day) from ranking_snapshots y
             where y.board = 'viral' and y.item = c.item and y.rank <= 5) >= d.d - 1 as is_new
    from cur c join posts p on p.id = c.post_id, d
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
