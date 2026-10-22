-- The scrape pipeline calls recompute_metrics() through Supabase's API, which rejects a DELETE
-- without a WHERE clause (pg-safeupdate). Every run failed at its last step because of it.
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
  delete from weekly_stats where true;  -- Supabase's API refuses a DELETE with no WHERE
  insert into weekly_stats (student_id, week_start, posts)
  select p.student_id, ist_week_start(p.posted_at), count(*)
  from counted_posts p join students st on st.id = p.student_id
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
    from (select s.id) x left join counted_posts p on p.student_id = s.id
    on conflict (student_id) do update set
      total_posts = excluded.total_posts, posts_this_week = excluded.posts_this_week,
      current_streak = excluded.current_streak, longest_streak = excluded.longest_streak,
      last_post_at = excluded.last_post_at, updated_at = now();

    -- milestones: record the post that crossed each line, once
    insert into milestones_hit (student_id, milestone, reached_at)
    select s.id, ms, (
      select posted_at from (
        select posted_at, row_number() over (order by posted_at, id) rn
        from counted_posts where student_id = s.id
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
