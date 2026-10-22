import Link from 'next/link';
import { notFound } from 'next/navigation';
import { teamClient } from '@/lib/supabase';
import { day, OUTCOME_LABEL, relative, weekLabel } from '@/lib/format';
import { pace, reasons, REASON_LABEL, rulesFrom } from '@/lib/attention';
import { addNote, addPost, deleteNote, rerunStudent, setExcluded } from '@/app/actions';
import { ActionForm } from '@/components/forms';

const TYPE_LABEL: Record<string, string> = { image: 'Image', carousel: 'Carousel', reel: 'Reel', video: 'Video' };

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = await teamClient();

  const { data: s } = await db.from('leaderboard').select('*').eq('id', id).maybeSingle();
  if (!s) notFound();

  const [{ data: weeks }, { data: posts }, { data: milestones }, { data: scrapes }, { data: handles }, { data: cfg },
    { data: months }, { data: notes }, { data: history }] =
    await Promise.all([
      db.from('weekly_stats').select('week_start, posts').eq('student_id', id)
        .order('week_start', { ascending: false }),
      db.from('posts').select('id, shortcode, post_type, posted_at, url, source, excluded, excluded_reason')
        .eq('student_id', id)
        .gte('posted_at', `${s.start_date}T00:00:00+05:30`).order('posted_at', { ascending: false }),
      db.from('milestones_hit').select('milestone, reached_at').eq('student_id', id).order('milestone'),
      db.from('scrape_results').select('outcome, detail, new_posts, created_at').eq('student_id', id)
        .order('created_at', { ascending: false }).limit(8),
      db.from('handle_history').select('old_handle, new_handle, changed_at').eq('student_id', id)
        .order('changed_at', { ascending: false }),
      db.from('settings').select('streak_threshold, milestones, quiet_days, challenge_weeks').single(),
      db.from('monthly_stats').select('month, posts').eq('student_id', id).order('month', { ascending: false }),
      db.from('student_notes').select('id, kind, body, author, created_at').eq('student_id', id)
        .order('created_at', { ascending: false }),
      db.from('audit_log').select('id, at, actor, action, detail').eq('student_id', id)
        .order('at', { ascending: false }).limit(15),
    ]);
  const rules = rulesFrom(cfg);
  const why = reasons(s, rules);
  const plan = pace(s, rules);
  const counted = (posts ?? []).filter((x) => !x.excluded);
  const excluded = (posts ?? []).filter((x) => x.excluded);
  const now = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).slice(0, 16).replace(' ', 'T');

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
          <h1 className="wide text-3xl md:text-4xl font-bold">{s.name}</h1>
          <p className="text-sm text-ink-soft mt-1">
            <a className="hover:text-ink" href={`https://instagram.com/${s.ig_handle}`} target="_blank" rel="noreferrer">
              @{s.ig_handle}
            </a>{' '}
            · started {day(s.start_date)} · {s.status}
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <ActionForm action={rerunStudent} submit="Re-scrape now" quiet className="[&>div]:mt-0">
            <input type="hidden" name="student_id" value={s.id} />
          </ActionForm>
          <Link href={`/roster?edit=${s.id}`} className="btn btn-quiet">Edit student</Link>
        </div>
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          ['Total posts', s.total_posts ?? 0, 'bg-lime'],
          ['Batch rank', s.batch_rank ?? '–', 'bg-pink'],
          ['Current streak', `${s.current_streak ?? 0} wk`, 'bg-green'],
          ['Last milestone', s.last_milestone ?? '–', 'bg-blue'],
        ].map(([label, value, bg]) => (
          <div key={label} className={`neon ${bg} px-5 py-4`}>
            <dt className="wide text-sm font-bold">{label}</dt>
            <dd className="wide text-4xl font-bold mt-2">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="bg-surface border border-rule rounded-lg px-5 py-4 mb-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <span className="tnum">
          <strong className="wide">{plan.perWeek.toFixed(1)}</strong> <span className="text-ink-soft">posts / week</span>
        </span>
        <span className="tnum">
          <span className="text-ink-soft">On course for {rules.goal}:</span>{' '}
          <strong>{(s.total_posts ?? 0) >= rules.goal ? 'done' : plan.finish ? day(plan.finish.toISOString()) : 'no posts yet'}</strong>
        </span>
        <span className="tnum text-ink-soft">
          Should have ~{Math.round(plan.expected)} by now ({rules.challengeWeeks}-week plan)
        </span>
        {why.map((w) => (
          <Link key={w} href="/flags" className="text-xs font-semibold rounded-full px-2.5 py-0.5 bg-pink text-on-neon">
            {REASON_LABEL[w]}
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-8">
        <section>
          <h2 className="wide text-lg font-bold mb-3">Week by week</h2>
          <ol className="bg-surface border border-rule rounded-lg divide-y divide-rule">
            {allWeeks.map((w, i) => (
              <li key={w.week} className="grid grid-cols-[110px_1fr_40px] items-center gap-3 px-4 py-2 text-sm">
                <span className="text-ink-soft">
                  {weekLabel(w.week)}{i === 0 && <span className="block text-xs">this week</span>}
                </span>
                <span className="h-2 bg-rule rounded-full overflow-hidden" aria-hidden>
                  <span
                    className={`block h-full rounded-full ${w.posts >= threshold ? 'bg-green' : 'bg-pink'}`}
                    style={{ width: `${Math.max(w.posts ? 4 : 0, (w.posts / maxWeek) * 100)}%` }}
                  />
                </span>
                <span className="tnum text-right font-semibold">{w.posts}</span>
              </li>
            ))}
          </ol>

          <h2 className="wide text-lg font-bold mt-8 mb-3">Counted posts ({counted.length})</h2>
          {counted.length ? (
            <ul className="bg-surface border border-rule rounded-lg divide-y divide-rule text-sm">
              {counted.map((x) => (
                <li key={x.id} className="px-4 py-2">
                  <details className="group">
                    <summary className="flex justify-between gap-3 cursor-pointer list-none">
                      <a href={x.url} target="_blank" rel="noreferrer" className="hover:underline underline-offset-4">
                        {TYPE_LABEL[x.post_type]} · {day(x.posted_at)}
                        {x.source === 'manual' && <span className="ml-2 text-xs text-lime">added by team</span>}
                      </a>
                      <span className="text-xs text-ink-soft group-open:text-ink">Exclude…</span>
                    </summary>
                    <ActionForm action={setExcluded} submit="Don’t count this post" className="mt-2">
                      <input type="hidden" name="post_id" value={x.id} />
                      <input type="hidden" name="excluded" value="true" />
                      <input name="reason" required placeholder="Why? e.g. reposted someone else’s content" className="field" />
                    </ActionForm>
                  </details>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-soft">No posts counted since the start date yet.</p>
          )}

          {!!excluded.length && (
            <>
              <h2 className="wide text-lg font-bold mt-8 mb-3">Excluded ({excluded.length})</h2>
              <ul className="bg-surface border border-rule rounded-lg divide-y divide-rule text-sm">
                {excluded.map((x) => (
                  <li key={x.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2">
                    <span>
                      <a href={x.url} target="_blank" rel="noreferrer" className="line-through text-ink-soft hover:text-ink">
                        {TYPE_LABEL[x.post_type]} · {day(x.posted_at)}
                      </a>
                      <span className="block text-xs text-ink-soft">{x.excluded_reason}</span>
                    </span>
                    <ActionForm action={setExcluded} submit="Count it again" quiet className="[&>div]:mt-0">
                      <input type="hidden" name="post_id" value={x.id} />
                      <input type="hidden" name="excluded" value="false" />
                    </ActionForm>
                  </li>
                ))}
              </ul>
            </>
          )}

          <section className="bg-surface border border-rule rounded-lg p-5 mt-8">
            <h2 className="wide text-lg font-bold">Add a missed post</h2>
            <p className="text-sm text-ink-soft mt-1 mb-4">
              For a post the scraper didn’t pick up. It counts straight away and is marked “added by team”.
            </p>
            <ActionForm action={addPost} submit="Add post" resetOnSuccess>
              <input type="hidden" name="student_id" value={s.id} />
              <div className="grid sm:grid-cols-[1fr_auto_auto] gap-3">
                <input name="url" required placeholder="https://www.instagram.com/p/…" className="field" aria-label="Post link" />
                <input name="posted_at" type="datetime-local" required max={now} className="field" aria-label="Posted at (IST)" />
                <select name="post_type" className="field" aria-label="Type" defaultValue="image">
                  {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </ActionForm>
          </section>
        </section>

        <aside className="space-y-8">
          <section>
            <h2 className="wide text-lg font-bold mb-3">Notes & contact log</h2>
            <ActionForm action={addNote} submit="Save note" resetOnSuccess>
              <input type="hidden" name="student_id" value={s.id} />
              <div className="space-y-2">
                <select name="kind" className="field" aria-label="Kind" defaultValue="note">
                  <option value="note">Note</option>
                  <option value="call">Call</option>
                  <option value="message">Message</option>
                  <option value="email">Email</option>
                  <option value="meeting">Meeting</option>
                </select>
                <textarea name="body" required rows={3} placeholder="e.g. Called, travelling this week, back to posting Monday"
                  className="field" aria-label="Note" />
              </div>
            </ActionForm>
            <ul className="space-y-3 mt-5 text-sm">
              {(notes ?? []).map((n) => (
                <li key={n.id} className="border-l-2 border-lime pl-3">
                  <p className="whitespace-pre-line">{n.body}</p>
                  <p className="text-xs text-ink-soft mt-1">
                    <span className="capitalize">{n.kind}</span> · {n.author} · {relative(n.created_at)}
                  </p>
                  <form action={deleteNote}>
                    <input type="hidden" name="note_id" value={n.id} />
                    <input type="hidden" name="student_id" value={s.id} />
                    <button className="text-xs text-ink-soft underline underline-offset-4 hover:text-ink">Delete</button>
                  </form>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="wide text-lg font-bold mb-3">Month by month</h2>
            {months?.length ? (
              <ul className="space-y-1.5 text-sm">
                {months.map((m) => (
                  <li key={m.month} className="grid grid-cols-[90px_1fr_32px] items-center gap-3">
                    <span className="text-ink-soft">{monthLabel(m.month)}</span>
                    <span className="h-2 bg-rule rounded-full overflow-hidden" aria-hidden>
                      <span className="block h-full rounded-full bg-blue"
                        style={{ width: `${(m.posts / Math.max(...months.map((x) => x.posts))) * 100}%` }} />
                    </span>
                    <span className="tnum text-right font-semibold">{m.posts}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-soft">No posts yet.</p>
            )}
          </section>

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

          {!!history?.length && (
            <section>
              <h2 className="wide text-lg font-bold mb-3">Change history</h2>
              <ul className="space-y-2 text-xs text-ink-soft">
                {history.map((h) => (
                  <li key={h.id}>
                    <span className="text-ink">{describe(h.action, h.detail)}</span>
                    <span className="block">{h.actor} · {relative(h.at)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}

function monthLabel(m: string): string {
  return new Date(`${m}T00:00:00+05:30`).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', month: 'short', year: 'numeric' });
}

/** One line for an audit entry, e.g. "Excluded a post: story repost". */
function describe(action: string, detail: Record<string, { from: unknown; to: unknown }> | null): string {
  const d = detail ?? {};
  if (action === 'posts.insert') return 'Added a missed post';
  if (action === 'posts.update') {
    return d.excluded?.to ? `Excluded a post: ${d.excluded_reason?.to ?? ''}` : 'Counted an excluded post again';
  }
  if (action === 'students.insert') return 'Added to the roster';
  const fields = Object.keys(d).filter((k) => k !== 'ig_user_id');
  if (!fields.length) return 'Instagram account linked by the scraper';
  return `Changed ${fields.map((k) => `${k.replace(/_/g, ' ')} (${String(d[k].from ?? '–')} → ${String(d[k].to ?? '–')})`).join(', ')}`;
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
