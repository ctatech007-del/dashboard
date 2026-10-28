// A student reported a new Instagram handle on the Hub. Scrape the new handle and accept it only
// if it's the same Instagram account (numeric ID) we already have; otherwise the team decides.
//   POST {request_id}                      → start the check
//   POST ?phase=result&request=<id>        → Apify webhook with the profile
import { authorized, datasetItems, db, errorText, fnUrl, json, startActor } from '../_shared/env.ts';
import { cleanHandle, parseProfile, type RawProfile } from '../_shared/apify.ts';

const PROFILE_ACTOR = 'apify~instagram-profile-scraper';

async function resolve(id: string, status: 'approved' | 'needs_review', detail: string) {
  await db.from('rename_requests').update({
    status, detail, resolved_at: new Date().toISOString(), resolved_by: status === 'approved' ? 'automatic' : null,
  }).eq('id', id).eq('status', 'checking');
}

Deno.serve(async (req) => {
  if (!authorized(req)) return json({ error: 'unauthorized' }, 401);
  const url = new URL(req.url);

  try {
    if (url.searchParams.get('phase') !== 'result') {
      const { request_id } = await req.json().catch(() => ({}));
      const { data: r } = await db.from('rename_requests')
        .select('id, new_handle, status, students(ig_user_id)').eq('id', request_id).maybeSingle();
      if (!r || r.status !== 'checking') return json({ error: 'nothing to check' }, 404);
      const igId = (r.students as unknown as { ig_user_id: string | null } | null)?.ig_user_id;
      if (!igId) {
        await resolve(r.id, 'needs_review', 'No Instagram account ID on record yet, so the team checks this one.');
        return json({ status: 'needs_review' });
      }
      await startActor(PROFILE_ACTOR, { usernames: [r.new_handle] },
        fnUrl('rename-verify', { phase: 'result', request: r.id }));
      return json({ status: 'checking' });
    }

    // Apify finished
    const id = url.searchParams.get('request')!;
    const event = await req.json().catch(() => null);
    const { data: r } = await db.from('rename_requests')
      .select('id, student_id, old_handle, new_handle, status, students(ig_user_id, ig_handle)').eq('id', id).maybeSingle();
    if (!r || r.status !== 'checking') return json({ status: 'already resolved' });
    if (event?.eventType !== 'ACTOR.RUN.SUCCEEDED') {
      await resolve(id, 'needs_review', 'The check couldn’t run on Instagram; the team will look at it.');
      return json({ status: 'needs_review' });
    }
    const items = await datasetItems<RawProfile>(event.resource.defaultDatasetId);
    const item = items.find((i) => cleanHandle(i.username ?? i.inputUrl ?? '') === r.new_handle);
    const parsed = item ? parseProfile(item, null) : null;
    const st = r.students as unknown as { ig_user_id: string | null; ig_handle: string };

    if (!parsed || parsed.outcome === 'not_found' || parsed.outcome === 'error') {
      await resolve(id, 'needs_review', `@${r.new_handle} wasn’t found on Instagram.`);
    } else if (parsed.igUserId !== st.ig_user_id) {
      await resolve(id, 'needs_review', `@${r.new_handle} is a different Instagram account from the one on record.`);
    } else {
      const { count: taken } = await db.from('students').select('id', { count: 'exact', head: true })
        .ilike('ig_handle', r.new_handle).neq('status', 'removed').neq('id', r.student_id);
      if (taken) {
        await resolve(id, 'needs_review', `Another student already has @${r.new_handle}.`);
      } else {
        const { error } = await db.from('students')
          .update({ ig_handle: r.new_handle, updated_at: new Date().toISOString() }).eq('id', r.student_id);
        if (error) throw error;
        await db.from('handle_history').insert({
          student_id: r.student_id, old_handle: st.ig_handle, new_handle: r.new_handle, detected_by: 'student',
        });
        await resolve(id, 'approved', 'Same Instagram account: handle updated.');
      }
    }
    return json({ ok: true });
  } catch (e) {
    return json({ error: errorText(e) }, 500);
  }
});
