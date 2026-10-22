import Link from 'next/link';
import { teamClient } from '@/lib/supabase';
import { OUTCOME_LABEL } from '@/lib/format';
import { Empty } from '@/components/empty';

const FIX: Record<string, string> = {
  private: 'Ask the student to make their account public. Posts can’t be counted until they do.',
  not_found: 'The handle was probably changed. Ask the student for the new one and update it in the roster.',
  error: 'Usually temporary. Re-run the scrape; if it keeps failing, check the detail below.',
  never_scraped: 'Run a scrape to check this profile.',
};

export default async function Flags() {
  const { db } = await teamClient();
  const { data: flags } = await db.from('open_flags').select('*')
    .order('days_without_data', { ascending: false, nullsFirst: true });

  return (
    <>
      <h1 className="wide text-3xl font-bold">Flags</h1>
      <p className="text-sm text-ink-soft mt-1 mb-6">
        Active students whose latest scrape didn’t work. Their numbers aren’t updating until this is fixed.
      </p>
      {!flags?.length ? (
        <Empty title="Nothing to fix">Every active student was read in the last scrape.</Empty>
      ) : (
        <ul className="space-y-3">
          {flags.map((f) => (
            <li key={f.id} className="bg-surface border border-rule border-l-4 border-l-flag rounded-lg px-5 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p>
                  <Link href={`/students/${f.id}`} className="font-semibold hover:underline underline-offset-4">
                    {f.name}
                  </Link>{' '}
                  <span className="text-ink-soft text-sm">@{f.ig_handle} · {f.batch_name}</span>
                </p>
                <p className="text-sm">
                  <span className="font-semibold text-flag">{OUTCOME_LABEL[f.reason]}</span>
                  <span className="text-ink-soft">
                    {' '}· {f.days_without_data === null ? 'no data yet' : `no data for ${f.days_without_data} days`}
                  </span>
                </p>
              </div>
              <p className="text-sm mt-2">{FIX[f.reason]}</p>
              {f.detail && <p className="text-xs text-ink-soft mt-1">{f.detail}</p>}
              <Link href={`/roster?edit=${f.id}`} className="inline-block text-sm underline underline-offset-4 mt-2">
                Update handle or status
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
