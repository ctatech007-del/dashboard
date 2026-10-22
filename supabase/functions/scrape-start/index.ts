// Starts a scrape of every active student, or of one student when `student_id` is given.
// Called by pg_cron, the "Re-run" button and the per-student "Re-scrape" button.
import { authorized, db, errorText, fnUrl, json, startActor } from '../_shared/env.ts';
import { alert } from '../_shared/alert.ts';

const PROFILE_ACTOR = 'apify~instagram-profile-scraper';

Deno.serve(async (req) => {
  if (!authorized(req)) return json({ error: 'unauthorized' }, 401);
  const { trigger = 'manual', student_id } = await req.json().catch(() => ({}));

  // Don't stack runs: a run still going in the last 2 hours blocks a new one.
  const { data: busy } = await db.from('scrape_runs').select('id')
    .in('status', ['running', 'ingesting'])
    .gte('started_at', new Date(Date.now() - 2 * 3600_000).toISOString())
    .limit(1);
  if (busy?.length) return json({ error: 'A scrape is already running', run: busy[0].id }, 409);

  let query = db.from('students').select('id, ig_handle').eq('status', 'active');
  if (student_id) query = query.eq('id', student_id);
  const { data: students, error } = await query;
  if (error) return json({ error: error.message }, 500);
  if (!students.length) {
    return json({ error: student_id ? 'Only active students can be scraped' : 'No active students' }, 400);
  }

  const { data: run, error: runErr } = await db.from('scrape_runs')
    .insert({ trigger: trigger === 'schedule' ? 'schedule' : 'manual',
              profiles_total: students.length,
              student_ids: student_id ? [student_id] : null })
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
      status: 'failed', error: errorText(e), finished_at: new Date().toISOString(),
    }).eq('id', run.id);
    await alert('Scrape could not start',
      `The ${trigger} scrape failed to start, so no numbers were updated.\n\n${errorText(e)}\n\n` +
      'Usual causes: the Apify token is wrong or out of credit. Open Runs & health in the tracker.');
    return json({ error: errorText(e) }, 502);
  }
});
