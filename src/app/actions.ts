'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabase, teamClient } from '@/lib/supabase';
import { parseCsv } from '@/lib/format';

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

// ───────────── scraping ─────────────
export async function rerun(): Promise<FormState> {
  await teamClient();
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/scrape-start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-function-secret': process.env.FUNCTION_SECRET! },
    body: JSON.stringify({ trigger: 'manual' }),
    cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 409) return { error: 'A scrape is already running. Check back in a few minutes.' };
  if (!res.ok) return { error: body.error ?? `Couldn't start the scrape (${res.status}).` };
  revalidatePath('/', 'layout');
  return { message: `Scraping ${body.profiles} profiles. Numbers update when it finishes.` };
}

// ───────────── roster ─────────────
async function batchId(db: Awaited<ReturnType<typeof supabase>>, name: string) {
  const { data } = await db.from('batches').upsert({ name: name.trim() }, { onConflict: 'name' })
    .select('id').single();
  return data?.id as string | undefined;
}

export async function addStudent(_: FormState, form: FormData): Promise<FormState> {
  const { db } = await teamClient();
  const name = String(form.get('name') ?? '').trim();
  const handle = cleanHandle(String(form.get('handle') ?? ''));
  const batch = String(form.get('batch') ?? '').trim();
  const start = String(form.get('start_date') ?? '');
  if (!name || !handle || !batch || !isDate(start)) return { error: 'Fill in name, handle, batch and start date.' };

  const batch_id = await batchId(db, batch);
  const { error } = await db.from('students').insert({ name, ig_handle: handle, batch_id, start_date: start });
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
  if (!isDate(start)) return { error: 'Start date must be a valid date.' };
  if (!['active', 'paused', 'removed'].includes(status)) return { error: 'Unknown status.' };

  const batch_id = await batchId(db, String(form.get('batch') ?? ''));
  const { error } = await db.from('students').update({
    name: String(form.get('name') ?? '').trim(), ig_handle: handle, batch_id,
    start_date: start, status, updated_at: new Date().toISOString(),
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
    const { error } = await db.from('students').insert({
      name, ig_handle: handle, batch_id: batches.get(batch), start_date: start,
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

  const { error } = await db.from('settings').update({
    streak_threshold: threshold,
    milestones: [...new Set(milestones)].sort((a, b) => a - b),
    sheet_id, updated_at: new Date().toISOString(),
  }).eq('id', 1);
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return { message: 'Saved. New rules apply from the next scrape or re-run.' };
}
