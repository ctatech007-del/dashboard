'use server';

import { redirect } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { callFunction } from '@/lib/functions';

export type RenameState = { error?: string } | undefined;

/** Public: a student reports a new handle. The database validates it; the check runs in the background. */
export async function requestRename(_: RenameState, form: FormData): Promise<RenameState> {
  const db = await supabase();
  const { data, error } = await db.rpc('hub_request_rename', {
    old_h: String(form.get('old') ?? '').slice(0, 40),
    new_h: String(form.get('new') ?? '').slice(0, 40),
  });
  if (error) return { error: 'Something went wrong. Please try again in a minute.' };
  const res = data as { id?: string; error?: string };
  if (res.error || !res.id) return { error: res.error ?? 'Please try again.' };
  await callFunction('rename-verify', { request_id: res.id }).catch(() => null);
  redirect(`/hub/rename?r=${res.id}`);
}
