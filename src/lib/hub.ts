import 'server-only';
// The Hub runs without a login, so it only ever calls the hub_* database functions (exact handle,
// active students only). Nothing here reads a table directly.
import { createClient } from '@supabase/supabase-js';

// No cookies: the Hub is public, and a cookie-free client lets its pages be cached (see revalidate).
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export interface HubStudent {
  name: string; handle: string; member_since: string; total_posts: number; month_posts: number;
  month_rank: number | null; players: number;
  stamps: { stamp: string; earned_at: string; earned_month: string }[];
  rewards: { step: number; reached_at: string }[];
  updated_at: string | null;
}
export interface HubBoards {
  day: string | null; updated_at: string | null;
  follower_growth: { rank: number; ig_handle: string; value: number; prev_rank: number | null }[];
  viral: { rank: number; ig_handle: string; value: number; url: string; is_new: boolean }[];
  total_posts: { rank: number; ig_handle: string; value: number }[];
  total_posts_tied: string[];
}

export async function hubStudent(handle: string): Promise<HubStudent | null> {
  const { data } = await db().rpc('hub_student', { h: handle });
  return (data as HubStudent | null) ?? null;
}

export async function hubBoards(): Promise<HubBoards> {
  const { data } = await db().rpc('hub_boards');
  return (data as HubBoards) ?? { day: null, updated_at: null, follower_growth: [], viral: [], total_posts: [], total_posts_tied: [] };
}

export async function hubLookup(handle: string): Promise<string | null> {
  const { data } = await db().rpc('hub_lookup', { h: handle });
  return (data as string | null) ?? null;
}

/** Close matches for a handle that wasn't found ("did you mean"). */
export async function hubSuggest(handle: string): Promise<string[]> {
  const { data } = await db().rpc('hub_suggest', { h: handle });
  return (data as string[] | null) ?? [];
}
