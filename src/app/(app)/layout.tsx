import Link from 'next/link';
import { teamClient } from '@/lib/supabase';
import { relative } from '@/lib/format';
import { rerun, signOut } from '@/app/actions';
import { RerunButton } from '@/components/forms';
import { NavLinks } from '@/components/nav';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { db, user } = await teamClient();
  const [{ data: lastRun }, { count: flags }] = await Promise.all([
    db.from('scrape_runs').select('status, finished_at, started_at, profiles_ok, profiles_total, error')
      .order('started_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('open_flags').select('*', { count: 'exact', head: true }),
  ]);

  const running = lastRun && ['running', 'ingesting'].includes(lastRun.status);
  const lastDone = lastRun?.finished_at;

  return (
    <div className="min-h-screen md:grid md:grid-cols-[220px_1fr]">
      <aside className="border-b md:border-b-0 md:border-r border-rule bg-surface px-5 py-5 flex md:flex-col gap-6 md:min-h-screen">
        <Link href="/" className="block">
          <span className="wide block text-lg font-bold leading-tight">CTA Post Tracker</span>
          <span className="text-xs text-ink-soft">100 Post Challenge</span>
        </Link>
        <NavLinks flags={flags ?? 0} />
        <form action={signOut} className="hidden md:block mt-auto">
          <p className="text-xs text-ink-soft truncate mb-2" title={user.email}>{user.email}</p>
          <button className="text-sm underline underline-offset-4 text-ink-soft hover:text-ink">Sign out</button>
        </form>
      </aside>

      <div className="min-w-0">
        <header className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-b border-rule bg-surface">
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
        <main className="px-6 py-6 max-w-6xl">{children}</main>
      </div>
    </div>
  );
}
