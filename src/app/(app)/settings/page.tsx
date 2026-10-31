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
      <h1 className="display text-4xl mb-6">Settings</h1>
      <section className="card p-5 max-w-xl">
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
            <label className="block text-sm">
              <span className="block font-semibold">Alert emails</span>
              <span className="block text-ink-soft mb-2">
                Who gets an email when a scrape fails or profiles can’t be read. Separate with commas.
              </span>
              <input name="alert_emails" defaultValue={(cfg?.alert_emails ?? []).join(', ')}
                placeholder="you@creatortakeoff.com" className="field" />
            </label>
            <fieldset className="text-sm rounded-lg border border-rule p-4 space-y-3">
              <legend className="px-1 font-semibold">Reward messages on Heartbeat</legend>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="reward_messages" defaultChecked={cfg?.reward_messages ?? false} className="size-4 accent-[#ef7c22]" />
                <span>Send automatically when a student reaches a reward (10, 15, 30 … 100 posts)</span>
              </label>
              <label className="block">
                <span className="block text-ink-soft mb-1">
                  Message. <code>{'{name}'}</code> becomes their first name, <code>{'{step}'}</code> the number of posts.
                  Leave a blank line for a new paragraph.
                </span>
                <textarea name="reward_message" rows={4} defaultValue={cfg?.reward_message ?? ''} className="field" />
              </label>
              <p className="text-xs text-ink-soft">
                Sent as a direct message from the account that created the Heartbeat API key. Each reward is sent once,
                within 3 hours of reaching it, and logged on the Rewards page. Students not linked to Heartbeat get none.
              </p>
            </fieldset>
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
