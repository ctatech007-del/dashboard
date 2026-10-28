import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { hubStudent } from '@/lib/hub';
import { mrz, STAMPS } from '@/lib/stamps';
import { HubTitle, Stamp, stampDef, StudentTabs, Updated } from '@/components/hub';

const PER_PAGE = 6;

export default async function Passport({ params, searchParams }: {
  params: Promise<{ handle: string }>; searchParams: Promise<{ page?: string }>;
}) {
  const { handle } = await params;
  const s = await hubStudent(decodeURIComponent(handle));
  if (!s) notFound();
  if (s.handle !== decodeURIComponent(handle)) redirect(`/hub/${s.handle}/passport`);

  const earned = s.stamps.filter((x) => stampDef(x.stamp));   // in the order they were earned
  const pages = Math.max(1, Math.ceil(earned.length / PER_PAGE));
  const page = Math.min(pages, Math.max(1, Number((await searchParams).page) || 1));
  const shown = earned.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const got = new Map(earned.map((x) => [x.stamp, x.earned_month]));
  const since = new Date(`${s.member_since}T00:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', month: 'short', year: 'numeric' });
  const [mrz1, mrz2] = mrz(s.name, s.handle, s.member_since, earned.length);
  const initials = s.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');

  const field = (label: string, value: React.ReactNode) => (
    <div>
      <p className="text-[9px] font-extrabold tracking-[0.15em] uppercase text-ink-soft">{label}</p>
      <p className="text-sm font-extrabold leading-tight">{value}</p>
    </div>
  );

  return (
    <>
      <p className="text-sm"><Link href="/hub" className="font-bold text-ink-soft hover:text-ink">← Back to leaderboards</Link></p>
      <HubTitle>Passport</HubTitle>
      <p className="text-center text-sm text-ink-soft mt-1">IG Handle: <strong className="text-ink">@{s.handle}</strong></p>
      <StudentTabs handle={s.handle} active="passport" />

      <div className="rounded-2xl bg-[#1f2b4a] p-2 sm:p-3 shadow-xl">
        <div className="grid md:grid-cols-2 rounded-xl overflow-hidden bg-[#f6efe2]">
          {/* Details page */}
          <section className="relative p-5 md:border-r border-[#e2d6c2] bg-[repeating-linear-gradient(0deg,transparent,transparent_23px,#efe5d4_24px)]">
            <p className="text-center text-[9px] font-extrabold tracking-[0.25em] text-ink-soft">CREATOR TAKEOFF ACADEMY</p>
            <p className="mt-3 flex items-center gap-2 font-extrabold tracking-[0.15em] text-sm">
              <span className="grid place-items-center size-7 rounded-full border-2 border-ink text-[10px]">✈</span> CREATOR PASSPORT
            </p>
            <div className="mt-4 grid grid-cols-[88px_1fr] gap-4">
              <div className="grid place-items-center aspect-[3/4] rounded-md bg-[#e6dccb] text-2xl font-extrabold text-ink-soft" aria-hidden>{initials}</div>
              <div className="space-y-2">
                {field('Name', s.name)}
                {field('Handle', `@${s.handle}`)}
                {field('Type', 'Creator')}
                {field('Member since', since)}
                {field('Stamps', `${earned.length} / ${STAMPS.length}`)}
                {field('Issued by', 'Creator Takeoff Academy')}
              </div>
            </div>
            <div className="mt-4">
              <p className="text-[9px] font-extrabold tracking-[0.15em] uppercase text-ink-soft">Signature of bearer</p>
              <p className="text-4xl text-[#2e3a5c] -rotate-3 mt-1 truncate" style={{ fontFamily: 'var(--font-signature), cursive' }}>{s.name}</p>
            </div>
            <div className="mt-4 font-mono text-[10px] sm:text-[11px] leading-snug tracking-[0.12em] text-ink/80 break-all" aria-label="Passport machine-readable lines">
              <p>{mrz1}</p><p>{mrz2}</p>
            </div>
          </section>

          {/* Stamp page */}
          <section className="p-5 min-h-[360px] flex flex-col">
            <p className="text-center text-[9px] font-extrabold tracking-[0.25em] text-ink-soft">CREATOR TAKEOFF ACADEMY</p>
            {shown.length ? (
              <ul className="mt-3 grid grid-cols-2 gap-x-2 gap-y-3 place-items-center flex-1">
                {shown.map((x) => {
                  const def = stampDef(x.stamp)!;
                  return <li key={x.stamp}><Stamp def={def} month={x.earned_month} size={150} /></li>;
                })}
              </ul>
            ) : (
              <p className="flex-1 grid place-items-center text-sm text-ink-soft text-center px-6">
                Your first stamps appear here as you post and grow. Every stamp stays, for good.
              </p>
            )}
            {pages > 1 && (
              <nav aria-label="Passport pages" className="flex items-center justify-center gap-3 mt-3 text-sm">
                {page > 1 ? <Link href={`?page=${page - 1}`} className="chip">‹</Link> : <span className="chip" aria-disabled="true">‹</span>}
                <span className="tnum text-ink-soft">Page {page} of {pages}</span>
                {page < pages ? <Link href={`?page=${page + 1}`} className="chip">›</Link> : <span className="chip" aria-disabled="true">›</span>}
              </nav>
            )}
          </section>
        </div>
      </div>

      <section className="mt-10">
        <h2 className="display text-3xl text-center">Stamps you can collect</h2>
        <p className="text-center text-sm text-ink-soft mb-5">{earned.length} of {STAMPS.length} collected. Stamps are never taken away.</p>
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {STAMPS.map((def) => {
            const m = got.get(def.key);
            return (
              <li key={def.key} className={`card p-3 flex flex-col items-center text-center ${m ? '' : 'opacity-80'}`}>
                <Stamp def={def} month={m} size={120} />
                <p className="mt-2 text-sm font-extrabold">{def.name}</p>
                <p className="text-xs text-ink-soft">{def.text}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <Updated at={s.updated_at} />
    </>
  );
}
