import Link from 'next/link';
import { teamClient } from '@/lib/supabase';
import { callFunction } from '@/lib/functions';
import { cronToIst, OUTCOME_LABEL, relative, WEEKDAYS } from '@/lib/format';

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

export default async function Runs() {
  const { db } = await teamClient();
  const [{ data: runs }, { data: cfg }, { data: lastGood }, health] = await Promise.all([
    db.from('scrape_runs')
      .select('id, trigger, status, started_at, finished_at, profiles_total, profiles_ok, error, sheet_status, student_ids, scrape_results(outcome, detail, new_posts, students(id, name, ig_handle))')
      .order('started_at', { ascending: false }).limit(15),
    db.from('settings').select('scrape_cron, sheet_id, alert_emails').single(),
    db.from('scrape_runs').select('finished_at').eq('status', 'done').is('student_ids', null)
      .order('finished_at', { ascending: false }).limit(1).maybeSingle(),
    callFunction('health').then((r) => (r.res.ok ? (r.body as Health) : {})).catch(() => ({} as Health)),
  ]);

  const schedule = cronToIst(cfg?.scrape_cron ?? '');
  const stuck = (runs ?? []).find((r) => ['running', 'ingesting'].includes(r.status)
    && Date.now() - new Date(r.started_at).getTime() > 2 * 3600_000);
  const apify = health.apify;
  const lastSheet = (runs ?? []).find((r) => r.sheet_status)?.sheet_status;

  const checks: { label: string; ok: boolean | null; detail: string }[] = [
    {
      label: 'Last full scrape', ok: lastGood ? Date.now() - new Date(lastGood.finished_at).getTime() < 8 * 864e5 : false,
      detail: lastGood ? relative(lastGood.finished_at) : 'never',
    },
    {
      label: 'Schedule', ok: !!schedule,
      detail: schedule ? `${WEEKDAYS[schedule.dow]}s at ${schedule.time} IST` : 'not set',
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
      <h1 className="wide text-3xl md:text-4xl font-bold">Runs & health</h1>
      <p className="text-sm text-ink-soft mt-1 mb-6">Is the tracker working, and what happened in each scrape.</p>

      <ul className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
        {checks.map((c) => (
          <li key={c.label} className={`rounded-lg px-4 py-3 ${
            c.ok === true ? 'neon bg-green' : c.ok === false ? 'neon bg-pink' : 'bg-surface border border-rule'}`}>
            <p className="wide text-sm font-bold">{c.label}</p>
            <p className={`text-sm mt-1 ${c.ok === null ? 'text-ink-soft' : ''}`}>{c.detail}</p>
          </li>
        ))}
      </ul>

      <h2 className="wide text-lg font-bold mb-3">Recent runs</h2>
      <ul className="space-y-3">
        {(runs ?? []).map((r) => {
          const problems = (r.scrape_results ?? []).filter((x) => x.outcome !== 'ok');
          const fix = fixFor(r.error) ?? fixFor(r.sheet_status === 'ok' ? null : r.sheet_status);
          const single = r.student_ids?.length === 1
            ? (r.scrape_results?.[0]?.students as unknown as { name: string } | null) : null;
          return (
            <li key={r.id} className="bg-surface border border-rule rounded-lg">
              <details>
                <summary className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 cursor-pointer list-none">
                  <span className="flex items-center gap-3">
                    <span className={`size-2.5 rounded-full ${r.status === 'done' && !r.error ? 'bg-green'
                      : r.status === 'failed' ? 'bg-pink' : r.status === 'done' ? 'bg-lime' : 'bg-blue'}`} aria-hidden />
                    <span className="font-semibold">
                      {single ? `Re-scrape: ${single.name}` : r.trigger === 'schedule' ? 'Weekly scrape' : 'Manual re-run'}
                    </span>
                    <span className="text-sm text-ink-soft">{relative(r.started_at)}</span>
                  </span>
                  <span className="text-sm tnum text-ink-soft">
                    {r.status === 'done' ? `${r.profiles_ok ?? 0}/${r.profiles_total ?? 0} read` : r.status}
                    {r.sheet_status && r.sheet_status !== 'ok' && ' · Sheet not synced'}
                  </span>
                </summary>
                <div className="px-5 pb-4 text-sm border-t border-rule pt-3">
                  {r.error && <p className="text-pink">{r.error}</p>}
                  {r.sheet_status && r.sheet_status !== 'ok' && <p className="text-pink">Sheet: {r.sheet_status}</p>}
                  {fix && <p className="mt-1"><strong>What to do:</strong> {fix}</p>}
                  {problems.length ? (
                    <ul className="mt-2 space-y-1">
                      {problems.map((p, i) => {
                        const st = p.students as unknown as { id: string; name: string; ig_handle: string } | null;
                        return (
                          <li key={i}>
                            {st ? <Link href={`/students/${st.id}`} className="underline underline-offset-4">{st.name}</Link> : 'Unknown'}{' '}
                            <span className="text-ink-soft">@{st?.ig_handle}</span> ·{' '}
                            <span className="text-pink">{OUTCOME_LABEL[p.outcome]}</span>
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
