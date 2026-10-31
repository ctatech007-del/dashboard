import Link from 'next/link';
import { teamClient } from '@/lib/supabase';
import { relative } from '@/lib/format';
import { signOut } from '@/app/actions';
import { NavLinks } from '@/components/nav';
import { SearchBox } from '@/components/search-box';
import { lastUpdate, studentRows } from '@/lib/stats';
import { needs } from '@/lib/needs';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { db, user } = await teamClient();
  const [updated, rows, { count: running }] = await Promise.all([
    lastUpdate(db),
    studentRows(db),
    db.from('scrape_runs').select('id', { count: 'exact', head: true }).in('status', ['running', 'ingesting']),
  ]);
  const attention = rows.filter((r) => needs(r).length).length;
  const updatedAt = updated
    ? new Date(updated).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null;

  return (
    <div className="min-h-screen md:grid md:grid-cols-[220px_1fr]">
      <aside className="md:sticky md:top-0 md:h-screen border-b md:border-b-0 md:border-r border-rule bg-surface px-3 py-4 md:py-6 flex md:flex-col gap-4">
        <Link href="/" className="display text-3xl px-3 shrink-0">Student Stats</Link>
        <NavLinks attention={attention} />
        <div className="hidden md:block mt-auto px-3 text-xs text-ink-soft space-y-2">
          <p>{updatedAt ? <>Updated {updatedAt} IST</> : 'Not updated yet'}</p>
          <p className="truncate" title={user.email}>{user.email}</p>
          <form action={signOut}><button className="underline underline-offset-4 hover:text-ink">Sign out</button></form>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-8 py-3">
          <SearchBox />
          <p className="text-xs text-ink-soft">
            {running ? <span className="font-bold text-brand">Updating now…</span>
              : updated ? <>Updated <strong className="text-ink">{relative(updated)}</strong></> : 'No data yet'}
          </p>
          <form action={signOut} className="md:hidden"><button className="text-xs underline">Sign out</button></form>
        </header>
        <main className="px-4 md:px-8 pb-12 max-w-[1200px]">{children}</main>
      </div>
    </div>
  );
}
