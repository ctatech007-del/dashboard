import Link from 'next/link';
import { teamClient } from '@/lib/supabase';
import { day, OUTCOME_LABEL } from '@/lib/format';
import { Empty } from '@/components/empty';

export default async function Leaderboard({
  searchParams,
}: { searchParams: Promise<{ batch?: string }> }) {
  const { db } = await teamClient();
  const { batch: wanted } = await searchParams;

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
    db.from('settings').select('milestones, streak_threshold').single(),
  ]);
  const goal = Math.max(...(cfg?.milestones ?? [100]));

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <h1 className="wide text-3xl font-bold">{batch.name}</h1>
          <p className="text-sm text-ink-soft mt-1">
            {rows?.length ?? 0} active students · ranked by total posts since each student&apos;s start date
          </p>
        </div>
        <a className="btn btn-quiet" href={`/api/export?batch=${batch.id}`}>Export CSV</a>
      </div>

      {batches.length > 1 && (
        <nav aria-label="Batches" className="flex flex-wrap gap-2 mb-5">
          {batches.map((b) => (
            <Link
              key={b.id}
              href={`/?batch=${b.id}`}
              aria-current={b.id === batch.id ? 'page' : undefined}
              className={`rounded-full border px-3 py-1 text-sm ${
                b.id === batch.id ? 'border-ink bg-ink text-paper' : 'border-rule bg-surface hover:border-ink'
              }`}
            >
              {b.name}
            </Link>
          ))}
        </nav>
      )}

      {!rows?.length ? (
        <Empty title="No active students in this batch">
          Paused and removed students don&apos;t appear here. Manage them on the{' '}
          <Link className="underline" href="/roster">Roster</Link>.
        </Empty>
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
              {rows.map((r) => {
                const total = r.total_posts ?? 0;
                const flagged = r.last_outcome && r.last_outcome !== 'ok';
                return (
                  <tr key={r.id} className="border-b border-rule last:border-0 hover:bg-paper">
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
                      <div className="h-1 mt-1.5 bg-rule rounded-full overflow-hidden" aria-hidden>
                        <div className="h-full bg-ink" style={{ width: `${Math.min(100, (total / goal) * 100)}%` }} />
                      </div>
                    </td>
                    <td className="px-4 py-3 tnum">{r.posts_this_week ?? 0}</td>
                    <td className="px-4 py-3 tnum">
                      {r.current_streak ? (
                        <span className="rounded bg-amber-soft text-ink px-2 py-0.5 font-semibold">
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
                        <Link href="/flags" className="text-xs font-semibold rounded bg-flag-soft text-flag px-2 py-0.5">
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
