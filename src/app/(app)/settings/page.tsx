import { teamClient } from '@/lib/supabase';
import { saveSettings } from '@/app/actions';
import { ActionForm } from '@/components/forms';

export default async function Settings() {
  const { db } = await teamClient();
  const { data: cfg } = await db.from('settings').select('*').single();

  return (
    <>
      <h1 className="wide text-3xl font-bold mb-6">Settings</h1>
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
          </div>
        </ActionForm>
      </section>
      <p className="text-sm text-ink-soft mt-6 max-w-xl">
        The scrape runs every Monday at 6:00 AM IST. Team members are invited from the Supabase dashboard.
      </p>
    </>
  );
}
