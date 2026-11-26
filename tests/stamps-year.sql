-- A year in the life of one made-up student, day by day, with the real stamp rules.
-- Posts, follower counts, views and leaderboard places arrive on their day; the stamp rules run once a
-- day with the dummy clock (cta.today) set to that day. At the end it reports, for every stamp, the day
-- it was expected, the day it was dated and the simulated day it first appeared, then raises an error
-- ON PURPOSE so everything is undone: safe to run on the live database, nothing is kept.
do $$
declare
  sid uuid;
  d date;
  f int;
  n_before int := 0;
  n_now int;
  removed int := 0;
  first_seen jsonb := '{}';
  r record;
  expected jsonb := '{
    "takeoff":"2025-11-01","boarding_pass":"2025-11-01","jet_setter":"2025-11-15","economy_premium":"2025-11-20",
    "wanderer":"2025-12-05","business_class":"2025-12-20","frequent_flyer":"2026-01-10","explorer":"2026-01-15",
    "nomad":"2026-02-10","co_pilot":"2026-02-14","captain":"2026-02-20","hidden_gem":"2026-03-08",
    "landmark":"2026-03-09","wonder_of_the_world":"2026-03-10","globetrotter":"2026-03-25","first_class":"2026-03-25",
    "around_the_world":"2026-04-06","first_captain":"2026-04-20","silver_wings":"2026-05-01",
    "trailblazer":"2026-06-10","legend":"2026-09-10","golden_wings":"2026-11-01"}';
  result jsonb := '{}';
  bad int := 0;
begin
  insert into students (name, ig_handle, batch_id, start_date)
  values ('Clock Test (simulation)', 'zz_clock_test_sim', (select id from batches order by name limit 1), '2025-11-01')
  returning id into sid;

  for d in select g::date from generate_series('2025-11-01'::date, '2026-11-30'::date, interval '1 day') g loop
    -- Posts: 15 in Nov, 10 in Dec, 10 in Jan, then one a day from 1 Feb (the 100th lands on 6 Apr)
    if (d <= '2025-11-15') or (d between '2025-12-01' and '2025-12-10') or (d between '2026-01-01' and '2026-01-10')
       or (d between '2026-02-01' and '2026-04-06') then
      insert into posts (student_id, shortcode, post_type, posted_at, url, is_collab)
      values (sid, 'sim_' || d, 'reel', (d + time '10:00') at time zone 'Asia/Kolkata', 'u', d = '2026-02-14');
    end if;
    -- Views are final on day 7
    if d = '2026-03-08' then update posts set final_views = 12000, views_final_at = (d + time '10:00') at time zone 'Asia/Kolkata' where shortcode = 'sim_2026-03-01'; end if;
    if d = '2026-03-09' then update posts set final_views = 150000, views_final_at = (d + time '10:00') at time zone 'Asia/Kolkata' where shortcode = 'sim_2026-03-02'; end if;
    if d = '2026-03-10' then update posts set final_views = 1200000, views_final_at = (d + time '10:00') at time zone 'Asia/Kolkata' where shortcode = 'sim_2026-03-03'; end if;
    -- Followers, counted every morning
    f := case when d >= '2026-09-10' then 101000 when d >= '2026-06-10' then 51000 when d >= '2026-03-25' then 25500
              when d >= '2026-02-10' then 10500 when d >= '2026-01-15' then 5200 when d >= '2025-12-20' then 1700
              when d >= '2025-12-05' then 1000 when d >= '2025-11-20' then 650 else 500 end;
    insert into follower_snapshots (student_id, day, followers) values (sid, d, f);
    -- Leaderboard: 3rd on 20 Feb, 1st on 20 Apr
    if d = '2026-02-20' then insert into ranking_snapshots (day, board, item, rank, student_id, value) values (d, 'total_posts', sid::text, 3, sid, 5); end if;
    if d = '2026-04-20' then insert into ranking_snapshots (day, board, item, rank, student_id, value) values (d, 'total_posts', sid::text, 1, sid, 9); end if;

    perform set_config('cta.today', d::text, true);
    perform award_stamps();

    select count(*) into n_now from stamps where student_id = sid;
    if n_now < n_before then removed := removed + 1; end if;
    n_before := n_now;
    for r in select stamp from stamps where student_id = sid loop
      if not first_seen ? r.stamp then first_seen := first_seen || jsonb_build_object(r.stamp, d); end if;
    end loop;
  end loop;

  for r in select key, value #>> '{}' as exp from jsonb_each(expected) loop
    result := result || jsonb_build_object(r.key, jsonb_build_object(
      'expected', r.exp,
      'dated', (select (earned_at at time zone 'Asia/Kolkata')::date::text from stamps where student_id = sid and stamp = r.key),
      'appeared', first_seen ->> r.key));
  end loop;
  select count(*) into bad from jsonb_each(result) e
   where e.value->>'dated' is distinct from e.value->>'expected' or e.value->>'appeared' is distinct from e.value->>'expected';
  raise exception 'STAMP_SIM %', jsonb_build_object('stamps', (select count(*) from stamps where student_id = sid),
    'mismatches', bad, 'removed', removed, 'result', result)::text;
end $$;
