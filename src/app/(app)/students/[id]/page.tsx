import Link from 'next/link';
import { notFound } from 'next/navigation';
import { teamClient } from '@/lib/supabase';
import { day, OUTCOME_LABEL, relative } from '@/lib/format';
import { addNote, addPost, deleteNote, rerunStudent, setExcluded } from '@/app/actions';
import { ActionForm } from '@/components/forms';
import { availableMonths, monthRows, pickMonth, studentRows } from '@/lib/stats';
import { daysBetween, monthLabel, pctChange, rank } from '@/lib/period';
import { needs, NEED_LABEL } from '@/lib/needs';
import { LineChart } from '@/components/charts';
import { MonthPicker } from '@/components/month-picker';
import { monthYear } from '@/components/student-cells';
import { compact, Delta, Kpi, monthOption, signed } from '@/components/ui';

const TYPE_LABEL: Record<string, string> = { image: 'Image', carousel: 'Carousel', reel: 'Reel', video: 'Video' };

export default async function StudentPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ month?: string; from?: string; range?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { db } = await teamClient();

  const { data: s } = await db.from('leaderboard').select('*').eq('id', id).maybeSingle();
  if (!s) notFound();

  const { today, months: allMonths } = await availableMonths(db);
  const win = pickMonth(sp.month, allMonths, today);

  const [{ data: posts }, { data: milestones }, { data: scrapes }, { data: handles }, { data: info },
    { data: months }, { data: notes }, { data: history }, { data: snaps }, rows, prevRows, everyone] =
    await Promise.all([
      db.from('posts').select('id, shortcode, post_type, posted_at, url, source, excluded, excluded_reason, views, final_views')
        .eq('student_id', id)
        .gte('posted_at', `${s.start_date}T00:00:00+05:30`).order('posted_at', { ascending: false }),
      db.from('milestones_hit').select('milestone, reached_at').eq('student_id', id).order('milestone'),
      db.from('scrape_results').select('outcome, detail, new_posts, created_at').eq('student_id', id)
        .order('created_at', { ascending: false }).limit(8),
      db.from('handle_history').select('old_handle, new_handle, changed_at').eq('student_id', id)
        .order('changed_at', { ascending: false }),
      db.from('students').select('heartbeat_url, intake_month, contract_months, contract_end, leave_date').eq('id', id).single(),
      db.from('monthly_stats').select('month, posts').eq('student_id', id).order('month', { ascending: false }),
      db.from('student_notes').select('id, kind, body, author, created_at').eq('student_id', id)
        .order('created_at', { ascending: false }),
      db.from('audit_log').select('id, at, actor, action, detail').eq('student_id', id)
        .order('at', { ascending: false }).limit(15),
      db.from('follower_snapshots').select('day, followers').eq('student_id', id).order('day'),
      monthRows(db, win.m, win.upto),
      monthRows(db, win.prev, win.prevUpto),
      studentRows(db),
    ]);
  const counted = (posts ?? []).filter((x) => !x.excluded);
  const excluded = (posts ?? []).filter((x) => x.excluded);
  const now = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).slice(0, 16).replace(' ', 'T');

  // Ranks this month among active students, as on the prototype ("#3 of 100")
  const activeIds = new Set(everyone.filter((x) => x.status === 'active').map((x) => x.id));
  const pool = rows.filter((r) => activeIds.has(r.student_id));
  const me = rows.find((r) => r.student_id === id);
  const prevMe = prevRows.find((r) => r.student_id === id);
  const rankOf = (value: (r: (typeof rows)[number]) => number | null) => {
    const ranked = rank(pool.filter((r) => value(r) !== null), (r) => value(r)!);
    return { rank: ranked.find((x) => x.item.student_id === id)?.rank ?? null, of: ranked.length };
  };
  const rFollowers = rankOf((r) => r.followers_end);
  const rGrowth = rankOf((r) => r.follower_growth);
  const rPosts = rankOf((r) => r.posts);
  const vs = win.current ? `same days of ${monthLabel(win.prev, { short: true })}` : monthLabel(win.prev, { short: true });

  // Prev / next among active students, alphabetical by handle
  const order = everyone.filter((x) => x.status === 'active').sort((a, b) => a.ig_handle.localeCompare(b.ig_handle));
  const at = order.findIndex((x) => x.id === id);
  const qs = (to: string) => `/students/${to}${sp.from ? `?from=${sp.from}` : ''}`;
  const row = everyone.find((x) => x.id === id);
  const why = row ? needs(row) : [];

  const monthsIn = Math.max(1, daysBetween(s.start_date, today) / 30.44);
  const avgPerMonth = counted.length / monthsIn;
  const lastPostDays = row?.noPostDays ?? null;
  const contractLeft = info?.contract_end ? daysBetween(today, info.contract_end) : null;
  const contractTotal = info?.contract_end ? daysBetween(s.start_date, info.contract_end) : null;
  const range = sp.range === 'year' ? 'year' : sp.range === '90' ? '90' : 'all';
  const fromDay = range === 'year' ? `${today.slice(0, 4)}-01-01` : range === '90' ? new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10) : '';
  const chart = (snaps ?? []).filter((x) => x.day >= fromDay).map((x) => ({ day: x.day, value: x.followers }));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-ink-soft">
          <Link href={sp.from === 'attention' ? '/attention' : '/students'} className="hover:text-ink font-bold">
            {sp.from === 'attention' ? 'Needs attention' : 'Students'}
          </Link> › {s.name}
        </p>
        {at >= 0 && (
          <p className="flex items-center gap-2 text-ink-soft">
            {at > 0 && <Link href={qs(order[at - 1].id)} className="chip" aria-label="Previous student">‹</Link>}
            <span className="tnum">{at + 1} of {order.length}</span>
            {at < order.length - 1 && <Link href={qs(order[at + 1].id)} className="chip" aria-label="Next student">›</Link>}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4 mt-2 mb-5">
        <div>
          <h1 className="display text-5xl">{s.name}</h1>
          <p className="text-sm mt-1 flex flex-wrap gap-x-4 gap-y-1">
            <a className="font-bold text-brand hover:underline" href={`https://instagram.com/${s.ig_handle}`} target="_blank" rel="noreferrer">
              @{s.ig_handle} on Instagram ↗
            </a>
            {info?.heartbeat_url
              ? <a className="font-bold text-brand hover:underline" href={info.heartbeat_url} target="_blank" rel="noreferrer">Member page on Heartbeat ↗</a>
              : <Link href={`/roster?edit=${s.id}`} className="text-ink-soft hover:text-ink">Add Heartbeat link</Link>}
          </p>
          <p className="text-sm text-ink-soft mt-2 flex flex-wrap items-center gap-x-2">
            <span>Member since <strong className="text-ink">{monthYear(info?.intake_month ?? s.start_date)}</strong></span>
            <span>· {Math.floor(monthsIn)} mo</span>
            {info?.contract_months && <span>· {info.contract_months}-month contract</span>}
            {s.status === 'left' && info?.leave_date && <span className="font-bold text-ink">· left {day(info.leave_date)}</span>}
          </p>
          {contractLeft !== null && contractTotal && s.status !== 'left' && (
            <div className="flex items-center gap-3 mt-2 text-xs">
              <span className="w-48 h-1.5 bg-rule rounded-full overflow-hidden" aria-hidden>
                <span className="block h-full bg-brand rounded-full"
                  style={{ width: `${Math.min(100, Math.max(0, (1 - contractLeft / contractTotal) * 100))}%` }} />
              </span>
              <span className={`font-bold ${contractLeft <= 30 ? 'text-bad' : 'text-ink-soft'}`}>
                {contractLeft < 0 ? `contract ended ${-contractLeft} days ago` : `${contractLeft} days left`}
              </span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MonthPicker value={win.m.slice(0, 7)}
            options={allMonths.map((m) => ({ value: m.slice(0, 7), label: monthOption(m, m === allMonths[0], today) }))} />
          <ActionForm action={rerunStudent} submit="Re-scrape now" quiet className="[&>div]:mt-0">
            <input type="hidden" name="student_id" value={s.id} />
          </ActionForm>
          <Link href={`/roster?edit=${s.id}`} className="btn btn-quiet">Edit</Link>
        </div>
      </div>

      {why.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {why.map((w) => (
            <Link key={w} href={w === 'data' ? '/troubleshooting' : `/attention?f=${w}`}
              className="text-xs font-bold rounded-full px-2.5 py-1 bg-bad-soft text-bad">
              {w === 'data' ? OUTCOME_LABEL[s.last_outcome ?? 'never_scraped'] : NEED_LABEL[w]}
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        <Kpi label="Followers" value={compact(me?.followers_end ?? null)}>
          {rFollowers.rank && <span className="text-xs text-ink-soft">#{rFollowers.rank} of {rFollowers.of}</span>}
        </Kpi>
        <Kpi label={`Follower growth · ${monthLabel(win.m, { short: true })}`} value={signed(me?.follower_growth ?? null)}
          tone={(me?.follower_growth ?? 0) > 0 ? 'good' : (me?.follower_growth ?? 0) < 0 ? 'bad' : undefined}>
          {rGrowth.rank && <span className="text-xs text-ink-soft">#{rGrowth.rank} of {rGrowth.of}</span>}
          <Delta value={pctChange(me?.follower_growth ?? null, prevMe?.follower_growth ?? null)} suffix="%" vs={vs} />
        </Kpi>
        <Kpi label="Last seen on Heartbeat" value="–"><span className="text-xs text-ink-soft">not connected yet</span></Kpi>
        <Kpi label={`Posts · ${monthLabel(win.m, { short: true })}`} value={me?.posts ?? 0}>
          {rPosts.rank && <span className="text-xs text-ink-soft">#{rPosts.rank} of {rPosts.of}</span>}
          <Delta value={pctChange(me?.posts ?? null, prevMe?.posts ?? null)} suffix="%" vs={vs} />
        </Kpi>
        <Kpi label="Avg. posts per month" value={avgPerMonth.toFixed(1)}>
          <span className="text-xs text-ink-soft">{counted.length} posts since joining</span>
        </Kpi>
        <Kpi label="Days since last post" value={lastPostDays ?? '–'} tone={(lastPostDays ?? 0) >= 14 ? 'bad' : undefined}>
          <span className="text-xs text-ink-soft">{s.last_post_at ? `last ${day(s.last_post_at)}` : 'no post since joining'}</span>
        </Kpi>
      </div>

      <section className="card p-5 mb-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3 mb-2">
          <h2 className="display text-2xl">Follower history</h2>
          <nav aria-label="Range" className="flex gap-1">
            {([['all', 'All time'], ['year', 'This year'], ['90', '90 days']] as const).map(([v, label]) => (
              <Link key={v} href={`/students/${id}?range=${v}${sp.month ? `&month=${sp.month}` : ''}${sp.from ? `&from=${sp.from}` : ''}`}
                aria-current={range === v ? 'page' : undefined} className="chip">{label}</Link>
            ))}
          </nav>
        </div>
        <LineChart title={`Followers of @${s.ig_handle} per day`} points={chart} format={(v) => compact(Math.round(v))} />
      </section>

      <div className="grid lg:grid-cols-[1fr_340px] gap-8">
        <section>
          <h2 className="display text-2xl mt-8 mb-3">Counted posts ({counted.length})</h2>
          {counted.length ? (
            <ul className="card divide-y divide-rule text-sm">
              {counted.map((x) => (
                <li key={x.id} className="px-4 py-2">
                  <details className="group">
                    <summary className="flex justify-between gap-3 cursor-pointer list-none">
                      <a href={x.url} target="_blank" rel="noreferrer" className="hover:underline underline-offset-4">
                        {TYPE_LABEL[x.post_type]} · {day(x.posted_at)}
                        {x.views !== null && <span className="ml-2 text-xs text-ink-soft tnum">{compact(x.final_views ?? x.views)} views{x.final_views === null ? ' so far' : ''}</span>}
                        {x.source === 'manual' && <span className="ml-2 text-xs font-bold text-brand">added by team</span>}
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
              <h2 className="display text-2xl mt-8 mb-3">Excluded ({excluded.length})</h2>
              <ul className="card divide-y divide-rule text-sm">
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

          <section className="card p-5 mt-8">
            <h2 className="display text-2xl">Add a missed post</h2>
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
            <h2 className="display text-2xl mb-3">Notes & contact log</h2>
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
                <li key={n.id} className="border-l-2 border-brand pl-3">
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
            <h2 className="display text-2xl mb-3">Month by month</h2>
            {months?.length ? (
              <ul className="space-y-1.5 text-sm">
                {months.map((m) => (
                  <li key={m.month} className="grid grid-cols-[90px_1fr_32px] items-center gap-3">
                    <span className="text-ink-soft">{monthLabel(m.month, { short: true })}</span>
                    <span className="h-2 bg-rule rounded-full overflow-hidden" aria-hidden>
                      <span className="block h-full rounded-full bg-brand-ink"
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
            <h2 className="display text-2xl mb-3">Milestones</h2>
            {milestones?.length ? (
              <ul className="space-y-2 text-sm">
                {milestones.map((m) => (
                  <li key={m.milestone} className="flex justify-between">
                    <span className="font-bold text-brand">{m.milestone} posts</span>
                    <span className="text-ink-soft">{day(m.reached_at)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-soft">None reached yet.</p>
            )}
          </section>

          <section>
            <h2 className="display text-2xl mb-3">Recent scrapes</h2>
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
              <h2 className="display text-2xl mb-3">Previous handles</h2>
              <ul className="space-y-1 text-sm text-ink-soft">
                {handles.map((h) => (
                  <li key={h.changed_at}>@{h.old_handle} → @{h.new_handle}, {day(h.changed_at)}</li>
                ))}
              </ul>
            </section>
          )}

          {!!history?.length && (
            <section>
              <h2 className="display text-2xl mb-3">Change history</h2>
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
