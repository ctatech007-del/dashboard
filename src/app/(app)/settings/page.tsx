import { teamClient } from '@/lib/supabase';
import { saveSettings } from '@/app/actions';
import { ActionForm } from '@/components/forms';
import { cronToIst } from '@/lib/format';

export default async function Settings() {
  const { db } = await teamClient();
  const { data: cfg } = await db.from('settings').select('*').single();
  const scrapeTime = cronToIst(cfg?.scrape_cron ?? '') ?? '06:00';

  return (
    <>
      <h1 className="wide text-3xl md:text-4xl font-bold mb-6">Settings</h1>
      <section className="bg-surface border border-rule rounded-lg p-5 max-w-xl">
        <ActionForm action={saveSettings} submit="Save settings">
          <div className="space-y-5">
            <label className="block text-sm">
              <span className="block font-semibold">Posts per week to keep a streak</span>
              <span className="block text-ink-soft mb-2">A week runs Monday to Sunday, Indian time.</span>
              <input name="streak_threshold" type="number" min={1} required
                defaultValue={cfg?.streak_threshold ?? 1} className="field max-w-24" />
            </label>
            <label className="block text-sm">
              <span className="block font-semibold">Milestones</span>
              <span className="block text-ink-soft mb-2">
                Post totals that count as a milestone, separated by commas. The highest is the finish line.
              </span>
              <input name="milestones" required defaultValue={(cfg?.milestones ?? []).join(', ')} className="field" />
            </label>
            <label className="block text-sm">
              <span className="block font-semibold">Google Sheet</span>
              <span className="block text-ink-soft mb-2">
                Paste the Sheet link. Share the Sheet with the service account email as an Editor first.
                It’s overwritten after every scrape, so don’t edit it by hand.
              </span>
              <input name="sheet_id" defaultValue={cfg?.sheet_id ?? ''} placeholder="https://docs.google.com/spreadsheets/d/…" className="field" />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="block text-sm">
                <span className="block font-semibold">Quiet after (days)</span>
                <span className="block text-ink-soft mb-2">No posts for this long → Attention.</span>
                <input name="quiet_days" type="number" min={1} required
                  defaultValue={cfg?.quiet_days ?? 14} className="field max-w-24" />
              </label>
              <label className="block text-sm">
                <span className="block font-semibold">Challenge length (weeks)</span>
                <span className="block text-ink-soft mb-2">Time to reach the goal; sets the pace.</span>
                <input name="challenge_weeks" type="number" min={1} required
                  defaultValue={cfg?.challenge_weeks ?? 52} className="field max-w-24" />
              </label>
            </div>
            <label className="block text-sm">
              <span className="block font-semibold">Alert emails</span>
              <span className="block text-ink-soft mb-2">
                Who gets an email when a scrape fails or profiles can’t be read. Separate with commas.
              </span>
              <input name="alert_emails" defaultValue={(cfg?.alert_emails ?? []).join(', ')}
                placeholder="you@creatortakeoff.com" className="field" />
            </label>
            <label className="block text-sm">
              <span className="block font-semibold">Daily scrape</span>
              <span className="block text-ink-soft mb-2">Time it runs every day, Indian time.</span>
              <input name="scrape_time" type="time" required defaultValue={scrapeTime}
                aria-label="Scrape time (IST)" className="field max-w-32" />
            </label>
          </div>
        </ActionForm>
      </section>
      <p className="text-sm text-ink-soft mt-6 max-w-xl">
        Team members are invited from the Supabase dashboard (Authentication → Users → Invite). They get an
        email to set their own password; anyone can reset theirs from “Forgot password?” on the sign-in page.
      </p>
    </>
  );
}
