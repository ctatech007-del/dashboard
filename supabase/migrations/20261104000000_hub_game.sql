-- Hub rework (client feedback 4 Nov): "did you mean" on search, and the student's place on this
-- month's Total Posts board for the game header on their 100 Post page.

-- Up to 3 active handles that contain what was typed (or are contained in it). The leaderboards
-- already show handles publicly, so suggesting close matches gives nothing new away.
create or replace function hub_suggest(h text) returns jsonb
language sql stable security definer set search_path = public as $$
  with q as (select lower(trim(leading '@' from trim(h))) as t)
  select coalesce(jsonb_agg(ig_handle order by d, ig_handle), '[]')
  from (
    select st.ig_handle, abs(length(st.ig_handle) - length(q.t)) as d
    from students st, q
    where st.status = 'active' and length(q.t) >= 3
      and (position(q.t in lower(st.ig_handle)) > 0 or position(lower(st.ig_handle) in q.t) > 0)
    order by d, st.ig_handle
    limit 3
  ) m;
$$;

revoke execute on function hub_suggest(text) from public;
grant execute on function hub_suggest(text) to anon, authenticated, service_role;

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
    'member_since', coalesce(st.intake_month, date_trunc('month', st.start_date)::date),
    'total_posts', (select count(*) from p),
    'month_posts', (select count(*) from p where date_trunc('month', posted_at at time zone 'Asia/Kolkata')
                                          = date_trunc('month', now() at time zone 'Asia/Kolkata')),
    'month_rank', (select rank from board where student_id = st.id),
    'players', (select count(*) from board),
    'stamps', coalesce((select jsonb_agg(jsonb_build_object('stamp', s.stamp, 'earned_at', s.earned_at,
                                         'earned_month', s.earned_month) order by s.earned_at, s.stamp)
                        from stamps s where s.student_id = st.id), '[]'),
    'rewards', coalesce((select jsonb_agg(jsonb_build_object('step', r.step, 'reached_at', r.reached_at) order by r.step)
                         from rewards r where r.student_id = st.id), '[]'),
    'updated_at', (select max(finished_at) from scrape_runs where status = 'done' and student_ids is null)
  )
  from st;
$$;
