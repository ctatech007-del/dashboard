import Link from 'next/link';
import { teamClient } from '@/lib/supabase';
import { availableMonths, joinedLeft, monthRows, pickMonth, studentRows } from '@/lib/stats';
import { average, buckets, monthLabel, pctChange, rank } from '@/lib/period';
import { needs } from '@/lib/needs';
import { ColumnChart } from '@/components/charts';
import { MonthPicker } from '@/components/month-picker';
import { compact, Delta, Kpi, monthOption, PageTitle, RankDot, Section, signed } from '@/components/ui';

export default async function Overview({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { db } = await teamClient();
  const { today, months } = await availableMonths(db);
  const win = pickMonth((await searchParams).month, months, today);
  const vsLabel = win.current
    ? new Date(`${win.prevUpto}T00:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', month: 'short', day: 'numeric' })
    : monthLabel(win.prev, { short: true });

  const chartMonths = months.slice(0, 12).reverse();
  const [rows, prevRows, jl, students, history] = await Promise.all([
    monthRows(db, win.m, win.upto),
    monthRows(db, win.prev, win.prevUpto),
    joinedLeft(db, win.m, win.upto),
    studentRows(db),
    Promise.all(chartMonths.map(async (m) => {
      const w = pickMonth(m.slice(0, 7), months, today);
      return { m, current: w.current, rows: await monthRows(db, w.m, w.upto) };
    })),
  ]);

  const members = (r: typeof rows) => r.filter((x) => x.in_community);
  const avgGrowth = average(members(rows).map((r) => r.follower_growth));
  const avgPosts = average(members(rows).map((r) => r.posts));
  const prevGrowth = average(members(prevRows).map((r) => r.follower_growth));
  const prevPosts = average(members(prevRows).map((r) => r.posts));
  const byId = new Map(students.map((s) => [s.id, s]));

  const active = students.filter((s) => s.status === 'active');
  const summary = [
    { label: 'No post for 14+ days', n: active.filter((s) => needs(s).includes('no_post')).length, href: '/attention?f=no_post&d=14' },
    { label: 'Contract up for renewal within 30 days', n: active.filter((s) => needs(s).includes('contract')).length, href: '/attention?f=contract' },
    { label: 'Profile couldn’t be read', n: active.filter((s) => needs(s).includes('data')).length, href: '/troubleshooting' },
    { label: 'Not seen on Heartbeat for 14+ days', n: null, href: '/attention?f=last_seen' },
  ];

  const growthTop = rank(rows.filter((r) => r.follower_growth !== null && byId.get(r.student_id)?.status === 'active'),
    (r) => r.follower_growth!).slice(0, 5);
  const { data: topPosts } = await db.from('counted_posts')
    .select('id, student_id, url, views, final_views, posted_at')
    .in('post_type', ['reel', 'video'])
    .gte('posted_at', `${win.m}T00:00:00+05:30`).lte('posted_at', `${win.upto}T23:59:59+05:30`)
    .not('views', 'is', null)
    .order('views', { ascending: false }).limit(20);
  const posts = (topPosts ?? [])
    .map((p) => ({ ...p, v: p.final_views ?? p.views ?? 0 }))
    .sort((a, b) => b.v - a.v).slice(0, 5);

  const growthVals = members(rows).map((r) => r.follower_growth).filter((v): v is number => v !== null);
  const postVals = members(rows).map((r) => r.posts);

  return (
    <>
      <PageTitle title="Overview" sub="Community performance by month">
        <MonthPicker value={win.m.slice(0, 7)}
          options={months.map((m) => ({ value: m.slice(0, 7), label: monthOption(m, m === months[0], today) }))} />
      </PageTitle>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Kpi label="Avg. followers gained per student" value={avgGrowth === null ? '–' : signed(Math.round(avgGrowth))}
          tone={avgGrowth !== null && avgGrowth > 0 ? 'good' : undefined}>
          <Delta value={pctChange(avgGrowth, prevGrowth)} suffix="%" vs={vsLabel} />
        </Kpi>
        <Kpi label="Avg. posts per student" value={avgPosts === null ? '–' : avgPosts.toFixed(1)}>
          <Delta value={pctChange(avgPosts, prevPosts)} suffix="%" vs={vsLabel} />
        </Kpi>
        <Kpi label="Avg. Heartbeat logins per student" value="–">
          <span className="text-xs text-ink-soft">Heartbeat not connected yet</span>
        </Kpi>
        <Kpi label="Students in the community" value={members(rows).length}>
          <span className="text-xs font-bold text-good">+{jl.joined} joined</span>
          <span className="text-xs font-bold text-bad">−{jl.left} left</span>
        </Kpi>
      </div>

      <div className="grid lg:grid-cols-3 gap-3 mb-4">
        <Section title="Needs attention" action={<Link href="/attention" className="text-sm font-bold text-brand">View all →</Link>}>
          <ul className="space-y-2">
            {summary.map((s) => (
              <li key={s.label}>
                <Link href={s.href} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-paper">
                  <span className={`text-2xl font-extrabold tnum w-8 ${s.n ? 'text-bad' : 'text-ink-soft'}`}>{s.n ?? '–'}</span>
                  <span className="text-sm">{s.label}{s.n === null && <span className="block text-xs text-ink-soft">once Heartbeat is connected</span>}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Follower growth" action={<Link href="/leaderboard?by=growth" className="text-sm font-bold text-brand">View all →</Link>}>
          {growthTop.length ? (
            <ol className="space-y-2">
              {growthTop.map(({ item, rank: r }) => (
                <li key={item.student_id} className="flex items-center gap-3 text-sm">
                  <RankDot rank={r} />
                  <Link href={`/students/${item.student_id}`} className="flex-1 font-bold truncate hover:underline">
                    @{byId.get(item.student_id)?.ig_handle}
                  </Link>
                  <span className="font-extrabold tnum text-good">{signed(item.follower_growth)}</span>
                </li>
              ))}
            </ol>
          ) : <p className="text-sm text-ink-soft">Needs follower counts from at least two daily scrapes this month.</p>}
        </Section>

        <Section title="Top posts" action={<Link href="/viral" className="text-sm font-bold text-brand">View all →</Link>}>
          {posts.length ? (
            <ol className="space-y-2">
              {posts.map((p, i) => (
                <li key={p.id} className="flex items-center gap-3 text-sm">
                  <RankDot rank={i + 1} />
                  <span className="flex-1 font-bold truncate">@{byId.get(p.student_id)?.ig_handle}</span>
                  <span className="tnum font-extrabold">{compact(p.v)}</span>
                  <a href={p.url} target="_blank" rel="noreferrer" className="text-xs text-ink-soft hover:text-ink">views ↗</a>
                </li>
              ))}
            </ol>
          ) : <p className="text-sm text-ink-soft">No Reels with views in {monthLabel(win.m)} yet.</p>}
        </Section>
      </div>

      <div className="grid lg:grid-cols-2 gap-3 mb-4">
        <Section title="Avg. follower growth per month">
          <ColumnChart title="Average follower growth per student, by month" format={(v) => compact(Math.round(v))}
            data={history.map((h) => ({ label: monthLabel(h.m, { short: true }), partial: h.current,
              value: (() => { const a = average(members(h.rows).map((r) => r.follower_growth)); return a === null ? null : Math.round(a); })() }))} />
        </Section>
        <Section title="Avg. posts per month">
          <ColumnChart title="Average posts per student, by month" format={(v) => (Math.round(v * 10) / 10).toString()}
            data={history.map((h) => ({ label: monthLabel(h.m, { short: true }), partial: h.current,
              value: average(members(h.rows).map((r) => r.posts)) }))} />
        </Section>
      </div>

      <div className="grid lg:grid-cols-2 gap-3">
        <Section title="Follower growth range" action={<span className="text-xs text-ink-soft">{monthLabel(win.m)} · students per bucket</span>}>
          <ColumnChart title={`How many students gained how many followers, ${monthLabel(win.m)}`} format={(v) => String(Math.round(v))}
            data={buckets(growthVals, [-1e12, 0, 100, 500, 1000, 5000],
              (lo, hi) => (lo < 0 ? 'Lost' : hi === null ? `${compact(lo)}+` : `${compact(lo)}–${compact(hi)}`))
              .map((b) => ({ label: b.label, value: b.value }))} />
        </Section>
        <Section title="Posting range" action={<span className="text-xs text-ink-soft">{monthLabel(win.m)} · students per bucket</span>}>
          <ColumnChart title={`How many students posted how often, ${monthLabel(win.m)}`} format={(v) => String(Math.round(v))}
            data={buckets(postVals, [0, 1, 5, 10, 15, 20], (lo, hi) => (hi === null ? `${lo}+` : hi - lo === 1 ? `${lo}` : `${lo}–${hi - 1}`))
              .map((b) => ({ label: `${b.label} posts`, value: b.value }))} />
        </Section>
      </div>
    </>
  );
}
