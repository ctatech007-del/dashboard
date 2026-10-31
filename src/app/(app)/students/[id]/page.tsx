import Link from 'next/link';
import { notFound } from 'next/navigation';
import { teamClient } from '@/lib/supabase';
import { day, OUTCOME_LABEL, relative } from '@/lib/format';
import { addNote, addPost, deleteNote, rerunStudent, setExcluded } from '@/app/actions';
import { ActionForm } from '@/components/forms';
import { availableMonths, monthRows, pickMonth, studentRows } from '@/lib/stats';
import { addDays, addMonths, daysBetween, followersOn, monthEnd, monthLabel, monthStart, rank } from '@/lib/period';
import { needs, NEED_LABEL } from '@/lib/needs';
import { ColumnChart, LineChart } from '@/components/charts';
import { MonthPicker } from '@/components/month-picker';
import { monthYear } from '@/components/student-cells';
import { compact, Kpi, monthOption, signed } from '@/components/ui';

const longDate = (d: string) =>
  new Date(`${d.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });

/** "#43 of 100 ▲2" */
function RankLine({ r }: { r: { rank: number | null; of: number; moved: number | null } }) {
  if (!r.rank) return null;
  return (
    <span className="flex items-center gap-1.5 text-xs text-ink-soft">
      #{r.rank} of {r.of}
      {r.moved !== null && r.moved !== 0 && (
        <span className={`font-bold rounded-full px-1.5 py-0.5 ${r.moved > 0 ? 'bg-good-soft text-good' : 'bg-bad-soft text-bad'}`}>
          {r.moved > 0 ? '▲' : '▼'} {Math.abs(r.moved)}
        </span>
      )}
    </span>
  );
}

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

  const [{ data: posts }, { data: scrapes }, { data: handles }, { data: info },
    { data: notes }, { data: history }, { data: snaps }, rows, prevRows, everyone] =
    await Promise.all([
      db.from('posts').select('id, shortcode, post_type, posted_at, url, source, excluded, excluded_reason, views, final_views')
        .eq('student_id', id)
        .gte('posted_at', `${s.start_date}T00:00:00+05:30`).order('posted_at', { ascending: false }),
      db.from('scrape_results').select('outcome, detail, new_posts, created_at').eq('student_id', id)
        .order('created_at', { ascending: false }).limit(8),
      db.from('handle_history').select('old_handle, new_handle, changed_at').eq('student_id', id)
        .order('changed_at', { ascending: false }),
      db.from('students').select('heartbeat_url, intake_month, contract_months, contract_end, leave_date').eq('id', id).single(),
      db.from('student_notes').select('id, body, author, created_at, contact_date').eq('student_id', id)
        .order('contact_date', { ascending: false }).order('created_at', { ascending: false }),
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
  const prevPool = prevRows.filter((r) => activeIds.has(r.student_id));
  // "#43 of 100 ▲2": rank now, and how many places they moved since the comparison period
  const rankOf = (value: (r: (typeof rows)[number]) => number | null) => {
    const place = (list: typeof rows) => rank(list.filter((r) => value(r) !== null), (r) => value(r)!);
    const now = place(pool), before = place(prevPool);
    const r = now.find((x) => x.item.student_id === id)?.rank ?? null;
    const p = before.find((x) => x.item.student_id === id)?.rank ?? null;
    return { rank: r, of: now.length, moved: r !== null && p !== null ? p - r : null };
  };
  const rFollowers = rankOf((r) => r.followers_end);
  const rGrowth = rankOf((r) => r.follower_growth);
  const rPosts = rankOf((r) => r.posts);

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
  const RANGES = [['all', 'All time'], ['year', 'This year'], ['6m', 'Last 6 months'], ['1y', 'Last year']] as const;
  const range = RANGES.find(([v]) => v === sp.range)?.[0] ?? 'all';
  const fromDay = { all: '', year: `${today.slice(0, 4)}-01-01`, '6m': addMonths(monthStart(today), -5), '1y': addDays(today, -365) }[range];
  const chart = (snaps ?? []).filter((x) => x.day >= fromDay).map((x) => ({ day: x.day, value: x.followers }));

  // Per month for this student, last 12 months (or since joining)
  const months12 = Array.from({ length: 12 }, (_, i) => addMonths(monthStart(today), i - 11))
    .filter((m) => m >= monthStart(s.start_date));
  const istDay = (t: string) => new Date(t).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const perMonth = months12.map((m) => {
    const end = monthEnd(m) < today ? monthEnd(m) : today;
    const f0 = followersOn(snaps ?? [], m) ?? (snaps ?? []).find((x) => x.day >= m && x.day <= end)?.followers ?? null;
    const f1 = followersOn(snaps ?? [], end);
    return {
      m, current: m === monthStart(today),
      growth: f0 === null || f1 === null ? null : f1 - f0,
      posts: counted.filter((x) => istDay(x.posted_at).slice(0, 7) === m.slice(0, 7)).length,
    };
  });
  const reels = counted.filter((x) => x.views !== null)
    .map((x) => ({ ...x, v: x.final_views ?? x.views! })).sort((a, b) => b.v - a.v).slice(0, 10);

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
          <p className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 rounded-full border border-rule bg-surface px-4 py-1.5 text-sm text-ink-soft">
            <span>Member since <strong className="text-ink">{monthYear(info?.intake_month ?? s.start_date)}</strong> · {Math.floor(monthsIn)} mo</span>
            {info?.contract_months && <span>{info.contract_months}-month contract</span>}
            {s.status === 'left' && info?.leave_date
              ? <strong className="text-ink">Left {day(info.leave_date)}</strong>
              : contractLeft !== null && contractTotal ? (
                <>
                  <span className="w-28 h-1.5 bg-rule rounded-full overflow-hidden" aria-hidden>
                    <span className={`block h-full rounded-full ${contractLeft <= 30 ? 'bg-bad' : 'bg-brand'}`}
                      style={{ width: `${Math.min(100, Math.max(0, (1 - contractLeft / contractTotal) * 100))}%` }} />
                  </span>
                  <span>
                    <strong className={contractLeft <= 30 ? 'text-bad' : 'text-ink'}>
                      {contractLeft < 0 ? `ended ${-contractLeft} days ago` : `${contractLeft} days left`}
                    </strong> · ends {longDate(info!.contract_end!)}
                  </span>
                </>
              ) : <Link href={`/roster?edit=${s.id}`} className="hover:text-ink">Add contract end date</Link>}
          </p>
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
          <RankLine r={rFollowers} />
        </Kpi>
        <Kpi label="Follower growth" value={signed(me?.follower_growth ?? null)}
          tone={(me?.follower_growth ?? 0) > 0 ? 'good' : (me?.follower_growth ?? 0) < 0 ? 'bad' : undefined}>
          <RankLine r={rGrowth} />
        </Kpi>
        <Kpi label="Last seen on Heartbeat" value="–"><span className="text-xs text-ink-soft">not connected yet</span></Kpi>
        <Kpi label="Posts" value={me?.posts ?? 0}>
          <RankLine r={rPosts} />
        </Kpi>
        <Kpi label="Avg. posts per month" value={<>{avgPerMonth.toFixed(1)} <span className="text-sm font-semibold text-ink-soft">/ month</span></>}>
          <span className="text-xs text-ink-soft">{counted.length} posts total</span>
        </Kpi>
        <Kpi label="Days since last post" tone={(lastPostDays ?? 0) >= 14 ? 'bad' : undefined}
          value={lastPostDays === null ? '–' : <>{lastPostDays} <span className="text-sm font-semibold text-ink-soft">days</span></>}>
          {!s.last_post_at && <span className="text-xs text-ink-soft">no post since joining</span>}
        </Kpi>
      </div>

      <section className="card p-5 mb-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3 mb-2">
          <h2 className="display text-2xl">Follower history</h2>
          <nav aria-label="Range" className="flex gap-1">
            {RANGES.map(([v, label]) => (
              <Link key={v} href={`/students/${id}?range=${v}${sp.month ? `&month=${sp.month}` : ''}${sp.from ? `&from=${sp.from}` : ''}`}
                aria-current={range === v ? 'page' : undefined} className="chip">{label}</Link>
            ))}
          </nav>
        </div>
        <LineChart title={`Followers of @${s.ig_handle} per day`} points={chart} format={(v) => compact(Math.round(v))} />
      </section>

      <div className="grid lg:grid-cols-2 gap-3 mb-4">
        <section className="card p-5">
          <h2 className="display text-2xl">Follower growth per month</h2>
          <p className="text-xs text-ink-soft mb-2">{monthLabel(months12[0])} – {monthLabel(months12[months12.length - 1])}</p>
          <ColumnChart title={`Follower growth of @${s.ig_handle} per month`} format={(v) => compact(Math.round(v))}
            color="#2f8f52" tint="#a9d3b5"
            data={perMonth.map((x) => ({ label: monthLabel(x.m, { short: true }), value: x.growth, partial: x.current }))} />
        </section>
        <section className="card p-5">
          <h2 className="display text-2xl">Posts per month</h2>
          <p className="text-xs text-ink-soft mb-2">{monthLabel(months12[0])} – {monthLabel(months12[months12.length - 1])}</p>
          <ColumnChart title={`Posts by @${s.ig_handle} per month`} format={(v) => String(Math.round(v))}
            color="#d9661a" tint="#f2c3a0"
            data={perMonth.map((x) => ({ label: monthLabel(x.m, { short: true }), value: x.posts, partial: x.current }))} />
        </section>
      </div>

      <details className="card mb-4 border-t-4 !border-t-gold">
        <summary className="flex flex-wrap items-baseline gap-3 px-5 py-4 cursor-pointer list-none">
          <h2 className="display text-2xl">Best Reels</h2>
          <span className="text-sm text-ink-soft">
            {reels[0] ? <>Top: <strong className="text-ink">{compact(reels[0].v)} views</strong> · {longDate(istDay(reels[0].posted_at))}</> : 'No Reels yet'}
          </span>
          <span className="ml-auto text-xs text-ink-soft">▾</span>
        </summary>
        {!!reels.length && (
          <ol className="px-5 pb-4 space-y-1.5 text-sm">
            {reels.map((r, i) => (
              <li key={r.id} className="flex items-center gap-3">
                <span className="w-5 text-ink-soft tnum">{i + 1}</span>
                <span className="flex-1">{longDate(istDay(r.posted_at))}</span>
                <span className="font-extrabold tnum">{compact(r.v)} views{r.final_views === null && <span className="font-semibold text-ink-soft"> so far</span>}</span>
                <a href={r.url} target="_blank" rel="noreferrer" className="font-bold text-brand hover:underline">View ↗</a>
              </li>
            ))}
          </ol>
        )}
      </details>

      <section className="card p-5 mb-8">
        <h2 className="display text-2xl">Contact log</h2>
        <p className="text-sm text-ink-soft mb-3">Notes for the team: calls, messages, how they’re doing</p>
        <ActionForm action={addNote} submit="Add note" resetOnSuccess className="flex flex-wrap items-start gap-3 [&>div]:mt-0">
          <input type="hidden" name="student_id" value={s.id} />
          <textarea name="body" required rows={2} placeholder="e.g. Wrote her on Heartbeat, feels motivated again"
            className="field flex-1 min-w-64 !border-dashed" aria-label="Note" />
          <input name="contact_date" type="date" required defaultValue={today} max={today} className="field !w-40" aria-label="Date" />
        </ActionForm>
        {notes?.length ? (
          <ul className="space-y-3 mt-5 text-sm">
            {notes.map((n) => (
              <li key={n.id} className="border-l-2 border-brand pl-3">
                <p className="whitespace-pre-line">{n.body}</p>
                <p className="text-xs text-ink-soft mt-1 flex items-center gap-2">
                  {longDate(n.contact_date)} · {n.author}
                  <form action={deleteNote} className="inline">
                    <input type="hidden" name="note_id" value={n.id} />
                    <input type="hidden" name="student_id" value={s.id} />
                    <button className="underline underline-offset-4 hover:text-ink">Delete</button>
                  </form>
                </p>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-ink-soft text-center mt-5">No notes yet.</p>}
      </section>

      <details className="mb-4">
        <summary className="cursor-pointer text-sm font-bold text-ink-soft hover:text-ink mb-4">Posts, corrections and history</summary>

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
      </details>
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
