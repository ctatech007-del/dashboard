// Pure date, period and ranking helpers for Student Stats. All dates are IST calendar days as
// "YYYY-MM-DD" strings, so nothing here depends on the server's time zone. Unit tested.

export const istToday = (now = new Date()) => now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

const parts = (d: string) => d.split('-').map(Number) as [number, number, number];
const fmt = (y: number, m: number, day: number) => {
  const t = new Date(Date.UTC(y, m - 1, day));
  return t.toISOString().slice(0, 10);
};

export const monthStart = (d: string) => `${d.slice(0, 7)}-01`;
export const addMonths = (m: string, n: number) => { const [y, mo] = parts(m); return fmt(y, mo + n, 1); };
export const monthEnd = (m: string) => { const [y, mo] = parts(m); return fmt(y, mo + 1, 0); };
export const addDays = (d: string, n: number) => { const [y, mo, day] = parts(d); return fmt(y, mo, day + n); };
export const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);

/** The month to show and how far into it: the running month stops at today. */
export function monthWindow(m: string, today: string) {
  const current = monthStart(today) === m;
  const upto = current ? today : monthEnd(m);
  // Same days of the previous month (Oct 1–12 vs Sep 1–12), clamped to that month's length.
  const prev = addMonths(m, -1);
  const prevUpto = current
    ? (() => { const d = addDays(prev, daysBetween(m, today)); return d > monthEnd(prev) ? monthEnd(prev) : d; })()
    : monthEnd(prev);
  return { m, upto, current, prev, prevUpto };
}

/** Months from `first` to the current one, newest first. */
export function monthList(first: string, today: string): string[] {
  const out: string[] = [];
  for (let m = monthStart(today); m >= monthStart(first); m = addMonths(m, -1)) out.push(m);
  return out;
}

export function monthLabel(m: string, opts: { short?: boolean } = {}) {
  return new Date(`${m}T00:00:00Z`).toLocaleDateString('en-GB', {
    timeZone: 'UTC', month: opts.short ? 'short' : 'long', year: opts.short ? '2-digit' : 'numeric',
  });
}

/** Average over the values that exist; null when there are none. */
export function average(values: (number | null | undefined)[]): number | null {
  const v = values.filter((x): x is number => typeof x === 'number');
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

/** Percent change, null when there's no base to compare with. */
export const pctChange = (now: number | null, before: number | null) =>
  now === null || before === null || before === 0 ? null : ((now - before) / Math.abs(before)) * 100;

/** Count values into buckets by lower edge: edges [0, 5, 10] → "0–4", "5–9", "10+". */
export function buckets(values: number[], edges: number[], label: (lo: number, hi: number | null) => string) {
  return edges.map((lo, i) => {
    const hi = i + 1 < edges.length ? edges[i + 1] : null;
    return {
      label: label(lo, hi),
      value: values.filter((v) => v >= lo && (hi === null || v < hi)).length,
    };
  });
}

/** Competition ranking ("1, 2, 2, 4"); `tiebreak` orders within a tie without changing the rank. */
export function rank<T>(items: T[], value: (t: T) => number, tiebreak?: (a: T, b: T) => number) {
  const sorted = [...items].sort((a, b) => value(b) - value(a) || (tiebreak ? tiebreak(a, b) : 0));
  let last: number | null = null, lastRank = 0;
  return sorted.map((item, i) => {
    const v = value(item);
    if (v !== last) { lastRank = i + 1; last = v; }
    return { item, rank: lastRank };
  });
}

/** Followers on or before `day` from an ascending list of snapshots. */
export function followersOn(snaps: { day: string; followers: number }[], day: string): number | null {
  let v: number | null = null;
  for (const s of snaps) { if (s.day <= day) v = s.followers; else break; }
  return v;
}

export type Board = 'followers' | 'growth' | 'posts';
export type Period = '1d' | '7d' | '30d' | 'month';

/** A student's value on a board for the period ending on `day`. */
export function boardValue(
  board: Board, period: Period, day: string,
  snaps: { day: string; followers: number }[], postDays: string[], joined: string,
): number | null {
  const from = period === 'month' ? monthStart(day) : addDays(day, -({ '1d': 1, '7d': 7, '30d': 30 }[period]));
  if (board === 'followers') return followersOn(snaps, day);
  if (board === 'posts') {
    // "this month" counts from the 1st; rolling periods count the days after `from`
    const start = period === 'month' ? from : addDays(from, 1);
    return postDays.filter((d) => d >= start && d <= day && d >= joined).length;
  }
  const end = followersOn(snaps, day);
  const startCount = period === 'month'
    ? (followersOn(snaps, from) ?? snaps.find((s) => s.day >= from && s.day <= day)?.followers ?? null)
    : (followersOn(snaps, from) ?? snaps.find((s) => s.day > from && s.day <= day)?.followers ?? null);
  return end === null || startCount === null ? null : end - startCount;
}

/** Rank change since yesterday: positive = moved up. null when they weren't ranked yesterday. */
export const move = (today: number, yesterday: number | undefined) =>
  yesterday === undefined ? null : yesterday - today;
