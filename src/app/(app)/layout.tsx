import Link from 'next/link';
import { teamClient } from '@/lib/supabase';
import { relative } from '@/lib/format';
import { rerun, signOut } from '@/app/actions';
import { RerunButton } from '@/components/forms';
import { BottomNav, NavLinks } from '@/components/nav';
import { Star } from '@/components/star';
import { ATTENTION_COLUMNS, reasons, rulesFrom } from '@/lib/attention';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { db, user } = await teamClient();
  const [{ data: lastRun }, { count: inFlight }, { data: rows }, { data: cfg }] = await Promise.all([
    // The header reports full scrapes; single-student re-scrapes would make it look like 1/1.
    db.from('scrape_runs').select('status, finished_at, started_at, profiles_ok, profiles_total, error')
      .is('student_ids', null).order('started_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('scrape_runs').select('*', { count: 'exact', head: true }).in('status', ['running', 'ingesting']),
    db.from('leaderboard').select(ATTENTION_COLUMNS).eq('status', 'active'),
    db.from('settings').select('milestones, quiet_days, challenge_weeks').single(),
  ]);
  const rules = rulesFrom(cfg);
  const flags = (rows ?? []).filter((r) => reasons(r, rules).length).length;

  const running = !!inFlight;
  const lastDone = lastRun?.finished_at;

  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="border-b md:border-b-0 md:border-r border-rule px-4 md:px-5 py-4 md:py-6 flex items-center md:items-stretch md:flex-col gap-8 md:min-h-screen md:sticky md:top-0 md:h-screen">
        <Link href="/" className="flex items-center gap-2.5 md:px-2">
          <Star className="size-8 text-pink shrink-0" />
          <span>
            <span className="wide block text-base font-bold leading-tight uppercase">CTA Post Tracker</span>
            <span className="block text-xs text-ink-soft">100 Post Challenge</span>
          </span>
        </Link>
        <NavLinks flags={flags ?? 0} />
        <form action={signOut} className="ml-auto md:ml-0 md:mt-auto md:px-2 shrink-0">
          <p className="hidden md:block text-xs text-ink-soft truncate mb-2" title={user.email}>{user.email}</p>
          <button className="btn btn-quiet !px-3.5 !py-1.5 text-xs md:text-sm">Sign out</button>
        </form>
      </aside>
      <BottomNav flags={flags ?? 0} />

      <div className="min-w-0">
        <header className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-8 py-3 border-b border-rule">
          <p className="text-sm text-ink-soft">
            {running ? (
              <span className="text-amber font-semibold">Scrape in progress…</span>
            ) : lastDone ? (
              <>
                Updated <strong className="text-ink">{relative(lastDone)}</strong>
                {lastRun?.profiles_total ? (
                  <> · {lastRun.profiles_ok}/{lastRun.profiles_total} profiles read</>
                ) : null}
                {lastRun?.status === 'failed' && <span className="text-flag"> · last run failed</span>}
              </>
            ) : (
              'No scrape has run yet. Add students, then run the first scrape.'
            )}
          </p>
          <RerunButton action={rerun} />
        </header>
        <main className="px-4 md:px-8 pt-6 pb-28 md:pb-10 max-w-6xl">{children}</main>
      </div>
    </div>
  );
}
