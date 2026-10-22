import Link from 'next/link';
import { teamClient } from '@/lib/supabase';
import { day, OUTCOME_LABEL } from '@/lib/format';
import { Empty } from '@/components/empty';
import { reasons, rulesFrom } from '@/lib/attention';

export default async function Leaderboard({
  searchParams,
}: { searchParams: Promise<{ batch?: string; view?: string }> }) {
  const { db } = await teamClient();
  const { batch: wanted, view } = await searchParams;

  const { data: batches } = await db.from('batches').select('id, name, start_date, created_at')
    .order('created_at', { ascending: false });
  if (!batches?.length) {
    return (
      <Empty title="No students yet">
        Add your first batch on the <Link className="underline" href="/roster">Roster</Link> page.
        You can type students in one by one or upload a CSV.
      </Empty>
    );
  }
  const batch = batches.find((b) => b.id === wanted) ?? batches[0];

  const [{ data: rows }, { data: cfg }] = await Promise.all([
    db.from('leaderboard').select('*').eq('batch_id', batch.id).eq('status', 'active')
      .order('batch_rank', { ascending: true, nullsFirst: false }).order('name'),
    db.from('settings').select('milestones, streak_threshold, quiet_days, challenge_weeks').single(),
  ]);
  const goal = Math.max(...(cfg?.milestones ?? [100]));
  const list = rows ?? [];

  // Month by month: the last six IST calendar months, newest last.
  const byMonth = view === 'months';
  const monthKeys = lastMonths(6);
  const { data: monthly } = byMonth && list.length
    ? await db.from('monthly_stats').select('student_id, month, posts')
      .in('student_id', list.map((r) => r.id)).gte('month', monthKeys[0])
    : { data: [] as { student_id: string; month: string; posts: number }[] };
  const cell = new Map((monthly ?? []).map((m) => [`${m.student_id}|${m.month}`, m.posts]));
  const monthMax = Math.max(1, ...(monthly ?? []).map((m) => m.posts));
  const totalPosts = list.reduce((n, r) => n + (r.total_posts ?? 0), 0);
  const avgProgress = list.length ? Math.min(100, (totalPosts / (list.length * goal)) * 100) : 0;
  const stats = [
    { label: 'Posts this week', value: list.reduce((n, r) => n + (r.posts_this_week ?? 0), 0), bg: 'bg-pink' },
    { label: 'On a streak', value: list.filter((r) => r.current_streak > 0).length, bg: 'bg-green' },
    {
      label: 'Need a look', value: list.filter((r) => reasons(r, rulesFrom(cfg)).length).length,
      bg: 'bg-blue', href: '/flags',
    },
  ];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="wide text-3xl md:text-4xl font-bold">{batch.name}</h1>
          <p className="text-sm text-ink-soft mt-1">
            {list.length} active students · ranked by total posts since each student&apos;s start date
          </p>
        </div>
        <a className="btn btn-quiet" href={`/api/export?batch=${batch.id}`}>Export CSV</a>
      </div>

      {!!list.length && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="neon bg-lime p-5 col-span-2 lg:col-span-1">
            <p className="wide text-lg font-bold">100 Post Challenge</p>
            <p className="text-sm mt-0.5">Batch average {Math.round(avgProgress)}% of {goal}</p>
            <div className="track mt-4" role="img" aria-label={`Batch average ${Math.round(avgProgress)}%`}>
              <span style={{ width: `${Math.max(avgProgress, 6)}%` }} />
            </div>
          </div>
          {stats.map((s) => {
            const body = (
              <>
                <p className="wide text-lg font-bold leading-tight">{s.label}</p>
                <p className="wide text-4xl font-bold mt-3">{s.value}</p>
              </>
            );
            return s.href ? (
              <Link key={s.label} href={s.href} className={`neon ${s.bg} p-5 hover:brightness-105`}>{body}</Link>
            ) : (
              <div key={s.label} className={`neon ${s.bg} p-5`}>{body}</div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
      {batches.length > 1 ? (
        <nav aria-label="Batches" className="flex flex-wrap gap-2">
          {batches.map((b) => (
            <Link
              key={b.id}
              href={`/?batch=${b.id}`}
              aria-current={b.id === batch.id ? 'page' : undefined}
              className={`rounded-full border px-4 py-1.5 text-sm ${
                b.id === batch.id ? 'border-ink bg-ink text-on-neon font-semibold' : 'border-rule hover:border-ink'
              }`}
            >
              {b.name}
            </Link>
          ))}
        </nav>
      ) : <span />}
        <nav aria-label="View" className="flex rounded-full border border-rule p-1 text-sm">
          {[['', 'Ranking'], ['months', 'Month by month']].map(([v, label]) => (
            <Link
              key={v}
              href={`/?batch=${batch.id}${v ? `&view=${v}` : ''}`}
              aria-current={(view ?? '') === v ? 'page' : undefined}
              className={`rounded-full px-4 py-1 ${(view ?? '') === v ? 'bg-ink text-on-neon font-semibold' : 'text-ink-soft hover:text-ink'}`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>

      {!list.length ? (
        <Empty title="No active students in this batch">
          Paused and removed students don&apos;t appear here. Manage them on the{' '}
          <Link className="underline" href="/roster">Roster</Link>.
        </Empty>
      ) : byMonth ? (
        <div className="bg-surface border border-rule rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-ink-soft border-b border-rule">
              <tr>
                <th className="px-4 py-3 font-medium">Student</th>
                {monthKeys.map((m) => <th key={m} className="px-3 py-3 font-medium text-right">{monthLabel(m)}</th>)}
                <th className="px-4 py-3 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} className="border-b border-rule last:border-0 hover:bg-white/[0.03]">
                  <td className="px-4 py-2.5">
                    <Link href={`/students/${r.id}`} className="font-semibold hover:underline underline-offset-4">{r.name}</Link>
                  </td>
                  {monthKeys.map((m) => {
                    const n = cell.get(`${r.id}|${m}`) ?? 0;
                    return (
                      <td key={m} className="px-3 py-2.5 text-right tnum">
                        <span className="inline-block min-w-8 rounded-md px-1.5 py-0.5 font-semibold"
                          style={n ? { background: `color-mix(in srgb, var(--blue) ${20 + (n / monthMax) * 80}%, transparent)`,
                            color: n / monthMax > 0.5 ? 'var(--on-neon)' : undefined } : { color: 'var(--ink-soft)' }}>
                          {n}
                        </span>
                      </td>
                    );
                  })}
                  <td className="px-4 py-2.5 text-right wide font-bold">{r.total_posts ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-surface border border-rule rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-ink-soft border-b border-rule">
              <tr>
                <th className="px-4 py-3 font-medium w-16">Rank</th>
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Posts</th>
                <th className="px-4 py-3 font-medium">This week</th>
                <th className="px-4 py-3 font-medium" title={`Weeks in a row with ${cfg?.streak_threshold ?? 1}+ posts`}>Streak</th>
                <th className="px-4 py-3 font-medium">Milestone</th>
                <th className="px-4 py-3 font-medium">Last post</th>
                <th className="px-4 py-3 font-medium">Data</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => {
                const total = r.total_posts ?? 0;
                const flagged = r.last_outcome && r.last_outcome !== 'ok';
                return (
                  <tr key={r.id} className="border-b border-rule last:border-0 hover:bg-white/[0.03]">
                    <td className="px-4 py-3">
                      <span className="wide text-2xl font-bold">{r.batch_rank ?? '–'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/students/${r.id}`} className="font-semibold hover:underline underline-offset-4">
                        {r.name}
                      </Link>
                      <a
                        href={`https://instagram.com/${r.ig_handle}`}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-xs text-ink-soft hover:text-ink"
                      >
                        @{r.ig_handle}
                      </a>
                    </td>
                    <td className="px-4 py-3 min-w-36">
                      <span className="wide text-2xl font-bold">{total}</span>
                      <span className="text-ink-soft"> / {goal}</span>
                      <div className="h-1.5 mt-1.5 bg-rule rounded-full overflow-hidden" aria-hidden>
                        <div className="h-full bg-lime rounded-full" style={{ width: `${Math.min(100, (total / goal) * 100)}%` }} />
                      </div>
                    </td>
                    <td className="px-4 py-3 tnum">{r.posts_this_week ?? 0}</td>
                    <td className="px-4 py-3 tnum">
                      {r.current_streak ? (
                        <span className="rounded-full bg-green text-on-neon px-2.5 py-0.5 font-semibold">
                          {r.current_streak} wk
                        </span>
                      ) : (
                        <span className="text-ink-soft">0</span>
                      )}
                      {r.longest_streak > r.current_streak && (
                        <span className="block text-xs text-ink-soft mt-1">best {r.longest_streak}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 tnum">
                      {r.last_milestone ? <span className="font-semibold text-amber">{r.last_milestone}</span> : '–'}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{day(r.last_post_at) || '–'}</td>
                    <td className="px-4 py-3">
                      {flagged ? (
                        <Link href="/flags" className="text-xs font-semibold rounded-full bg-pink text-on-neon px-2.5 py-0.5 whitespace-nowrap">
                          {OUTCOME_LABEL[r.last_outcome]}
                        </Link>
                      ) : r.last_outcome ? (
                        <span className="text-xs text-ok">OK</span>
                      ) : (
                        <span className="text-xs text-ink-soft">Pending</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/** First day of the last `n` calendar months in IST, oldest first, as YYYY-MM-01. */
function lastMonths(n: number): string[] {
  const [y, m] = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).split('-').map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (n - 1 - i), 1));
    return d.toISOString().slice(0, 10);
  });
}
function monthLabel(m: string): string {
  return new Date(`${m}T00:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', month: 'short' });
}
