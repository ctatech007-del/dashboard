import Link from 'next/link';
import { teamClient } from '@/lib/supabase';
import { day, OUTCOME_LABEL } from '@/lib/format';
import { ATTENTION_COLUMNS, pace, reasons, REASON_LABEL, rulesFrom, type Reason } from '@/lib/attention';
import { Empty } from '@/components/empty';

const FIX: Record<string, string> = {
  private: 'Ask the student to make their account public. Posts can’t be counted until they do.',
  not_found: 'The handle was probably changed. Ask the student for the new one and update it in the roster.',
  error: 'Usually temporary. Re-scrape this student; if it keeps failing, check the detail below.',
  never_scraped: 'Run a scrape to check this profile.',
};

// Colour by kind of problem, so a long list scans at a glance.
const REASON_BG: Record<string, string> = {
  private: 'bg-pink', not_found: 'bg-lime', error: 'bg-blue', never_scraped: 'bg-green',
};
const NUDGE: Record<Exclude<Reason, 'data'>, string> = {
  quiet: 'Check in: a quick message often gets them posting again.',
  streak_lost: 'Their streak just broke. Encourage them to restart it this week.',
  behind: 'At this pace they won’t reach the goal in time. Worth a call about a weekly plan.',
};

export default async function Attention() {
  const { db } = await teamClient();
  const [{ data: flags }, { data: rows }, { data: cfg }] = await Promise.all([
    db.from('open_flags').select('*').order('days_without_data', { ascending: false, nullsFirst: true }),
    db.from('leaderboard').select(`id, name, ig_handle, batch_name, ${ATTENTION_COLUMNS}`).eq('status', 'active'),
    db.from('settings').select('milestones, quiet_days, challenge_weeks').single(),
  ]);
  const rules = rulesFrom(cfg);
  const people = (rows ?? [])
    .map((r) => ({ ...r, why: reasons(r, rules).filter((x) => x !== 'data'), pace: pace(r, rules) }))
    .filter((r) => r.why.length)
    .sort((a, b) => b.why.length - a.why.length || a.name.localeCompare(b.name));

  return (
    <>
      <h1 className="wide text-3xl md:text-4xl font-bold">Attention</h1>
      <p className="text-sm text-ink-soft mt-1 mb-8">
        Who needs a look this week: profiles we couldn’t read, and students who’ve slowed down.
      </p>

      <h2 className="wide text-lg font-bold mb-1">Data problems ({flags?.length ?? 0})</h2>
      <p className="text-sm text-ink-soft mb-4">Their numbers aren’t updating until this is fixed.</p>
      {!flags?.length ? (
        <Empty title="Nothing to fix">Every active student was read in the last scrape.</Empty>
      ) : (
        <ul className="space-y-3">
          {flags.map((f) => (
            <li key={f.id} className={`neon ${REASON_BG[f.reason] ?? 'bg-pink'} px-5 py-4`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p>
                  <Link href={`/students/${f.id}`} className="wide text-lg font-bold hover:underline underline-offset-4">
                    {f.name}
                  </Link>{' '}
                  <span className="text-sm opacity-70">@{f.ig_handle} · {f.batch_name}</span>
                </p>
                <p className="text-sm">
                  <span className="font-bold">{OUTCOME_LABEL[f.reason]}</span>
                  <span className="opacity-70">
                    {' '}· {f.days_without_data === null ? 'no data yet' : `no data for ${f.days_without_data} days`}
                  </span>
                </p>
              </div>
              <p className="text-sm mt-2">{FIX[f.reason]}</p>
              {f.detail && <p className="text-xs opacity-70 mt-1">{f.detail}</p>}
              <div className="flex flex-wrap gap-2 mt-3">
                <Link href={`/roster?edit=${f.id}`} className="btn !bg-on-neon !text-ink !py-1.5 text-xs">
                  Update handle or status
                </Link>
                <Link href={`/students/${f.id}`} className="btn btn-quiet !text-on-neon !border-on-neon/40 !py-1.5 text-xs">
                  Re-scrape
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2 className="wide text-lg font-bold mt-10 mb-1">Slowing down ({people.length})</h2>
      <p className="text-sm text-ink-soft mb-4">
        Quiet for {rules.quietDays}+ days, lost a streak, or under 80% of the pace to reach {rules.goal} posts
        in {rules.challengeWeeks} weeks. Change these in Settings.
      </p>
      {!people.length ? (
        <Empty title="Everyone’s on track">No active student has slowed down.</Empty>
      ) : (
        <ul className="grid md:grid-cols-2 gap-3">
          {people.map((p) => (
            <li key={p.id} className="bg-surface border border-rule rounded-lg px-5 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link href={`/students/${p.id}`} className="wide text-lg font-bold hover:underline underline-offset-4">
                  {p.name}
                </Link>
                <span className="text-xs text-ink-soft">@{p.ig_handle} · {p.batch_name}</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {p.why.map((w) => (
                  <span key={w} className={`text-xs font-semibold rounded-full px-2.5 py-0.5 text-on-neon ${
                    w === 'behind' ? 'bg-lime' : w === 'quiet' ? 'bg-pink' : 'bg-blue'}`}>
                    {REASON_LABEL[w]}
                  </span>
                ))}
              </div>
              <p className="text-sm text-ink-soft mt-3 tnum">
                {p.total_posts ?? 0} posts · last post {day(p.last_post_at) || 'never'} ·{' '}
                {p.pace.finish ? `on course for ${rules.goal} by ${day(p.pace.finish.toISOString())}` : 'no posts yet'}
              </p>
              <p className="text-sm mt-1">{NUDGE[p.why[0] as Exclude<Reason, 'data'>]}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
