import Link from 'next/link';
import { teamClient } from '@/lib/supabase';
import { studentRows } from '@/lib/stats';
import { addDays, boardValue, istToday, move, rank, type Board, type Period } from '@/lib/period';
import { compact, Empty, PageTitle, RankDot, signed, StudentCell } from '@/components/ui';

const BOARDS: [Board, string][] = [['followers', 'Followers'], ['growth', 'Follower growth'], ['posts', 'Posts']];
const PERIODS: [Period, string][] = [['1d', '1 day'], ['7d', '7 days'], ['30d', '30 days'], ['month', 'This month']];

export default async function Leaderboard({ searchParams }: { searchParams: Promise<{ by?: string; period?: string }> }) {
  const { db } = await teamClient();
  const sp = await searchParams;
  const by = (BOARDS.find(([b]) => b === sp.by)?.[0] ?? 'growth') as Board;
  const period = (PERIODS.find(([p]) => p === sp.period)?.[0] ?? 'month') as Period;
  const today = istToday();
  const since = addDays(today, -62);

  const students = (await studentRows(db)).filter((s) => s.status === 'active');
  const ids = students.map((s) => s.id);
  const [{ data: snaps }, { data: posts }] = await Promise.all([
    db.from('follower_snapshots').select('student_id, day, followers').in('student_id', ids).gte('day', since).order('day'),
    db.from('counted_posts').select('student_id, posted_at').in('student_id', ids).gte('posted_at', `${since}T00:00:00+05:30`),
  ]);
  const snapsBy = new Map<string, { day: string; followers: number }[]>();
  for (const s of snaps ?? []) snapsBy.set(s.student_id, [...(snapsBy.get(s.student_id) ?? []), s]);
  const postsBy = new Map<string, string[]>();
  for (const p of posts ?? []) {
    const d = new Date(p.posted_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    postsBy.set(p.student_id, [...(postsBy.get(p.student_id) ?? []), d]);
  }

  const values = (day: string, board: Board) => students.map((s) => ({
    s, v: boardValue(board, period, day, snapsBy.get(s.id) ?? [], postsBy.get(s.id) ?? [], s.start_date),
  }));
  const ranked = (day: string) => rank(values(day, by).filter((x) => x.v !== null), (x) => x.v!);
  const now = ranked(today);
  const before = new Map(ranked(addDays(today, -1)).map((x) => [x.item.s.id, x.rank]));
  const growth = new Map(values(today, 'growth').map((x) => [x.s.id, x.v]));
  const postCount = new Map(values(today, 'posts').map((x) => [x.s.id, x.v]));
  const link = (b: Board, p: Period) => `/leaderboard?by=${b}&period=${p}`;

  return (
    <>
      <PageTitle title="Leaderboard" sub="Live · updated daily · active students only" />
      <div className="card p-3 mb-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="font-bold text-ink-soft px-1">Rank by</span>
        {BOARDS.map(([b, label]) => <Link key={b} href={link(b, period)} aria-current={by === b ? 'page' : undefined} className="chip">{label}</Link>)}
        <span className="font-bold text-ink-soft px-1 ml-3">Period</span>
        {PERIODS.map(([p, label]) => <Link key={p} href={link(by, p)} aria-current={period === p ? 'page' : undefined} className="chip">{label}</Link>)}
      </div>

      {!now.length ? (
        <Empty title="No rankings yet">They appear after the daily scrape has collected follower counts.</Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>#</th><th>Student</th><th>Followers</th>
                <th>Growth<small>{PERIODS.find(([p]) => p === period)?.[1]}</small></th>
                <th>Posts<small>{PERIODS.find(([p]) => p === period)?.[1]}</small></th>
                <th title="Rank change since yesterday">Move</th>
              </tr>
            </thead>
            <tbody>
              {now.map(({ item, rank: r }) => {
                const m = move(r, before.get(item.s.id));
                const g = growth.get(item.s.id) ?? null;
                return (
                  <tr key={item.s.id}>
                    <td><RankDot rank={r} /></td>
                    <td><StudentCell id={item.s.id} handle={item.s.ig_handle} name={item.s.name} /></td>
                    <td className="font-extrabold tnum">{compact(item.s.followers)}</td>
                    <td className={`font-bold tnum ${g === null ? 'text-ink-soft' : g > 0 ? 'text-good' : g < 0 ? 'text-bad' : ''}`}>{signed(g)}</td>
                    <td className="tnum font-bold">{postCount.get(item.s.id) ?? 0}</td>
                    <td>
                      {m === null ? <span className="text-xs font-bold text-brand">NEW</span>
                        : m === 0 ? <span className="text-ink-soft">–</span>
                          : <span className={`text-xs font-bold rounded-full px-2 py-0.5 ${m > 0 ? 'bg-good-soft text-good' : 'bg-bad-soft text-bad'}`}>
                            {m > 0 ? '▲' : '▼'} {Math.abs(m)}
                          </span>}
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
