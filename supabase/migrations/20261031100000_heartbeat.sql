-- Phase 4: Heartbeat. The heartbeat-sync Edge Function matches each student to their Heartbeat
-- member (by email, then by the Instagram link on their profile), records "last seen", and counts
-- active days. Heartbeat's API gives the latest login only, not a count, so a day counts as active
-- when the student logged in that day; syncing every 3 hours catches nearly every day.

alter table students
  add column heartbeat_user_id    text unique,
  add column heartbeat_last_login timestamptz;

create table heartbeat_logins (
  student_id uuid not null references students(id),
  day        date not null,         -- IST day the student logged in
  primary key (student_id, day)
);
alter table heartbeat_logins enable row level security;
create policy team_read on heartbeat_logins for select to authenticated using (true);

-- Reward messages on Heartbeat. Off until the team switches them on and writes the text.
-- {name} and {step} are filled in per student.
alter table settings
  add column reward_messages boolean not null default false,
  add column reward_message  text not null default
    'Hi {name}! 🎉 You just reached {step} posts in the 100 Post Challenge. Here’s your reward: …';

-- Sync every 3 hours (where pg_cron exists; tests run without it).
do $$
begin
  -- Nested so cron.job is only parsed when pg_cron is there
  if to_regclass('cron.job') is not null then
    if not exists (select 1 from cron.job where jobname = 'cta-heartbeat-sync') then
    perform cron.schedule('cta-heartbeat-sync', '15 */3 * * *', $job$
      select net.http_post(
        url := 'https://fzvtqacafnauibjgyocc.supabase.co/functions/v1/heartbeat-sync',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-function-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'function_secret')),
        body := '{}'::jsonb);
    $job$);
    end if;
  end if;
end $$;
