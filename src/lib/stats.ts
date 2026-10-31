import 'server-only';
// Data for the Student Stats pages. Month numbers come from month_rows() in the database (or the
// frozen month_stats once a month is closed), so every page counts the same way.
import type { supabase } from '@/lib/supabase';
import { addDays, daysBetween, istToday, monthEnd, monthList, monthStart, monthWindow } from '@/lib/period';

type DB = Awaited<ReturnType<typeof supabase>>;

export interface MonthRow {
  student_id: string; in_community: boolean; posts: number; reels: number;
  followers_start: number | null; followers_end: number | null; follower_growth: number | null;
  views_final: number; best_views: number | null;
}

/** One row per student for month `m` up to `upto`; frozen months read their stored numbers. */
export async function monthRows(db: DB, m: string, upto: string): Promise<MonthRow[]> {
  if (upto === monthEnd(m)) {
    const { data: frozen } = await db.from('community_months').select('month').eq('month', m).maybeSingle();
    if (frozen) {
      const { data } = await db.from('month_stats').select('*').eq('month', m);
      return (data ?? []) as MonthRow[];
    }
  }
  const { data, error } = await db.rpc('month_rows', { m, upto });
  if (error) throw new Error(error.message);
  return (data ?? []) as MonthRow[];
}

/** Months the team can pick: from the first scrape to now, newest first. */
export async function availableMonths(db: DB) {
  const today = istToday();
  const { data } = await db.from('scrape_runs').select('started_at').order('started_at').limit(1).maybeSingle();
  const first = data?.started_at ? data.started_at.slice(0, 10) : today;
  return { today, months: monthList(first, today) };
}

/** The month from ?month=YYYY-MM, or the current one. */
export function pickMonth(param: string | undefined, months: string[], today: string) {
  const wanted = param && /^\d{4}-\d{2}$/.test(param) ? `${param}-01` : monthStart(today);
  return monthWindow(months.includes(wanted) ? wanted : months[0], today);
}

/** Joined (intake this month) and left (leave date in the window) counts. */
export async function joinedLeft(db: DB, m: string, upto: string) {
  const [{ count: joined }, { count: left }] = await Promise.all([
    db.from('students').select('id', { count: 'exact', head: true }).eq('intake_month', m).neq('status', 'removed'),
    db.from('students').select('id', { count: 'exact', head: true }).neq('status', 'removed')
      .gte('leave_date', m).lte('leave_date', upto),
  ]);
  return { joined: joined ?? 0, left: left ?? 0 };
}

export interface StudentRow {
  id: string; name: string; ig_handle: string; status: string; start_date: string;
  intake_month: string | null; leave_date: string | null; contract_months: number | null;
  contract_end: string | null; heartbeat_url: string | null;
  followers: number | null;          // latest count
  growth: number | null;             // this month so far
  posts: number;                     // this month so far
  growth30: number | null;           // last 30 days
  posts30: number;                   // last 30 days (since joining)
  email: string | null;
  lastPost: string | null;           // ISO
  noPostDays: number | null;         // days since the last counted post (or since joining)
  contractDays: number | null;       // days until the contract ends
  lastOutcome: string | null;
  lastNote: { body: string; created_at: string; author: string } | null;
}

/** Everyone on the roster except removed, with this month's numbers. */
export async function studentRows(db: DB): Promise<StudentRow[]> {
  const today = istToday();
  const m = monthStart(today);
  const since30 = addDays(today, -30);
  const [{ data: students }, rows, { data: snaps }, { data: notes }, { data: recent }] = await Promise.all([
    db.from('leaderboard')
      .select('id, name, ig_handle, status, start_date, last_post_at, last_outcome')
      .neq('status', 'removed'),
    monthRows(db, m, today),
    db.from('follower_snapshots').select('student_id, day, followers')
      .gte('day', addDays(today, -40)).order('day', { ascending: false }),
    db.from('student_notes').select('student_id, body, created_at, author').order('created_at', { ascending: false }),
    db.from('counted_posts').select('student_id, posted_at').gte('posted_at', `${since30}T00:00:00+05:30`),
  ]);
  const { data: extra } = await db.from('students')
    .select('id, intake_month, leave_date, contract_months, contract_end, heartbeat_url, email')
    .neq('status', 'removed');

  const byMonth = new Map(rows.map((r) => [r.student_id, r]));
  // Snapshots arrive newest first: the first one per student is today's count; the 30-day base is the
  // newest on or before 30 days ago, or the oldest we have when they're newer than that.
  const latest = new Map<string, number>();
  const before30 = new Map<string, number>();     // newest count on or before 30 days ago
  const oldestIn30 = new Map<string, number>();   // oldest count inside the 30 days
  for (const s of snaps ?? []) {
    if (!latest.has(s.student_id)) latest.set(s.student_id, s.followers);
    if (s.day <= since30) { if (!before30.has(s.student_id)) before30.set(s.student_id, s.followers); }
    else oldestIn30.set(s.student_id, s.followers);
  }
  const posts30 = new Map<string, string[]>();
  for (const p of recent ?? []) posts30.set(p.student_id, [...(posts30.get(p.student_id) ?? []), p.posted_at]);
  const lastNote = new Map<string, StudentRow['lastNote']>();
  for (const n of notes ?? []) if (!lastNote.has(n.student_id)) lastNote.set(n.student_id, n);
  const more = new Map((extra ?? []).map((e) => [e.id, e]));

  return (students ?? []).map((s) => {
    const r = byMonth.get(s.id);
    const e = more.get(s.id);
    const since = s.last_post_at
      ? new Date(s.last_post_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
      : s.start_date;
    return {
      ...s, ...e,
      intake_month: e?.intake_month ?? null, leave_date: e?.leave_date ?? null,
      contract_months: e?.contract_months ?? null, contract_end: e?.contract_end ?? null,
      heartbeat_url: e?.heartbeat_url ?? null,
      followers: latest.get(s.id) ?? null,
      growth: r?.follower_growth ?? null,
      posts: r?.posts ?? 0,
      growth30: (() => {
        const now = latest.get(s.id), base = before30.get(s.id) ?? oldestIn30.get(s.id);
        return now === undefined || base === undefined ? null : now - base;
      })(),
      posts30: (posts30.get(s.id) ?? []).filter((t) =>
        new Date(t).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) >= s.start_date).length,
      email: e?.email ?? null,
      lastPost: s.last_post_at,
      noPostDays: since <= today ? daysBetween(since, today) : null,
      contractDays: e?.contract_end ? daysBetween(today, e.contract_end) : null,
      lastOutcome: s.last_outcome,
      lastNote: lastNote.get(s.id) ?? null,
    } as StudentRow;
  });
}

/** Time of the last finished full scrape, for "Updated X ago". */
export async function lastUpdate(db: DB) {
  const { data } = await db.from('scrape_runs').select('finished_at').eq('status', 'done')
    .is('student_ids', null).order('finished_at', { ascending: false }).limit(1).maybeSingle();
  return data?.finished_at ?? null;
}
