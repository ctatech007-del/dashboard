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
    <div className="sky min-h-screen">
      <div className="relative z-10 md:grid md:grid-cols-[232px_1fr] md:gap-5 md:p-5">
        <aside className="navy-glass md:sticky md:top-5 md:h-[calc(100vh-2.5rem)] md:rounded-3xl px-3 py-4 md:py-6 flex md:flex-col gap-4 text-white">
          <Link href="/" className="display text-2xl md:text-3xl px-3 shrink-0 text-white">Student Stats</Link>
          <NavLinks attention={attention} />
          <div className="hidden md:block mt-auto px-3 text-xs text-white/65 space-y-2">
            <p>{updatedAt ? <>Updated {updatedAt} IST</> : 'Not updated yet'}</p>
            <p className="truncate" title={user.email}>{user.email}</p>
            <form action={signOut}><button className="underline underline-offset-4 hover:text-white">Sign out</button></form>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-1 py-3 md:pt-0">
            <SearchBox />
            <p className="on-sky text-xs">
              {running ? <span className="font-bold">Updating now…</span>
                : updated ? <>Updated <strong>{relative(updated)}</strong></> : 'No data yet'}
            </p>
            <form action={signOut} className="md:hidden"><button className="on-sky text-xs underline">Sign out</button></form>
          </header>
          <main className="sheet mx-3 md:mx-0 mb-6 rounded-3xl px-4 py-6 md:px-8 md:py-8 max-w-[1240px]">{children}</main>
        </div>
      </div>
    </div>
  );
}
