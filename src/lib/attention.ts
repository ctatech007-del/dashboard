// Who needs a look, and why. Data problems (private, not found, errors) come from the scraper;
// the rest are about posting: gone quiet, lost a streak, or too slow to reach the goal in time.

export type Reason = 'data' | 'quiet' | 'streak_lost' | 'behind';

export interface StudentRow {
  start_date: string;          // YYYY-MM-DD, IST
  total_posts: number | null;
  current_streak: number | null;
  longest_streak: number | null;
  last_post_at: string | null;
  last_outcome: string | null;
}
export interface Rules { goal: number; quietDays: number; challengeWeeks: number }

export interface Pace {
  weeks: number;              // weeks since start
  perWeek: number;            // posts per week so far
  expected: number;           // posts they should have by now to finish on time
  finish: Date | null;        // projected date to reach the goal at the current pace
}

const DAY = 864e5;
const WEEK = 7 * DAY;
const startOf = (d: string) => new Date(`${d}T00:00:00+05:30`);

export function pace(s: StudentRow, r: Rules, now = new Date()): Pace {
  const start = startOf(s.start_date);
  const weeks = Math.max(0, (now.getTime() - start.getTime()) / WEEK);
  const total = s.total_posts ?? 0;
  const perWeek = weeks >= 1 ? total / weeks : total;
  const expected = Math.min(r.goal, (r.goal * weeks) / r.challengeWeeks);
  const finish = total >= r.goal ? null
    : perWeek > 0 ? new Date(now.getTime() + ((r.goal - total) / perWeek) * WEEK) : null;
  return { weeks, perWeek, expected, finish };
}

export function reasons(s: StudentRow, r: Rules, now = new Date()): Reason[] {
  const out: Reason[] = [];
  if (s.last_outcome !== 'ok') out.push('data');

  const start = startOf(s.start_date).getTime();
  const sinceStart = (now.getTime() - start) / DAY;
  const lastActivity = s.last_post_at ? new Date(s.last_post_at).getTime() : start;
  if (sinceStart >= r.quietDays && (now.getTime() - lastActivity) / DAY >= r.quietDays) out.push('quiet');

  if ((s.current_streak ?? 0) === 0 && (s.longest_streak ?? 0) >= 2) out.push('streak_lost');

  // Give everyone two weeks to settle in; then flag anyone under 80% of the pace they need.
  const p = pace(s, r, now);
  if ((s.total_posts ?? 0) < r.goal && p.weeks >= 2 && (s.total_posts ?? 0) < p.expected * 0.8) {
    out.push('behind');
  }
  return out;
}

/** Rules from the settings row. */
export function rulesFrom(cfg: { milestones?: number[]; quiet_days?: number; challenge_weeks?: number } | null): Rules {
  return {
    goal: Math.max(...(cfg?.milestones?.length ? cfg.milestones : [100])),
    quietDays: cfg?.quiet_days ?? 14,
    challengeWeeks: cfg?.challenge_weeks ?? 52,
  };
}

/** Columns to select from `leaderboard` for these rules. */
export const ATTENTION_COLUMNS =
  'start_date, total_posts, current_streak, longest_streak, last_post_at, last_outcome';

export const REASON_LABEL: Record<Reason, string> = {
  data: 'Data problem',
  quiet: 'Gone quiet',
  streak_lost: 'Lost their streak',
  behind: 'Behind pace',
};
