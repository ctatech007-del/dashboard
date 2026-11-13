-- Most Viral counted Reels a creator posted before joining (client rule: only posts on or after
-- the join date count). Same fix for the daily snapshot, then the stored history is cleaned and
-- re-ranked so the NEW tag and rank changes stay right. Stamps are untouched (Captain ignores
-- Most Viral; views stamps already used the join date).

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

  -- Most viral: Reels and videos from the last 7 days since joining, by views so far
  insert into ranking_snapshots (day, board, item, rank, student_id, post_id, value, reached_at)
  select d, 'viral', p.id::text, rank() over (order by coalesce(p.final_views, p.views) desc),
         p.student_id, p.id, coalesce(p.final_views, p.views), p.posted_at
  from counted_posts p join students st on st.id = p.student_id
  where st.status = 'active' and p.post_type in ('reel', 'video')
    and coalesce(p.final_views, p.views) is not null
    -- last 7 days, and only Reels from the academy period (posted on or after the join date)
    and (p.posted_at at time zone 'Asia/Kolkata')::date between greatest(d - 6, st.start_date) and d;
end $$;

delete from ranking_snapshots k
using posts p, students st
where k.board = 'viral' and p.id = k.post_id and st.id = p.student_id
  and (p.posted_at at time zone 'Asia/Kolkata')::date < st.start_date;

update ranking_snapshots k set rank = r.nr
from (select day, item, rank() over (partition by day order by value desc) as nr
      from ranking_snapshots where board = 'viral') r
where k.board = 'viral' and k.day = r.day and k.item = r.item and k.rank <> r.nr;

-- Posts from the academy period only (on or after the join date), for the team's Top posts and
-- Viral Reels lists. Same row rules as counted_posts (security invoker, so RLS on posts applies).
create view academy_posts with (security_invoker = on) as
select p.* from counted_posts p join students st on st.id = p.student_id
where (p.posted_at at time zone 'Asia/Kolkata')::date >= st.start_date;
