-- Team tools: manual post corrections, single-student re-scrapes, notes, an audit trail,
-- month-by-month counts, attention thresholds and failure alerts.

-- ───────────────────────── settings ─────────────────────────
alter table settings
  add column quiet_days      int    not null default 14 check (quiet_days >= 1),
  add column challenge_weeks int    not null default 52 check (challenge_weeks >= 1),
  add column alert_emails    text[] not null default '{}';

-- ───────────────────────── manual corrections ─────────────────────────
-- 'manual' posts are ones the scraper missed. Excluded posts stay on record but never count.
alter table posts
  add column source          text    not null default 'scrape' check (source in ('scrape', 'manual')),
  add column excluded        boolean not null default false,
  add column excluded_reason text;

create view counted_posts with (security_invoker = on) as
select * from posts where not excluded;

-- The team may add manual posts and flip `excluded`, nothing else.
create policy team_add_manual on posts for insert to authenticated with check (source = 'manual');
create policy team_exclude on posts for update to authenticated using (true) with check (true);
revoke update on posts from authenticated;
grant update (excluded, excluded_reason) on posts to authenticated;

-- ───────────────────────── single-student re-scrapes ─────────────────────────
alter table scrape_runs
  add column student_ids uuid[],   -- null = every active student
  add column sheet_status text;    -- result of the Sheet sync after this run

-- ───────────────────────── notes / contact log ─────────────────────────
create table student_notes (
  id          bigserial primary key,
  student_id  uuid not null references students(id),
  kind        text not null default 'note' check (kind in ('note', 'call', 'message', 'email', 'meeting')),
  body        text not null check (length(trim(body)) > 0),
  author      text not null default coalesce(auth.jwt() ->> 'email', 'system'),
  created_at  timestamptz not null default now()
);
create index student_notes_student on student_notes (student_id, created_at desc);
alter table student_notes enable row level security;
create policy team_read on student_notes for select to authenticated using (true);
create policy team_add on student_notes for insert to authenticated
  with check (author = auth.jwt() ->> 'email');
create policy own_delete on student_notes for delete to authenticated
  using (author = auth.jwt() ->> 'email');

-- ───────────────────────── audit trail ─────────────────────────
-- Written by triggers only, so it can't be skipped or edited from the app.
create table audit_log (
  id          bigserial primary key,
  at          timestamptz not null default now(),
  actor       text not null,
  action      text not null,
  student_id  uuid references students(id),
  detail      jsonb
);
create index audit_log_student on audit_log (student_id, at desc);
alter table audit_log enable row level security;
create policy team_read on audit_log for select to authenticated using (true);

create or replace function audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  o jsonb := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  n jsonb := to_jsonb(new) - 'raw';
  diff jsonb;
begin
  select coalesce(jsonb_object_agg(k, jsonb_build_object('from', o -> k, 'to', n -> k)), '{}')
    into diff
  from jsonb_object_keys(n) k
  where k not in ('updated_at', 'created_at', 'id') and (o -> k) is distinct from (n -> k);
  if diff = '{}'::jsonb then return new; end if;

  insert into public.audit_log (actor, action, student_id, detail)
  values (coalesce(auth.jwt() ->> 'email', 'system'), tg_table_name || '.' || lower(tg_op),
          case tg_table_name when 'students' then (n ->> 'id')::uuid
                             when 'settings' then null
                             else (n ->> 'student_id')::uuid end,
          diff);
  return new;
end $$;
revoke execute on function audit() from public, anon, authenticated;

create trigger audit_students after insert or update on students
  for each row execute function audit();
create trigger audit_settings after update on settings
  for each row execute function audit();
create trigger audit_manual_posts after insert on posts
  for each row when (new.source = 'manual') execute function audit();
create trigger audit_excluded_posts after update of excluded on posts
  for each row when (old.excluded is distinct from new.excluded) execute function audit();

-- ───────────────────────── month by month ─────────────────────────
create view monthly_stats with (security_invoker = on) as
select p.student_id,
       date_trunc('month', p.posted_at at time zone 'Asia/Kolkata')::date as month,
       count(*)::int as posts
from counted_posts p join students st on st.id = p.student_id
where (p.posted_at at time zone 'Asia/Kolkata')::date >= st.start_date
group by 1, 2;

-- ───────────────────────── metrics ─────────────────────────
-- Same rules as before; only reads counted_posts so corrections take effect.
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

-- After a manual correction the team refreshes the numbers straight away.
create or replace function refresh_metrics() returns void
language sql security definer set search_path = public as $$ select recompute_metrics() $$;
revoke execute on function refresh_metrics() from public, anon;
grant execute on function refresh_metrics() to authenticated;
