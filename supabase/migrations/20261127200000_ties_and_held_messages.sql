-- Two launch fixes (27 Nov):
-- 1. Ties on the leaderboards no longer hand out the #1 / Top 3 stamps to everyone who shares a place.
-- 2. Reward messages held back for a missing prize link go out once the link is added, for any reward
--    reached since the messages were switched on (no more 3-day cut-off).

alter table settings add column if not exists reward_messages_since timestamptz;

create or replace function stamp_reward_messages_since() returns trigger
language plpgsql as $$
begin
  if new.reward_messages and not coalesce(old.reward_messages, false) then
    new.reward_messages_since := now();
  end if;
  return new;
end $$;

drop trigger if exists settings_reward_messages_since on settings;
create trigger settings_reward_messages_since before update of reward_messages on settings
  for each row execute function stamp_reward_messages_since();

create or replace function award_stamps() returns void
language plpgsql security definer set search_path = public as $$
declare
  -- The dummy clock: tests set cta.today to any day (set local, so it ends with the transaction);
  -- on the live site it is never set and this is just today in IST.
  today date := coalesce(nullif(current_setting('cta.today', true), '')::date, (now() at time zone 'Asia/Kolkata')::date);
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
  -- Ties (the client's question): #1 only when you're alone at the top; Top 3 only when no more than
  -- three people are at or above your number. So on day one, 50 people with one post each get neither.
  perform award(k.student_id, x.key, ist_day(min(k.day)) + interval '6 hours')
  from (
    select rs.student_id, rs.day, rs.value, rs.rank,
           count(*) over (partition by rs.day, rs.board order by rs.value desc
                          range between unbounded preceding and current row) as at_or_above
    from ranking_snapshots rs
    where rs.board in ('follower_growth', 'total_posts')
  ) k join _s on _s.id = k.student_id
  cross join (values ('captain', 3), ('first_captain', 1)) as x(key, n)
  where k.value > 0 and k.rank <= x.n and k.at_or_above <= x.n
  group by k.student_id, x.key;
end $$;
