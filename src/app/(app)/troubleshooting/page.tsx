import Link from 'next/link';
import { teamClient } from '@/lib/supabase';
import { callFunction } from '@/lib/functions';
import { cronToIst, OUTCOME_LABEL, relative } from '@/lib/format';
import { rerun, rerunStudent, resolveRename } from '@/app/actions';
import { ActionForm, RerunButton } from '@/components/forms';
import { PageTitle } from '@/components/ui';

// What to do about a profile that couldn't be read.
const PROFILE_FIX: Record<string, string> = {
  private: 'Ask the student to make their account public. Posts can’t be counted until they do.',
  not_found: 'The handle was probably changed. Ask the student for the new one and update it in the roster; their history stays.',
  error: 'Usually temporary. Re-scrape this student; if it keeps failing, check the detail and the run below.',
  never_scraped: 'Not scraped yet. Re-scrape this student, or wait for the next daily run.',
};

export const dynamic = 'force-dynamic';

// What to do about each kind of run problem, in plain English.
const RUN_FIX: [RegExp, string][] = [
  [/Apify start failed: 40[13]/, 'The Apify token is wrong or expired. Update APIFY_TOKEN in Supabase → Edge Functions → Secrets.'],
  [/Apify start failed: 402|credit|usage/i, 'Apify is out of credit for this month. Top up or raise the limit in Apify → Billing.'],
  [/did not succeed|Overflow scrape failed/, 'Apify’s run failed or timed out. Usually temporary: re-run in a few minutes.'],
  [/Sheets API 40[34]|Google token/, 'The Google Sheet isn’t shared with the service account, or the key is wrong.'],
];
const fixFor = (text: string | null) => (text ? RUN_FIX.find(([re]) => re.test(text))?.[1] : undefined);

type Health = { secrets?: Record<string, boolean>; apify?: { usedUsd: number; limitUsd: number | null } | { error: string } };

export default async function Troubleshooting() {
  const { db } = await teamClient();
  const [{ data: runs }, { data: cfg }, { data: lastGood }, health, { data: problems }] = await Promise.all([
    db.from('scrape_runs')
      .select('id, trigger, status, started_at, finished_at, profiles_total, profiles_ok, error, sheet_status, student_ids, scrape_results(outcome, detail, new_posts, students(id, name, ig_handle))')
      .order('started_at', { ascending: false }).limit(15),
    db.from('settings').select('scrape_cron, sheet_id, alert_emails').single(),
    db.from('scrape_runs').select('finished_at').eq('status', 'done').is('student_ids', null)
      .order('finished_at', { ascending: false }).limit(1).maybeSingle(),
    callFunction('health').then((r) => (r.res.ok ? (r.body as Health) : {})).catch(() => ({} as Health)),
    db.from('open_flags').select('*').order('days_without_data', { ascending: false, nullsFirst: true }),
  ]);
  const { data: renames } = await db.from('rename_requests')
    .select('id, old_handle, new_handle, status, detail, created_at, student_id')
    .in('status', ['needs_review', 'checking']).order('created_at', { ascending: false });

  const schedule = cronToIst(cfg?.scrape_cron ?? '');
  const stuck = (runs ?? []).find((r) => ['running', 'ingesting'].includes(r.status)
    && Date.now() - new Date(r.started_at).getTime() > 2 * 3600_000);
  const apify = health.apify;
  const lastSheet = (runs ?? []).find((r) => r.sheet_status)?.sheet_status;

  const checks: { label: string; ok: boolean | null; detail: string }[] = [
    {
      // Daily scrape: anything older than ~a day and a bit means a run was missed.
      label: 'Last full scrape', ok: lastGood ? Date.now() - new Date(lastGood.finished_at).getTime() < 30 * 3600_000 : false,
      detail: lastGood ? relative(lastGood.finished_at) : 'never',
    },
    {
      label: 'Schedule', ok: !!schedule,
      detail: schedule ? `Every day at ${schedule} IST` : 'not set',
    },
    { label: 'Stuck runs', ok: !stuck, detail: stuck ? `one started ${relative(stuck.started_at)} hasn’t finished` : 'none' },
    {
      label: 'Apify credit', ok: !apify || 'error' in apify ? null : apify.limitUsd === null || apify.usedUsd < apify.limitUsd * 0.9,
      detail: !apify ? 'couldn’t check' : 'error' in apify ? apify.error
        : `$${apify.usedUsd.toFixed(2)} used this month${apify.limitUsd ? ` of $${apify.limitUsd}` : ''}`,
    },
    { label: 'Apify key', ok: health.secrets?.apify ?? null, detail: health.secrets ? (health.secrets.apify ? 'set' : 'missing') : 'couldn’t check' },
    {
      label: 'Google Sheet', ok: !cfg?.sheet_id ? null : lastSheet ? lastSheet === 'ok' : null,
      detail: !cfg?.sheet_id ? 'not connected' : !health.secrets?.google ? 'service account key missing'
        : lastSheet === 'ok' ? 'synced after the last run' : lastSheet ?? 'not synced yet',
    },
    {
      label: 'Failure alerts', ok: health.secrets?.alerts && cfg?.alert_emails?.length ? true : null,
      detail: !health.secrets?.alerts ? 'email service not set up' : cfg?.alert_emails?.length
        ? `to ${cfg.alert_emails.join(', ')}` : 'no address in Settings',
    },
  ];

  return (
    <>
      <PageTitle title="Troubleshooting" sub="Is the tracker working, and how to fix what isn’t. Most fixes are a re-run or a handle update.">
        <RerunButton action={rerun} />
      </PageTitle>

      <h2 className="display text-2xl mb-1">Profiles we couldn’t read ({problems?.length ?? 0})</h2>
      <p className="text-sm text-ink-soft mb-3">These students’ numbers aren’t updating; we never repeat an old value instead.</p>
      {problems?.length ? (
        <ul className="grid md:grid-cols-2 gap-3 mb-10">
          {problems.map((f) => (
            <li key={f.id} className="card p-4 border-l-4 !border-l-bad">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link href={`/students/${f.id}`} className="font-extrabold hover:underline">@{f.ig_handle}</Link>
                <span className="text-xs font-bold rounded-full px-2 py-0.5 bg-bad-soft text-bad">
                  {OUTCOME_LABEL[f.reason]} · {f.days_without_data === null ? 'no data yet' : `no data for ${f.days_without_data} days`}
                </span>
              </div>
              <p className="text-sm mt-2">{PROFILE_FIX[f.reason]}</p>
              {f.detail && <p className="text-xs text-ink-soft mt-1">{f.detail}</p>}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <ActionForm action={rerunStudent} submit="Re-scrape" quiet className="[&>div]:mt-0">
                  <input type="hidden" name="student_id" value={f.id} />
                </ActionForm>
                <Link href={`/roster?edit=${f.id}`} className="btn btn-quiet">Update handle or status</Link>
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="card p-4 mb-10 text-sm">✓ Every active student was read in the last scrape.</p>}

      {!!renames?.length && (
        <>
          <h2 className="display text-2xl mb-1">Handle changes from students ({renames.length})</h2>
          <p className="text-sm text-ink-soft mb-3">Reported on the Hub. Same Instagram account → updated automatically; these need a look.</p>
          <ul className="space-y-2 mb-10">
            {renames.map((r) => (
              <li key={r.id} className="card p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm">
                  <Link href={`/students/${r.student_id}`} className="font-extrabold hover:underline">@{r.old_handle}</Link>
                  {' → '}<a href={`https://instagram.com/${r.new_handle}`} target="_blank" rel="noreferrer" className="font-extrabold text-brand hover:underline">@{r.new_handle} ↗</a>
                  <span className="block text-xs text-ink-soft">
                    {r.status === 'checking' ? 'Still checking on Instagram…' : r.detail} · {relative(r.created_at)}
                  </span>
                </div>
                <form action={resolveRename} className="flex gap-2">
                  <input type="hidden" name="id" value={r.id} />
                  <button name="decision" value="approve" className="btn !py-1.5 text-xs">Approve</button>
                  <button name="decision" value="reject" className="btn btn-quiet !py-1.5 text-xs">Reject</button>
                </form>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 className="display text-2xl mb-3">Health</h2>
      <ul className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
        {checks.map((c) => (
          <li key={c.label} className={`rounded-lg px-4 py-3 ${
            c.ok === true ? 'bg-good-soft border border-good/30' : c.ok === false ? 'bg-bad-soft border border-bad/30' : 'bg-surface border border-rule'}`}>
            <p className="wide text-sm font-bold">{c.label}</p>
            <p className={`text-sm mt-1 ${c.ok === null ? 'text-ink-soft' : ''}`}>{c.detail}</p>
          </li>
        ))}
      </ul>

      <h2 className="display text-2xl mb-3">Recent runs</h2>
      <ul className="space-y-3">
        {(runs ?? []).map((r) => {
          const problems = (r.scrape_results ?? []).filter((x) => x.outcome !== 'ok');
          const fix = fixFor(r.error) ?? fixFor(r.sheet_status === 'ok' ? null : r.sheet_status);
          const single = r.student_ids?.length === 1
            ? (r.scrape_results?.[0]?.students as unknown as { name: string } | null) : null;
          return (
            <li key={r.id} className="card">
              <details>
                <summary className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 cursor-pointer list-none">
                  <span className="flex items-center gap-3">
                    <span className={`size-2.5 rounded-full ${r.status === 'done' && !r.error ? 'bg-good'
                      : r.status === 'failed' ? 'bg-bad' : r.status === 'done' ? 'bg-brand' : 'bg-brand-ink'}`} aria-hidden />
                    <span className="font-semibold">
                      {single ? `Re-scrape: ${single.name}` : r.trigger === 'schedule' ? 'Daily scrape' : 'Manual re-run'}
                    </span>
                    <span className="text-sm text-ink-soft">{relative(r.started_at)}</span>
                  </span>
                  <span className="text-sm tnum text-ink-soft">
                    {r.status === 'done' ? `${r.profiles_ok ?? 0}/${r.profiles_total ?? 0} read` : r.status}
                    {r.sheet_status && r.sheet_status !== 'ok' && ' · Sheet not synced'}
                  </span>
                </summary>
                <div className="px-5 pb-4 text-sm border-t border-rule pt-3">
                  {r.error && <p className="text-bad">{r.error}</p>}
                  {r.sheet_status && r.sheet_status !== 'ok' && <p className="text-bad">Sheet: {r.sheet_status}</p>}
                  {fix && <p className="mt-1"><strong>What to do:</strong> {fix}</p>}
                  {problems.length ? (
                    <ul className="mt-2 space-y-1">
                      {problems.map((p, i) => {
                        const st = p.students as unknown as { id: string; name: string; ig_handle: string } | null;
                        return (
                          <li key={i}>
                            {st ? <Link href={`/students/${st.id}`} className="underline underline-offset-4">{st.name}</Link> : 'Unknown'}{' '}
                            <span className="text-ink-soft">@{st?.ig_handle}</span> ·{' '}
                            <span className="text-bad">{OUTCOME_LABEL[p.outcome]}</span>
                            {p.detail && <span className="text-ink-soft"> · {p.detail}</span>}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    !r.error && r.status === 'done' && <p className="text-ink-soft">Every profile was read.</p>
                  )}
                </div>
              </details>
            </li>
          );
        })}
        {!runs?.length && <li className="text-sm text-ink-soft">No scrapes yet.</li>}
      </ul>
    </>
  );
}
