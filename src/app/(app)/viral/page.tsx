import Link from 'next/link';
import { teamClient } from '@/lib/supabase';
import { availableMonths, pickMonth } from '@/lib/stats';
import { followersOn } from '@/lib/period';
import { parseSort, sortBy } from '@/lib/sort';
import { MonthPicker } from '@/components/month-picker';
import { SortTh, sortHref } from '@/components/sort-header';
import { Empty, monthOption, PageTitle, RankDot, StudentCell } from '@/components/ui';

const longDate = (t: string) =>
  new Date(t).toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', year: 'numeric' });

export default async function ViralReels({ searchParams }: {
  searchParams: Promise<{ all?: string; scope?: string; month?: string; sort?: string; dir?: string }>;
}) {
  const { db } = await teamClient();
  const sp = await searchParams;
  const { today, months } = await availableMonths(db);
  const win = pickMonth(sp.month, months, today);
  const scope = sp.scope === 'month' ? 'month' : 'all';
  const limit = sp.all === '1' ? 100 : 10;
  const sort = parseSort(sp, ['views', 'posted', 'followers'], { key: 'views', dir: 'desc' });

  // Only final (day-7) counts rank here. Students who left keep their Reels on this list.
  let q = db.from('counted_posts')
    .select('id, student_id, url, posted_at, final_views')
    .in('post_type', ['reel', 'video']).not('final_views', 'is', null)
    .order('final_views', { ascending: false }).limit(limit);
  if (scope === 'month') q = q.gte('posted_at', `${win.m}T00:00:00+05:30`).lte('posted_at', `${win.upto}T23:59:59+05:30`);
  const { data: reels } = await q;

  const ids = [...new Set((reels ?? []).map((r) => r.student_id))];
  const [{ data: who }, { data: snaps }] = ids.length
    ? await Promise.all([
      db.from('students').select('id, name, ig_handle, status').in('id', ids),
      db.from('follower_snapshots').select('student_id, day, followers').in('student_id', ids).order('day'),
    ])
    : [{ data: [] }, { data: [] }];
  const byId = new Map((who ?? []).map((s) => [s.id, s]));
  const snapsBy = new Map<string, { day: string; followers: number }[]>();
  for (const s of snaps ?? []) snapsBy.set(s.student_id, [...(snapsBy.get(s.student_id) ?? []), s]);

  const rows = (reels ?? []).map((r, i) => {
    const day = new Date(r.posted_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    return { ...r, place: i + 1, followersThen: followersOn(snapsBy.get(r.student_id) ?? [], day) };
  });
  const shown = sortBy(rows, sort, (r, k) => ({ views: r.final_views, posted: r.posted_at, followers: r.followersThen }[k]));
  const href = sortHref('/viral', { scope, month: sp.month, all: sp.all });
  const tab = (v: string, label: string) => (
    <Link href={`/viral?scope=${v}${sp.month ? `&month=${sp.month}` : ''}`} aria-current={scope === v ? 'page' : undefined} className="chip">{label}</Link>
  );

  return (
    <>
      <PageTitle title="Viral Reels" sub="Views after 7 days">
        <MonthPicker value={win.m.slice(0, 7)}
          options={months.map((m) => ({ value: m.slice(0, 7), label: monthOption(m, m === months[0], today) }))} />
      </PageTitle>
      <div className="card overflow-hidden border-t-4 !border-t-gold">
        <div className="flex gap-2 p-4">{tab('all', 'All time')}{tab('month', 'Selected month')}</div>
        {!shown.length ? (
          <div className="px-4 pb-4"><Empty title="No final view counts yet">A Reel gets its final count 7 days after it’s posted.</Empty></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th><th>Student</th>
                  <SortTh label="Posted" k="posted" sort={sort} href={href} />
                  <SortTh label="Views (7 d)" k="views" sort={sort} href={href} align="right" />
                  <SortTh label="Followers then" k="followers" sort={sort} href={href} align="right" />
                  <th>Reel</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const s = byId.get(r.student_id);
                  return (
                    <tr key={r.id}>
                      <td><RankDot rank={r.place} /></td>
                      <td>
                        {s ? <StudentCell id={s.id} handle={s.ig_handle} name={s.name} /> : '–'}
                        {s?.status === 'left' && <span className="text-xs text-ink-soft">left the academy</span>}
                      </td>
                      <td className="text-ink-soft">{longDate(r.posted_at)}</td>
                      <td className="text-right font-extrabold tnum">{r.final_views!.toLocaleString('en-US')}</td>
                      <td className="text-right tnum">{r.followersThen === null ? '–' : r.followersThen.toLocaleString('en-US')}</td>
                      <td><a href={r.url} target="_blank" rel="noreferrer" className="font-bold text-brand hover:underline">View ↗</a></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {limit === 10 && shown.length === 10 && (
        <p className="mt-3 text-center">
          <Link href={`/viral?all=1&scope=${scope}${sp.month ? `&month=${sp.month}` : ''}`} className="btn btn-quiet">Show all (top 100)</Link>
        </p>
      )}
      <p className="text-xs text-ink-soft mt-3">Instagram only shows view counts for Reels and videos, so photos and carousels aren’t listed.</p>
    </>
  );
}
