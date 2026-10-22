import Link from 'next/link';
import { notFound } from 'next/navigation';
import { teamClient } from '@/lib/supabase';
import { day, OUTCOME_LABEL, relative, weekLabel } from '@/lib/format';

const TYPE_LABEL: Record<string, string> = { image: 'Image', carousel: 'Carousel', reel: 'Reel', video: 'Video' };

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = await teamClient();

  const { data: s } = await db.from('leaderboard').select('*').eq('id', id).maybeSingle();
  if (!s) notFound();

  const [{ data: weeks }, { data: posts }, { data: milestones }, { data: scrapes }, { data: handles }, { data: cfg }] =
    await Promise.all([
      db.from('weekly_stats').select('week_start, posts').eq('student_id', id)
        .order('week_start', { ascending: false }),
      db.from('posts').select('shortcode, post_type, posted_at, url').eq('student_id', id)
        .gte('posted_at', `${s.start_date}T00:00:00+05:30`).order('posted_at', { ascending: false }),
      db.from('milestones_hit').select('milestone, reached_at').eq('student_id', id).order('milestone'),
      db.from('scrape_results').select('outcome, detail, new_posts, created_at').eq('student_id', id)
        .order('created_at', { ascending: false }).limit(8),
      db.from('handle_history').select('old_handle, new_handle, changed_at').eq('student_id', id)
        .order('changed_at', { ascending: false }),
      db.from('settings').select('streak_threshold').single(),
    ]);

  // Fill gaps so empty weeks show as zeros, from the start week to now.
  const byWeek = new Map((weeks ?? []).map((w) => [w.week_start, w.posts]));
  const allWeeks: { week: string; posts: number }[] = [];
  const start = mondayOf(new Date(`${s.start_date}T00:00:00+05:30`));
  for (let d = mondayOf(new Date()); d >= start; d = new Date(d.getTime() - 7 * 864e5)) {
    const key = isoDate(d);
    allWeeks.push({ week: key, posts: byWeek.get(key) ?? 0 });
  }
  const maxWeek = Math.max(1, ...allWeeks.map((w) => w.posts));
  const threshold = cfg?.streak_threshold ?? 1;

  return (
    <>
      <Link href={`/?batch=${s.batch_id}`} className="text-sm text-ink-soft hover:text-ink">
        ← {s.batch_name} leaderboard
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-4 mt-3 mb-6">
        <div>
          <h1 className="wide text-3xl font-bold">{s.name}</h1>
          <p className="text-sm text-ink-soft mt-1">
            <a className="hover:text-ink" href={`https://instagram.com/${s.ig_handle}`} target="_blank" rel="noreferrer">
              @{s.ig_handle}
            </a>{' '}
            · started {day(s.start_date)} · {s.status}
          </p>
        </div>
        <Link href={`/roster?edit=${s.id}`} className="btn btn-quiet">Edit student</Link>
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-rule border border-rule rounded-lg overflow-hidden mb-8">
        {[
          ['Total posts', s.total_posts ?? 0],
          ['Batch rank', s.batch_rank ?? '–'],
          ['Current streak', `${s.current_streak ?? 0} wk`],
          ['Last milestone', s.last_milestone ?? '–'],
        ].map(([label, value]) => (
          <div key={label} className="bg-surface px-4 py-3">
            <dt className="text-xs text-ink-soft">{label}</dt>
            <dd className="wide text-2xl font-bold mt-1">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid lg:grid-cols-[1fr_320px] gap-8">
        <section>
          <h2 className="wide text-lg font-bold mb-3">Week by week</h2>
          <ol className="bg-surface border border-rule rounded-lg divide-y divide-rule">
            {allWeeks.map((w, i) => (
              <li key={w.week} className="grid grid-cols-[110px_1fr_40px] items-center gap-3 px-4 py-2 text-sm">
                <span className="text-ink-soft">
                  {weekLabel(w.week)}{i === 0 && <span className="block text-xs">this week</span>}
                </span>
                <span className="h-2 bg-paper rounded-full overflow-hidden" aria-hidden>
                  <span
                    className={`block h-full rounded-full ${w.posts >= threshold ? 'bg-ink' : 'bg-flag'}`}
                    style={{ width: `${Math.max(w.posts ? 4 : 0, (w.posts / maxWeek) * 100)}%` }}
                  />
                </span>
                <span className="tnum text-right font-semibold">{w.posts}</span>
              </li>
            ))}
          </ol>

          <h2 className="wide text-lg font-bold mt-8 mb-3">Counted posts ({posts?.length ?? 0})</h2>
          {posts?.length ? (
            <ul className="bg-surface border border-rule rounded-lg divide-y divide-rule text-sm">
              {posts.map((p) => (
                <li key={p.shortcode} className="flex justify-between gap-3 px-4 py-2">
                  <a href={p.url} target="_blank" rel="noreferrer" className="hover:underline underline-offset-4">
                    {TYPE_LABEL[p.post_type]} · {day(p.posted_at)}
                  </a>
                  <span className="text-ink-soft">{p.shortcode}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-soft">No posts counted since the start date yet.</p>
          )}
        </section>

        <aside className="space-y-8">
          <section>
            <h2 className="wide text-lg font-bold mb-3">Milestones</h2>
            {milestones?.length ? (
              <ul className="space-y-2 text-sm">
                {milestones.map((m) => (
                  <li key={m.milestone} className="flex justify-between">
                    <span className="font-semibold text-amber">{m.milestone} posts</span>
                    <span className="text-ink-soft">{day(m.reached_at)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-soft">None reached yet.</p>
            )}
          </section>

          <section>
            <h2 className="wide text-lg font-bold mb-3">Recent scrapes</h2>
            <ul className="space-y-2 text-sm">
              {(scrapes ?? []).map((r) => (
                <li key={r.created_at}>
                  <span className={r.outcome === 'ok' ? 'text-ok' : 'text-flag font-semibold'}>
                    {OUTCOME_LABEL[r.outcome]}
                  </span>{' '}
                  <span className="text-ink-soft">
                    {relative(r.created_at)}
                    {r.outcome === 'ok' && ` · ${r.new_posts} new`}
                  </span>
                  {r.detail && <span className="block text-xs text-ink-soft">{r.detail}</span>}
                </li>
              ))}
              {!scrapes?.length && <li className="text-ink-soft">Not scraped yet.</li>}
            </ul>
          </section>

          {!!handles?.length && (
            <section>
              <h2 className="wide text-lg font-bold mb-3">Previous handles</h2>
              <ul className="space-y-1 text-sm text-ink-soft">
                {handles.map((h) => (
                  <li key={h.changed_at}>@{h.old_handle} → @{h.new_handle}, {day(h.changed_at)}</li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}

function mondayOf(d: Date): Date {
  // Monday 00:00 IST of the week containing d
  const ist = new Date(d.getTime() + 5.5 * 3600_000);
  const dow = (ist.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() - dow) - 5.5 * 3600_000);
}
function isoDate(d: Date): string {
  return new Date(d.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
}
