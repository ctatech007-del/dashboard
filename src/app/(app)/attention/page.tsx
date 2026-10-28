import Link from 'next/link';
import { teamClient } from '@/lib/supabase';
import { studentRows } from '@/lib/stats';
import { needs, type Need } from '@/lib/needs';
import { OUTCOME_LABEL } from '@/lib/format';
import { ContractEnds, Followers, LastContact, LastSeen, NoPost } from '@/components/student-cells';
import { Empty, PageTitle, StudentCell } from '@/components/ui';

const FILTERS: [Need | 'all', string][] = [['all', 'All'], ['no_post', 'No post'], ['contract', 'Contract'], ['last_seen', 'Last seen'], ['data', 'Data problem']];
const DAYS = [7, 14, 30, 60];

export default async function Attention({ searchParams }: { searchParams: Promise<{ f?: string; d?: string }> }) {
  const { db } = await teamClient();
  const sp = await searchParams;
  const f = (FILTERS.find(([v]) => v === sp.f)?.[0] ?? 'all') as Need | 'all';
  const d = DAYS.includes(Number(sp.d)) ? Number(sp.d) : f === 'contract' ? 30 : 14;
  const days = { no_post: f === 'no_post' ? d : 14, contract: f === 'contract' ? d : 30, last_seen: f === 'last_seen' ? d : 14 };

  const rows = (await studentRows(db))
    .map((s) => ({ ...s, why: needs(s, days) }))
    .filter((s) => s.why.length && (f === 'all' || s.why.includes(f)))
    .sort((a, b) => f === 'contract'
      ? (a.contractDays ?? 1e9) - (b.contractDays ?? 1e9)
      : (b.noPostDays ?? -1) - (a.noPostDays ?? -1));

  const href = (nf: string, nd?: number) => `/attention?f=${nf}${nd ? `&d=${nd}` : ''}`;
  const showDays = f === 'no_post' || f === 'contract' || f === 'last_seen';

  return (
    <>
      <PageTitle title="Needs attention" sub={<>
        {rows.length} active student{rows.length === 1 ? '' : 's'} to check in with.
        Hover <em>Last contact</em> to see the latest note.
      </>} />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {FILTERS.map(([v, label]) => (
          <Link key={v} href={href(v)} aria-current={f === v ? 'page' : undefined}
            aria-disabled={v === 'last_seen' ? 'true' : undefined} title={v === 'last_seen' ? 'Needs Heartbeat (Phase 4)' : undefined}
            className="chip">{label}</Link>
        ))}
        {showDays && (
          <>
            <span className="w-px h-5 bg-rule mx-1" aria-hidden />
            {DAYS.map((n) => (
              <Link key={n} href={href(f, n)} aria-current={d === n ? 'page' : undefined} className="chip">
                {f === 'contract' ? `≤${n} d` : `${n}+ d`}
              </Link>
            ))}
          </>
        )}
      </div>

      {!rows.length ? (
        <Empty title="Nobody here">No active student matches this filter.</Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Student</th>
                <th>Last seen<small>Heartbeat</small></th>
                <th>No post<small>for</small></th>
                <th>Posts<small>this month</small></th>
                <th>Contract<small>ends in</small></th>
                <th>Followers<small>today</small></th>
                <th>Last contact<small>contact log</small></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s, i) => (
                <tr key={s.id}>
                  <td className="text-ink-soft tnum">{i + 1}</td>
                  <td>
                    <StudentCell id={s.id} handle={s.ig_handle} name={s.name} />
                    {s.why.includes('data') && (
                      <Link href="/troubleshooting" className="inline-block mt-1 text-xs font-bold rounded-full px-2 py-0.5 bg-bad-soft text-bad">
                        {OUTCOME_LABEL[s.lastOutcome ?? 'never_scraped']}
                      </Link>
                    )}
                  </td>
                  <td><LastSeen /></td>
                  <td><NoPost s={s} /></td>
                  <td className="tnum font-bold">{s.posts}</td>
                  <td><ContractEnds s={s} /></td>
                  <td><Followers s={s} /></td>
                  <td><LastContact s={s} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
