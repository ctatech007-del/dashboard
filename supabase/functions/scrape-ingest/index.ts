// Apify webhook target. phase=profiles → ingest profile results, maybe start overflow scrape.
// phase=overflow → ingest extra posts. Both end in finalize(): metrics + Google Sheet sync.
import { authorized, datasetItems, db, fnUrl, json, startActor } from '../_shared/env.ts';
import {
  cleanHandle, missingHandles, normalizePost, parseProfile,
  type NormalizedPost, type Outcome, type RawPost, type RawProfile,
} from '../_shared/apify.ts';

const POST_ACTOR = 'apify~instagram-post-scraper';

interface Student {
  id: string; ig_handle: string; ig_user_id: string | null; start_date: string;
}

Deno.serve(async (req) => {
  if (!authorized(req)) return json({ error: 'unauthorized' }, 401);
  const url = new URL(req.url);
  const runId = url.searchParams.get('run');
  const phase = url.searchParams.get('phase') ?? 'profiles';
  if (!runId) return json({ error: 'missing run' }, 400);

  const event = await req.json().catch(() => null);
  const resource = event?.resource;
  const succeeded = event?.eventType === 'ACTOR.RUN.SUCCEEDED' && resource?.defaultDatasetId;

  try {
    if (phase === 'profiles') return json(await ingestProfiles(runId, succeeded ? resource : null));
    if (phase === 'overflow') {
      if (succeeded) await ingestOverflow(runId, resource.defaultDatasetId);
      return json(await finalize(runId, succeeded ? null : 'Overflow scrape failed; counts may be short'));
    }
    return json({ error: 'bad phase' }, 400);
  } catch (e) {
    await db.from('scrape_runs').update({
      status: 'failed', error: String(e), finished_at: new Date().toISOString(),
    }).eq('id', runId);
    return json({ error: String(e) }, 500);
  }
});

async function activeStudents(): Promise<Student[]> {
  const { data, error } = await db.from('students')
    .select('id, ig_handle, ig_user_id, start_date').eq('status', 'active');
  if (error) throw error;
  return data;
}

async function ingestProfiles(runId: string, resource: { defaultDatasetId: string } | null) {
  await db.from('scrape_runs').update({ status: 'ingesting' }).eq('id', runId);
  const students = await activeStudents();

  if (!resource) {
    // Whole run failed: every student gets a visible error for this run, nothing is carried over.
    await writeResults(runId, students.map((s) => ({
      student_id: s.id, outcome: 'error', detail: 'Scrape run failed', new_posts: 0,
    })));
    return finalize(runId, 'Apify run did not succeed');
  }

  const { data: metrics } = await db.from('student_metrics').select('student_id, last_ok_scrape_at');
  const lastOk = new Map((metrics ?? []).map((m) => [m.student_id, m.last_ok_scrape_at]));
  const byHandle = new Map(students.map((s) => [cleanHandle(s.ig_handle), s]));

  const items = await datasetItems<RawProfile>(resource.defaultDatasetId);
  const results: ResultRow[] = [];
  const overflow: Student[] = [];

  for (const item of items) {
    const handle = cleanHandle(item.username ?? item.inputUrl ?? '');
    const student = byHandle.get(handle);
    if (!student) continue; // not one of ours (e.g. handle removed mid-run)

    // First scrape: use the start date, so a busy new student still triggers the overflow pass.
    const last = lastOk.get(student.id) ?? student.start_date;
    const parsed = parseProfile(item, new Date(last));

    // Same handle, different Instagram account → someone else now owns this handle.
    if (parsed.igUserId && student.ig_user_id && parsed.igUserId !== student.ig_user_id) {
      results.push({ student_id: student.id, outcome: 'error', new_posts: 0,
        detail: 'Handle now belongs to a different Instagram account: check for a rename' });
      continue;
    }
    if (parsed.igUserId && !student.ig_user_id) {
      await db.from('students').update({ ig_user_id: parsed.igUserId }).eq('id', student.id);
    }

    let added = 0;
    if (parsed.outcome === 'ok') {
      added = await savePosts(student.id, parsed.posts, runId);
      if (parsed.mayOverflow) overflow.push(student);
    }
    results.push({ student_id: student.id, outcome: parsed.outcome, detail: parsed.detail,
      new_posts: added });
  }

  for (const h of missingHandles(students.map((s) => s.ig_handle), items)) {
    const s = byHandle.get(h)!;
    results.push({ student_id: s.id, outcome: 'not_found', new_posts: 0,
      detail: 'No profile returned: renamed, deleted or blocked' });
  }
  await writeResults(runId, results);

  if (overflow.length) {
    const oldest = overflow
      .map((s) => lastOk.get(s.id) ?? s.start_date)
      .sort()[0];
    await startActor(POST_ACTOR, {
      username: overflow.map((s) => s.ig_handle),
      onlyPostsNewerThan: String(oldest).slice(0, 10),
      resultsLimit: 100,
    }, fnUrl('scrape-ingest', { run: runId, phase: 'overflow' }));
    return { run: runId, profiles: items.length, overflow: overflow.length };
  }
  return finalize(runId, null);
}

async function ingestOverflow(runId: string, datasetId: string) {
  const students = await activeStudents();
  const byHandle = new Map(students.map((s) => [cleanHandle(s.ig_handle), s]));
  const items = await datasetItems<RawPost>(datasetId);

  const grouped = new Map<string, NormalizedPost[]>();
  for (const item of items) {
    const s = byHandle.get(cleanHandle(item.ownerUsername ?? ''));
    const post = normalizePost(item);
    if (!s || !post) continue;
    grouped.set(s.id, [...(grouped.get(s.id) ?? []), post]);
  }
  for (const [studentId, posts] of grouped) {
    const added = await savePosts(studentId, posts, runId);
    if (added) {
      const { data } = await db.from('scrape_results').select('new_posts')
        .eq('run_id', runId).eq('student_id', studentId).single();
      await db.from('scrape_results').update({ new_posts: (data?.new_posts ?? 0) + added })
        .eq('run_id', runId).eq('student_id', studentId);
    }
  }
}

async function savePosts(studentId: string, posts: NormalizedPost[], runId: string) {
  if (!posts.length) return 0;
  const { data, error } = await db.from('posts')
    .upsert(posts.map((p) => ({ ...p, student_id: studentId, first_seen: runId })),
      { onConflict: 'student_id,shortcode', ignoreDuplicates: true })
    .select('id');
  if (error) throw error;
  return data?.length ?? 0;
}

interface ResultRow {
  student_id: string; outcome: Outcome; detail?: string | null; new_posts: number;
}

async function writeResults(runId: string, rows: ResultRow[]) {
  if (!rows.length) return;
  const { error } = await db.from('scrape_results')
    .upsert(rows.map((r) => ({ ...r, run_id: runId })), { onConflict: 'run_id,student_id' });
  if (error) throw error;
}

async function finalize(runId: string, warning: string | null) {
  const { error } = await db.rpc('recompute_metrics');
  if (error) throw error;

  const { count } = await db.from('scrape_results').select('*', { count: 'exact', head: true })
    .eq('run_id', runId).eq('outcome', 'ok');
  await db.from('scrape_runs').update({
    status: 'done', profiles_ok: count ?? 0, error: warning,
    finished_at: new Date().toISOString(),
  }).eq('id', runId);

  // Sheet sync is best-effort: a Sheets outage must not fail the scrape.
  const sync = await fetch(fnUrl('sheets-sync'), { method: 'POST' }).catch((e) => e);
  return { run: runId, ok: count, sheet: sync instanceof Response ? sync.status : String(sync) };
}
