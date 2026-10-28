import Link from 'next/link';
import { teamClient } from '@/lib/supabase';
import { studentRows } from '@/lib/stats';
import { ContractEnds, Followers, Growth, LastContact, LastSeen, NoPost } from '@/components/student-cells';
import { Empty, PageTitle, StudentCell } from '@/components/ui';

const TABS = [['active', 'Active'], ['former', 'Former'], ['all', 'All']] as const;

export default async function Students({ searchParams }: { searchParams: Promise<{ show?: string; q?: string }> }) {
  const { db } = await teamClient();
  const { show = 'active', q = '' } = await searchParams;
  const all = await studentRows(db);
  const counts = { active: all.filter((s) => s.status !== 'left').length, former: all.filter((s) => s.status === 'left').length };
  const needle = q.trim().toLowerCase().replace(/^@/, '');
  const list = all
    .filter((s) => (show === 'all' ? true : show === 'former' ? s.status === 'left' : s.status !== 'left'))
    .filter((s) => !needle || s.ig_handle.includes(needle) || s.name.toLowerCase().includes(needle))
    .sort((a, b) => a.ig_handle.localeCompare(b.ig_handle));

  // One exact match from the top search bar: go straight to that student.
  const exact = needle && list.length === 1 && list[0].ig_handle === needle;

  return (
    <>
      <PageTitle title="Students" sub={`${counts.active} active · ${counts.former} former`}>
        <form className="flex items-center gap-2">
          <input type="hidden" name="show" value={show} />
          <input name="q" defaultValue={q} placeholder="Filter by name or handle" className="field !w-56 !py-1.5" />
          <nav aria-label="Show" className="flex gap-1">
            {TABS.map(([v, label]) => (
              <Link key={v} href={`/students?show=${v}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
                aria-current={show === v ? 'page' : undefined} className="chip">{label}</Link>
            ))}
          </nav>
        </form>
      </PageTitle>

      {exact && (
        <p className="mb-3 text-sm">
          <Link href={`/students/${list[0].id}`} className="btn">Open @{list[0].ig_handle} →</Link>
        </p>
      )}

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
                <th>Student</th>
                <th>Followers<small>today</small></th>
                <th>Growth<small>this month</small></th>
                <th>Posts<small>this month</small></th>
                <th>No post<small>for</small></th>
                <th>Last seen<small>Heartbeat</small></th>
                <th>Last contact<small>contact log</small></th>
                <th>Contract<small>ends in</small></th>
              </tr>
            </thead>
            <tbody>
              {list.map((s, i) => (
                <tr key={s.id} className={s.status === 'left' ? 'opacity-70' : ''}>
                  <td className="text-ink-soft tnum">{i + 1}</td>
                  <td><StudentCell id={s.id} handle={s.ig_handle} name={s.name} /></td>
                  <td><Followers s={s} /></td>
                  <td><Growth s={s} /></td>
                  <td className="tnum font-bold">{s.status === 'left' ? '–' : s.posts}</td>
                  <td><NoPost s={s} /></td>
                  <td><LastSeen /></td>
                  <td><LastContact s={s} /></td>
                  <td><ContractEnds s={s} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
