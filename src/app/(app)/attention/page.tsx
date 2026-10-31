import Link from 'next/link';
import { teamClient } from '@/lib/supabase';
import { studentRows, type StudentRow } from '@/lib/stats';
import { parseSort, sortBy } from '@/lib/sort';
import { OUTCOME_LABEL } from '@/lib/format';
import { ContractEnds, Followers, LastContact, LastSeen, NoPost } from '@/components/student-cells';
import { SortTh, sortHref } from '@/components/sort-header';
import { Empty, StudentCell } from '@/components/ui';

type Filter = 'last_seen' | 'no_post' | 'contract' | 'data';
const FILTERS: [Filter, string][] = [['last_seen', 'Last seen'], ['no_post', 'No post'], ['contract', 'Contract'], ['data', 'Data problem']];
const BRACKETS = [7, 14, 30, 60];
const KEYS = ['student', 'seen', 'nopost', 'posts', 'contract', 'followers', 'contact'];
// Each filter sorts by its own column first: the most overdue at the top.
const DEFAULT_SORT: Record<Filter, { key: string; dir: 'asc' | 'desc' }> = {
  last_seen: { key: 'seen', dir: 'desc' }, no_post: { key: 'nopost', dir: 'desc' },
  contract: { key: 'contract', dir: 'asc' }, data: { key: 'nopost', dir: 'desc' },
};
const value = (s: StudentRow, k: string) => ({
  student: s.ig_handle, seen: null, nopost: s.noPostDays, posts: s.posts30, contract: s.contractDays,
  followers: s.followers, contact: s.lastNote?.created_at ?? null,
}[k]);

export default async function Attention({ searchParams }: {
  searchParams: Promise<{ f?: string; d?: string; sort?: string; dir?: string }>;
}) {
  const { db } = await teamClient();
  const sp = await searchParams;
  const f = (FILTERS.find(([v]) => v === sp.f)?.[0] ?? 'no_post') as Filter;
  const d = sp.d === 'all' ? 'all' : BRACKETS.includes(Number(sp.d)) ? Number(sp.d) : 7;
  const sort = parseSort(sp, KEYS, DEFAULT_SORT[f]);

  const active = (await studentRows(db)).filter((s) => s.status === 'active');
  const inBracket = (s: StudentRow) => {
    if (f === 'data') return s.lastOutcome !== 'ok';
    if (f === 'last_seen') return false;                        // Heartbeat isn't connected yet (Phase 4)
    if (f === 'contract') return s.contractDays !== null && (d === 'all' || s.contractDays <= d);
    return s.noPostDays !== null && (d === 'all' || s.noPostDays >= d);
  };
  const rows = sortBy(active.filter(inBracket), sort, value);
  const href = (nf: Filter, nd: number | 'all') => `/attention?f=${nf}&d=${nd}`;
  const keep = sortHref('/attention', { f, d: String(d) });

  return (
    <>
      <h1 className="display text-4xl md:text-5xl mb-6 flex items-center gap-3">
        Needs attention
        <span className="font-sans text-sm font-extrabold rounded-full bg-bad text-white px-2.5 py-0.5 tnum">{rows.length}</span>
      </h1>

      <div className="card overflow-hidden border-t-4 !border-t-bad">
        <div className="flex flex-wrap items-center gap-2 p-4">
          {FILTERS.map(([v, label]) => (
            <Link key={v} href={href(v, v === 'contract' ? 30 : 7)} aria-current={f === v ? 'page' : undefined} className="chip">{label}</Link>
          ))}
          {f !== 'data' && (
            <>
              <span className="w-px h-5 bg-rule mx-1" aria-hidden />
              {[...BRACKETS, 'all' as const].map((n) => (
                <Link key={n} href={href(f, n)} aria-current={d === n ? 'page' : undefined} className="chip">
                  {n === 'all' ? 'All' : f === 'contract' ? `≤${n} d` : `${n}+ d`}
                </Link>
              ))}
            </>
          )}
        </div>

        {f === 'last_seen' ? (
          <div className="px-4 pb-4"><Empty title="Heartbeat isn’t connected yet">“Last seen” fills in once the Heartbeat sync is live.</Empty></div>
        ) : !rows.length ? (
          <div className="px-4 pb-4"><Empty title="Nobody here">No active student matches this filter.</Empty></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <SortTh label="Student" k="student" sort={sort} href={keep} firstDir="asc" />
                  <SortTh label="Last seen" sub="heartbeat" k="seen" sort={sort} href={keep} align="right" />
                  <SortTh label="No post" sub="for" k="nopost" sort={sort} href={keep} align="right" />
                  <SortTh label="Posts" sub="30 days" k="posts" sort={sort} href={keep} align="right" />
                  <SortTh label="Contract" sub="ends in" k="contract" sort={sort} href={keep} firstDir="asc" align="right" />
                  <SortTh label="Followers" sub="today" k="followers" sort={sort} href={keep} align="right" />
                  <SortTh label="Last contact" sub="contact log" k="contact" sort={sort} href={keep} align="right" />
                </tr>
              </thead>
              <tbody>
                {rows.map((s, i) => (
                  <tr key={s.id}>
                    <td className="text-ink-soft tnum">{i + 1}</td>
                    <td>
                      <StudentCell id={s.id} handle={s.ig_handle} name={s.name} />
                      {f === 'data' && (
                        <Link href="/troubleshooting" className="inline-block mt-1 text-xs font-bold rounded-full px-2 py-0.5 bg-bad-soft text-bad">
                          {OUTCOME_LABEL[s.lastOutcome ?? 'never_scraped']}
                        </Link>
                      )}
                    </td>
                    <td className="text-right"><LastSeen /></td>
                    <td className="text-right"><NoPost s={s} /></td>
                    <td className="text-right tnum font-bold">{s.posts30}</td>
                    <td className="text-right"><ContractEnds s={s} /></td>
                    <td className="text-right"><Followers s={s} /></td>
                    <td className="text-right"><LastContact s={s} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
