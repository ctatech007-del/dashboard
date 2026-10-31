import Link from 'next/link';
import { teamClient } from '@/lib/supabase';
import { studentRows, type StudentRow } from '@/lib/stats';
import { parseSort, sortBy } from '@/lib/sort';
import { ContractEnds, Followers, Growth, LastContact, LastSeen, NoPost } from '@/components/student-cells';
import { SortTh, sortHref } from '@/components/sort-header';
import { Empty, PageTitle, StudentCell } from '@/components/ui';

const TABS = [['active', 'Active'], ['former', 'Former'], ['all', 'All']] as const;
const KEYS = ['student', 'followers', 'growth', 'posts', 'nopost', 'seen', 'contact', 'contract'];
const value = (s: StudentRow, k: string) => ({
  student: s.ig_handle, followers: s.followers, growth: s.growth30, posts: s.posts30, nopost: s.noPostDays,
  seen: s.lastSeenDays, contact: s.lastNote?.created_at ?? null, contract: s.contractDays,
}[k]);

export default async function Students({ searchParams }: {
  searchParams: Promise<{ show?: string; q?: string; sort?: string; dir?: string }>;
}) {
  const { db } = await teamClient();
  const sp = await searchParams;
  const show = sp.show ?? 'active', q = sp.q ?? '';
  const sort = parseSort(sp, KEYS, { key: 'student', dir: 'asc' });
  const all = await studentRows(db);
  const counts = { active: all.filter((s) => s.status !== 'left').length, former: all.filter((s) => s.status === 'left').length };
  const needle = q.trim().toLowerCase().replace(/^@/, '');
  const list = sortBy(all
    .filter((s) => (show === 'all' ? true : show === 'former' ? s.status === 'left' : s.status !== 'left'))
    .filter((s) => !needle || s.ig_handle.includes(needle) || s.name.toLowerCase().includes(needle)), sort, value);
  const href = sortHref('/students', { show, q });
  const exact = needle && list.length === 1 && list[0].ig_handle === needle;

  return (
    <>
      <PageTitle title="Students" sub={`${counts.active} active · ${counts.former} former`}>
        <form className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="show" value={show} />
          <input name="q" defaultValue={q} placeholder="Filter by name or handle" className="field !w-56 !py-1.5 !rounded-full" />
          <nav aria-label="Show" className="flex gap-1">
            {TABS.map(([v, label]) => (
              <Link key={v} href={`/students?show=${v}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
                aria-current={show === v ? 'page' : undefined} className="chip">{label}</Link>
            ))}
          </nav>
        </form>
      </PageTitle>

      {exact && <p className="mb-3"><Link href={`/students/${list[0].id}`} className="btn">Open @{list[0].ig_handle} →</Link></p>}

      {!list.length ? (
        <Empty title={needle ? `No student matches “${q}”` : 'No students here yet'}>
          {needle ? 'Search by Instagram handle or name.' : <>Add students on the <Link href="/roster" className="underline">Roster</Link> page.</>}
        </Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <SortTh label="Student" k="student" sort={sort} href={href} firstDir="asc" />
                <SortTh label="Followers" sub="today" k="followers" sort={sort} href={href} align="right" />
                <SortTh label="Growth" sub="30 days" k="growth" sort={sort} href={href} align="right" />
                <SortTh label="Posts" sub="30 days" k="posts" sort={sort} href={href} align="right" />
                <SortTh label="No post" sub="for" k="nopost" sort={sort} href={href} align="right" />
                <SortTh label="Last seen" sub="heartbeat" k="seen" sort={sort} href={href} align="right" />
                <SortTh label="Last contact" sub="contact log" k="contact" sort={sort} href={href} align="right" />
                <SortTh label="Contract" sub="ends in" k="contract" sort={sort} href={href} firstDir="asc" align="right" />
              </tr>
            </thead>
            <tbody>
              {list.map((s, i) => (
                <tr key={s.id} className={s.status === 'left' ? 'opacity-70' : ''}>
                  <td className="text-ink-soft tnum">{i + 1}</td>
                  <td><StudentCell id={s.id} handle={s.ig_handle} name={s.name} /></td>
                  <td className="text-right"><Followers s={s} /></td>
                  <td className="text-right"><Growth s={s} /></td>
                  <td className="text-right tnum font-bold">{s.status === 'left' ? '–' : s.posts30}</td>
                  <td className="text-right"><NoPost s={s} /></td>
                  <td className="text-right"><LastSeen s={s} /></td>
                  <td className="text-right"><LastContact s={s} /></td>
                  <td className="text-right"><ContractEnds s={s} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
