'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabase, teamClient } from '@/lib/supabase';
import { istToCron, parseCsv } from '@/lib/format';
import { callFunction } from '@/lib/functions';

export type FormState = { error?: string; message?: string } | undefined;

const cleanHandle = (h: string) =>
  h.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/[/?#].*$/, '')
    .replace(/^@/, '').toLowerCase();
const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));

// ───────────── auth ─────────────
export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const db = await supabase();
  const { error } = await db.auth.signInWithPassword({
    email: String(form.get('email') ?? ''),
    password: String(form.get('password') ?? ''),
  });
  if (error) return { error: 'Email or password is incorrect.' };
  redirect('/');
}

export async function signOut() {
  const db = await supabase();
  await db.auth.signOut();
  redirect('/login');
}

// The reset email links to /login/confirm (see README: Auth email templates).
export async function requestPasswordReset(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get('email') ?? '').trim();
  if (!email) return { error: 'Enter your email.' };
  const db = await supabase();
  await db.auth.resetPasswordForEmail(email);
  // Same answer either way, so the form doesn't reveal who has an account.
  return { message: 'If that email belongs to a team member, a reset link is on its way.' };
}

/** Sets a password for whoever arrived from an invite or reset link. */
export async function setPassword(_: FormState, form: FormData): Promise<FormState> {
  const { db } = await teamClient();
  const password = String(form.get('password') ?? '');
  if (password.length < 8) return { error: 'Use at least 8 characters.' };
  if (password !== form.get('confirm')) return { error: 'The two passwords don’t match.' };
  const { error } = await db.auth.updateUser({ password });
  if (error) return { error: error.message };
  redirect('/');
}

// ───────────── scraping ─────────────
export async function rerun(): Promise<FormState> {
  await teamClient();
  const { res, body } = await callFunction('scrape-start', { trigger: 'manual' });
  if (res.status === 409) return { error: 'A scrape is already running. Check back in a few minutes.' };
  if (!res.ok) return { error: body.error ?? `Couldn't start the scrape (${res.status}).` };
  revalidatePath('/', 'layout');
  return { message: `Scraping ${body.profiles} profiles. Numbers update when it finishes.` };
}

export async function rerunStudent(_: FormState, form: FormData): Promise<FormState> {
  await teamClient();
  const { res, body } = await callFunction('scrape-start', {
    trigger: 'manual', student_id: String(form.get('student_id')),
  });
  if (res.status === 409) return { error: 'A scrape is already running. Try again in a few minutes.' };
  if (!res.ok) return { error: body.error ?? `Couldn't start the scrape (${res.status}).` };
  revalidatePath('/', 'layout');
  return { message: 'Re-scraping this profile. Refresh in a minute or two.' };
}

// ───────────── manual corrections ─────────────
const SHORTCODE = /instagram\.com\/(?:[\w.]+\/)?(?:p|reel|reels|tv)\/([\w-]+)/i;

export async function addPost(_: FormState, form: FormData): Promise<FormState> {
  const { db } = await teamClient();
  const student_id = String(form.get('student_id'));
  const url = String(form.get('url') ?? '').trim();
  const shortcode = url.match(SHORTCODE)?.[1];
  const when = String(form.get('posted_at') ?? '');
  const post_type = String(form.get('post_type') ?? 'image');
  if (!shortcode) return { error: 'Paste the post’s Instagram link (…/p/… or …/reel/…).' };
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(when)) return { error: 'Pick the date and time it was posted.' };
  if (!['image', 'carousel', 'reel', 'video'].includes(post_type)) return { error: 'Unknown post type.' };

  const { error } = await db.from('posts').insert({
    student_id, shortcode, post_type, url: `https://www.instagram.com/p/${shortcode}/`,
    posted_at: `${when}:00+05:30`, source: 'manual',
  });
  if (error) return { error: error.code === '23505' ? 'That post is already on record.' : error.message };
  await db.rpc('refresh_metrics');
  revalidatePath('/', 'layout');
  return { message: 'Post added and counted.' };
}

export async function setExcluded(_: FormState, form: FormData): Promise<FormState> {
  const { db } = await teamClient();
  const excluded = form.get('excluded') === 'true';
  const reason = String(form.get('reason') ?? '').trim();
  if (excluded && !reason) return { error: 'Say why it shouldn’t count.' };
  const { error } = await db.from('posts')
    .update({ excluded, excluded_reason: excluded ? reason : null })
    .eq('id', Number(form.get('post_id')));
  if (error) return { error: error.message };
  await db.rpc('refresh_metrics');
  revalidatePath('/', 'layout');
  return { message: excluded ? 'Excluded. It no longer counts.' : 'Restored. It counts again.' };
}

// ───────────── notes ─────────────
export async function addNote(_: FormState, form: FormData): Promise<FormState> {
  const { db, user } = await teamClient();
  const body = String(form.get('body') ?? '').trim();
  const contact_date = String(form.get('contact_date') ?? '') || todayIst();
  if (!body) return { error: 'Write something first.' };
  if (!isDate(contact_date) || contact_date > todayIst()) return { error: 'Pick the date of the contact (today or earlier).' };
  const { error } = await db.from('student_notes').insert({
    student_id: String(form.get('student_id')), body, contact_date, author: user.email,
  });
  if (error) return { error: error.message };
  revalidatePath(`/students/${form.get('student_id')}`);
  return { message: 'Saved.' };
}

export async function deleteNote(form: FormData) {
  const { db } = await teamClient();
  await db.from('student_notes').delete().eq('id', Number(form.get('note_id')));
  revalidatePath(`/students/${form.get('student_id')}`);
}

// ───────────── roster ─────────────
async function batchId(db: Awaited<ReturnType<typeof supabase>>, name: string) {
  const { data } = await db.from('batches').upsert({ name: name.trim() }, { onConflict: 'name' })
    .select('id').single();
  return data?.id as string | undefined;
}

/** Optional master data shared by the add and edit forms. The contract end is entered by hand. */
function masterData(form: FormData): { error: string } | { data: Record<string, unknown> } {
  const text = (k: string) => String(form.get(k) ?? '').trim();
  const heartbeat_url = text('heartbeat_url') || null;
  if (heartbeat_url && !/^https:\/\/\S+$/.test(heartbeat_url)) return { error: 'The Heartbeat link should start with https://' };
  const months = text('contract_months');
  const contract_months = months ? Number(months) : null;
  if (contract_months !== null && (!Number.isInteger(contract_months) || contract_months < 1 || contract_months > 60)) {
    return { error: 'Contract length is a number of months, e.g. 6 or 12.' };
  }
  const contract_end = text('contract_end') || null;
  const email = text('email').toLowerCase() || null;
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'That email doesn’t look right.' };
  const leave = text('leave_date') || null;
  const intake = text('intake_month');
  if ([contract_end, leave].some((d) => d && !isDate(d)) || (intake && !/^\d{4}-\d{2}$/.test(intake))) {
    return { error: 'One of the dates isn’t valid.' };
  }
  const data: Record<string, unknown> = { heartbeat_url, contract_months, contract_end, leave_date: leave, email };
  if (form.has('intake_month')) data.intake_month = intake ? `${intake}-01` : null;
  return { data };
}
const todayIst = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

export async function addStudent(_: FormState, form: FormData): Promise<FormState> {
  const { db } = await teamClient();
  const name = String(form.get('name') ?? '').trim();
  const handle = cleanHandle(String(form.get('handle') ?? ''));
  const batch = String(form.get('batch') ?? '').trim();
  const start = String(form.get('start_date') ?? '');
  if (!name || !handle || !batch || !isDate(start)) return { error: 'Fill in name, handle, batch and join date.' };
  const extra = masterData(form);
  if ('error' in extra) return extra;

  const batch_id = await batchId(db, batch);
  const { error } = await db.from('students').insert({
    name, ig_handle: handle, batch_id, start_date: start, ...extra.data,
  });
  if (error) return { error: error.code === '23505' ? `@${handle} is already on the roster.` : error.message };
  revalidatePath('/', 'layout');
  return { message: `Added ${name} (@${handle}).` };
}

export async function updateStudent(_: FormState, form: FormData): Promise<FormState> {
  const { db } = await teamClient();
  const id = String(form.get('id'));
  const { data: before } = await db.from('students').select('ig_handle').eq('id', id).single();
  if (!before) return { error: 'Student not found.' };

  const handle = cleanHandle(String(form.get('handle') ?? before.ig_handle));
  const start = String(form.get('start_date') ?? '');
  const status = String(form.get('status') ?? 'active');
  if (!isDate(start)) return { error: 'Join date must be a valid date.' };
  if (!['active', 'paused', 'left', 'removed'].includes(status)) return { error: 'Unknown status.' };
  const extra = masterData(form);
  if ('error' in extra) return extra;
  // Leaving: stop scraping from that day, keep all history.
  if (status === 'left' && !extra.data.leave_date) extra.data.leave_date = todayIst();
  if (status === 'active') extra.data.leave_date = null;

  const batch_id = await batchId(db, String(form.get('batch') ?? ''));
  const { error } = await db.from('students').update({
    name: String(form.get('name') ?? '').trim(), ig_handle: handle, batch_id,
    start_date: start, status, ...extra.data, updated_at: new Date().toISOString(),
  }).eq('id', id);
  if (error) return { error: error.code === '23505' ? `@${handle} is already on the roster.` : error.message };

  if (handle !== before.ig_handle) {
    await db.from('handle_history').insert({
      student_id: id, old_handle: before.ig_handle, new_handle: handle, detected_by: 'team',
    });
  }
  revalidatePath('/', 'layout');
  return { message: 'Saved.' };
}

export async function uploadCsv(_: FormState, form: FormData): Promise<FormState> {
  const { db } = await teamClient();
  const file = form.get('file');
  if (!(file instanceof File) || !file.size) return { error: 'Choose a CSV file first.' };

  const rows = parseCsv(await file.text());
  const header = (rows.shift() ?? []).map((h) => h.toLowerCase().replace(/\s+/g, '_'));
  const col = (n: string) => header.indexOf(n);
  const [iName, iHandle, iBatch, iStart] = ['name', 'handle', 'batch', 'start_date'].map(col);
  // Optional columns
  const [iHeartbeat, iMonths, iEnd, iEmail] = ['heartbeat_url', 'contract_months', 'contract_end', 'email'].map(col);
  if ([iName, iHandle, iBatch, iStart].includes(-1)) {
    return { error: 'The CSV needs these columns: name, handle, batch, start_date (YYYY-MM-DD).' };
  }

  const problems: string[] = [];
  let added = 0;
  const batches = new Map<string, string>();
  for (const [n, r] of rows.entries()) {
    const line = n + 2;
    const name = r[iName], handle = cleanHandle(r[iHandle] ?? ''), batch = r[iBatch], start = r[iStart];
    if (!name || !handle || !batch || !isDate(start ?? '')) { problems.push(`row ${line}: missing or invalid value`); continue; }
    if (!batches.has(batch)) batches.set(batch, (await batchId(db, batch))!);
    const months = iMonths >= 0 && r[iMonths] ? Number(r[iMonths]) : null;
    const end = iEnd >= 0 && r[iEnd] ? r[iEnd] : null;
    if ((months !== null && !(Number.isInteger(months) && months > 0)) || (end && !isDate(end))) {
      problems.push(`row ${line}: invalid contract`); continue;
    }
    const { error } = await db.from('students').insert({
      name, ig_handle: handle, batch_id: batches.get(batch), start_date: start,
      heartbeat_url: iHeartbeat >= 0 ? r[iHeartbeat] || null : null, contract_months: months, contract_end: end,
      email: iEmail >= 0 ? r[iEmail]?.toLowerCase() || null : null,
    });
    if (error) problems.push(`row ${line}: ${error.code === '23505' ? `@${handle} already on the roster` : error.message}`);
    else added++;
  }
  revalidatePath('/', 'layout');
  const msg = `Added ${added} student${added === 1 ? '' : 's'}.`;
  return problems.length
    ? { error: `${msg} Skipped ${problems.length}: ${problems.slice(0, 5).join('; ')}${problems.length > 5 ? '…' : ''}` }
    : { message: msg };
}

// ───────────── settings ─────────────
export async function saveSettings(_: FormState, form: FormData): Promise<FormState> {
  const { db } = await teamClient();
  const threshold = Number(form.get('streak_threshold'));
  const milestones = String(form.get('milestones') ?? '')
    .split(/[,\s]+/).filter(Boolean).map(Number);
  if (!Number.isInteger(threshold) || threshold < 1) return { error: 'Streak threshold must be 1 or more.' };
  if (!milestones.length || milestones.some((m) => !Number.isInteger(m) || m < 1)) {
    return { error: 'Milestones must be whole numbers, separated by commas.' };
  }
  const sheetRaw = String(form.get('sheet_id') ?? '').trim();
  const sheet_id = sheetRaw.match(/\/d\/([\w-]+)/)?.[1] ?? (sheetRaw || null);
  // A trigger on settings moves the pg_cron job to the new time.
  const scrape_cron = istToCron(String(form.get('scrape_time') ?? ''));
  if (!scrape_cron) return { error: 'Pick the time of the daily scrape.' };
  const alert_emails = String(form.get('alert_emails') ?? '').split(/[,\s]+/).filter(Boolean);
  if (alert_emails.some((e) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))) {
    return { error: 'One of the alert emails doesn’t look right.' };
  }

  const reward_messages = form.get('reward_messages') === 'on';
  const reward_message = String(form.get('reward_message') ?? '').trim();
  if (reward_messages && !reward_message) return { error: 'Write the reward message before switching it on.' };

  const { error } = await db.from('settings').update({
    streak_threshold: threshold,
    milestones: [...new Set(milestones)].sort((a, b) => a - b),
    sheet_id, scrape_cron, alert_emails, reward_messages, ...(reward_message ? { reward_message } : {}),
    updated_at: new Date().toISOString(),
  }).eq('id', 1);
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return { message: 'Saved. New rules apply from the next scrape or re-run.' };
}

// ───────────── 100 Post rewards ─────────────
export async function markRewardSent(form: FormData) {
  const { db, user } = await teamClient();
  const sent = form.get('undo') !== '1';
  await db.from('rewards').update({
    sent_at: sent ? new Date().toISOString() : null, sent_by: sent ? user.email : null,
    note: String(form.get('note') ?? '').trim() || null,
  }).eq('student_id', String(form.get('student_id'))).eq('step', Number(form.get('step')));
  revalidatePath('/rewards');
}

// ───────────── handle changes reported on the Hub ─────────────
export async function resolveRename(form: FormData) {
  const { db, user } = await teamClient();
  const id = String(form.get('id'));
  const approve = form.get('decision') === 'approve';
  const { data: r } = await db.from('rename_requests')
    .select('id, student_id, new_handle, status, students(ig_handle)').eq('id', id).single();
  if (!r || !['needs_review', 'checking'].includes(r.status)) return;
  if (approve) {
    const old = (r.students as unknown as { ig_handle: string }).ig_handle;
    const { error } = await db.from('students')
      .update({ ig_handle: r.new_handle, updated_at: new Date().toISOString() }).eq('id', r.student_id);
    if (error) return;
    await db.from('handle_history').insert({
      student_id: r.student_id, old_handle: old, new_handle: r.new_handle, detected_by: 'team',
    });
  }
  await db.from('rename_requests').update({
    status: approve ? 'approved' : 'rejected', resolved_at: new Date().toISOString(), resolved_by: user.email,
  }).eq('id', id);
  revalidatePath('/troubleshooting');
}
