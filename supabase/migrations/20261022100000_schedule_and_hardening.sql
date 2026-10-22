-- Settings → weekly scrape time, plus fixes from the Supabase security advisor.

-- ───────────────────────── schedule ─────────────────────────
-- Weekly only ("m h * * dow", UTC): daily scraping is out of scope for Phase 1.
alter table settings add constraint scrape_cron_weekly
  check (scrape_cron ~ '^[0-5]?[0-9] (1?[0-9]|2[0-3]) \* \* [0-6]$');

-- Saving a new time in Settings moves the pg_cron job. SECURITY DEFINER because team members
-- can't touch the cron schema themselves; the check constraint above limits what they can set.
create or replace function sync_scrape_schedule() returns trigger
language plpgsql security definer set search_path = '' as $$
declare job bigint;
begin
  select jobid into job from cron.job where jobname = 'cta-weekly-scrape';
  if job is null then
    raise warning 'cron job cta-weekly-scrape not found; schedule it as in README step 1.6';
  else
    perform cron.alter_job(job, schedule := new.scrape_cron);
  end if;
  return new;
end $$;

revoke execute on function sync_scrape_schedule() from public, anon, authenticated;

create trigger settings_sync_schedule
  after update of scrape_cron on settings
  for each row when (old.scrape_cron is distinct from new.scrape_cron)
  execute function sync_scrape_schedule();

-- ───────────────────────── hardening ─────────────────────────
alter function ist_week_start(timestamptz) set search_path = '';

-- Supabase's own event-trigger helper is callable over the REST API; it only needs to fire
-- from its event trigger, which doesn't check EXECUTE.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
