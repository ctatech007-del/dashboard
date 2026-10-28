import 'server-only';
// The Hub runs without a login, so it only ever calls the hub_* database functions (exact handle,
// active students only). Nothing here reads a table directly.
import { supabase } from '@/lib/supabase';

export interface HubStudent {
  name: string; handle: string; member_since: string; total_posts: number; month_posts: number;
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
  const db = await supabase();
  const { data } = await db.rpc('hub_student', { h: handle });
  return (data as HubStudent | null) ?? null;
}

export async function hubBoards(): Promise<HubBoards> {
  const db = await supabase();
  const { data } = await db.rpc('hub_boards');
  return (data as HubBoards) ?? { day: null, updated_at: null, follower_growth: [], viral: [], total_posts: [], total_posts_tied: [] };
}

export async function hubLookup(handle: string): Promise<string | null> {
  const db = await supabase();
  const { data } = await db.rpc('hub_lookup', { h: handle });
  return (data as string | null) ?? null;
}
