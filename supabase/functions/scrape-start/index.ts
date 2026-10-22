// Starts a scrape of every active student. Called by pg_cron and by the "Re-run" button.
import { authorized, db, fnUrl, json, startActor } from '../_shared/env.ts';

const PROFILE_ACTOR = 'apify~instagram-profile-scraper';

Deno.serve(async (req) => {
  if (!authorized(req)) return json({ error: 'unauthorized' }, 401);
  const { trigger = 'manual' } = await req.json().catch(() => ({}));

  // Don't stack runs: a run still going in the last 2 hours blocks a new one.
  const { data: busy } = await db.from('scrape_runs').select('id')
    .in('status', ['running', 'ingesting'])
    .gte('started_at', new Date(Date.now() - 2 * 3600_000).toISOString())
    .limit(1);
  if (busy?.length) return json({ error: 'A scrape is already running', run: busy[0].id }, 409);

  const { data: students, error } = await db.from('students')
    .select('ig_handle').eq('status', 'active');
  if (error) return json({ error: error.message }, 500);
  if (!students.length) return json({ error: 'No active students' }, 400);

  const { data: run, error: runErr } = await db.from('scrape_runs')
    .insert({ trigger: trigger === 'schedule' ? 'schedule' : 'manual',
              profiles_total: students.length })
    .select().single();
  if (runErr) return json({ error: runErr.message }, 500);

  try {
    const apify = await startActor(
      PROFILE_ACTOR,
      { usernames: students.map((s) => s.ig_handle) },
      fnUrl('scrape-ingest', { run: run.id, phase: 'profiles' }),
    );
    await db.from('scrape_runs').update({ apify_run_id: apify.id }).eq('id', run.id);
    return json({ run: run.id, apify: apify.id, profiles: students.length });
  } catch (e) {
    await db.from('scrape_runs').update({
      status: 'failed', error: String(e), finished_at: new Date().toISOString(),
    }).eq('id', run.id);
    return json({ error: String(e) }, 502);
  }
});
