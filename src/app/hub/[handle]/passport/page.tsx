import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { hubStudent } from '@/lib/hub';
import { mrz, STAMPS } from '@/lib/stamps';
import { BackLink, HubTitle, Plane, Stamp, stampDef, StudentTabs, Updated } from '@/components/hub';
import { CountUp } from '@/components/hub-fx';

const PER_PAGE = 6;
// Where stamps land on a page: a little crooked and overlapping, like a real passport.
const SLOTS = [
  { l: 2, t: 6, w: 50 }, { l: 50, t: 3, w: 48 }, { l: 6, t: 36, w: 42 },
  { l: 50, t: 35, w: 46 }, { l: 2, t: 66, w: 46 }, { l: 52, t: 67, w: 42 },
];
const GROUPS = ['Academy', 'Posting', 'Followers', 'Growth', 'Views', 'Specials'];

export default async function Passport({ params, searchParams }: {
  params: Promise<{ handle: string }>; searchParams: Promise<{ spread?: string }>;
}) {
  const { handle } = await params;
  const s = await hubStudent(decodeURIComponent(handle));
  if (!s) notFound();
  if (s.handle !== decodeURIComponent(handle)) redirect(`/hub/${s.handle}/passport`);

  const earned = s.stamps.filter((x) => stampDef(x.stamp));   // in the order they were earned
  const got = new Set(earned.map((x) => x.stamp));
  // Page 1 is the details page; stamps fill pages 2, 3, … six at a time.
  const pages = 1 + Math.max(1, Math.ceil(earned.length / PER_PAGE));
  const spreads = Math.ceil(pages / 2);
  const spread = Math.min(spreads, Math.max(1, Number((await searchParams).spread) || 1));
  const left = spread * 2 - 1, right = spread * 2;

  const since = new Date(`${s.member_since}T00:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', month: 'short', year: 'numeric' });
  const [mrz1, mrz2] = mrz(s.name, s.handle, s.member_since, earned.length);
  const todo = STAMPS.filter((d) => !got.has(d.key));

  const field = (label: string, value: React.ReactNode) => (
    <div>
      <p className="text-[9px] sm:text-[10px] font-semibold tracking-[0.14em] uppercase text-[#8a7a68]">{label}</p>
      <p className="text-sm sm:text-base font-bold leading-tight">{value}</p>
    </div>
  );

  const details = (
    <div className="flex h-full flex-col">
      <p className="flex items-center gap-3 font-extrabold tracking-[0.14em] text-base sm:text-lg pb-3 border-b border-[#d8cbb5]">
        <span className="grid place-items-center size-9 rounded-full border-2 border-[#a8812a] text-[#a8812a] shadow-[inset_0_0_0_3px_#f5ecdc,inset_0_0_0_4px_#a8812a]">
          <Plane className="size-4 rotate-90" />
        </span>
        CREATOR PASSPORT
      </p>
      <div className="mt-4 grid grid-cols-[minmax(84px,104px)_1fr] gap-4">
        <div className="holo relative aspect-[3/4] rounded-md border border-[#d8cbb5] overflow-hidden" aria-hidden>
          <span className="absolute left-1/2 top-[24%] -translate-x-1/2 size-[42%] rounded-full bg-[#a69c8c]/70" />
          <span className="absolute left-1/2 -bottom-[18%] -translate-x-1/2 w-[80%] aspect-square rounded-full bg-[#a69c8c]/70" />
        </div>
        <div className="space-y-2">
          {field('Handle', `@${s.handle}`)}
          {field('Type', 'Creator')}
          {field('Member since', since)}
          {field('Stamps', `${earned.length} / ${STAMPS.length}`)}
          {field('Issued by', 'Creator Takeoff Academy')}
        </div>
      </div>
      <div className="mt-4">
        <p className="text-[9px] sm:text-[10px] font-semibold tracking-[0.14em] uppercase text-[#8a7a68]">Signature of holder</p>
        <p className="text-4xl sm:text-5xl text-[#25366a] -rotate-2 mt-1 truncate" style={{ fontFamily: 'var(--font-signature), cursive' }}>{s.name}</p>
      </div>
      <div className="mt-auto pt-4 border-t border-[#d8cbb5] font-mono text-[10px] sm:text-[11px] leading-relaxed tracking-[0.1em] text-[#3a3027] overflow-hidden whitespace-nowrap" aria-label="Passport machine-readable lines">
        <p>{mrz1}</p><p>{mrz2}</p>
      </div>
    </div>
  );

  const stampPage = (p: number) => {
    const list = earned.slice((p - 2) * PER_PAGE, (p - 1) * PER_PAGE);
    return (
      <div className="relative h-full min-h-[340px]">
        <Plane className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-48 text-[#2b2119] opacity-[0.05] rotate-45" />
        {list.length ? list.map((x, i) => (
          <div key={x.stamp} className="absolute" style={{ left: `${SLOTS[i].l}%`, top: `${SLOTS[i].t}%`, width: `${SLOTS[i].w}%` }}>
            <Stamp def={stampDef(x.stamp)!} month={x.earned_month} fluid delay={200 + i * 180} />
          </div>
        )) : (
          <p className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-[#8a7a68]">
            {p === 2 ? 'Your first stamps land here as you post and grow. Every stamp stays, for good.' : 'Room for your next stamps.'}
          </p>
        )}
      </div>
    );
  };

  const page = (p: number, side: 'left' | 'right') => (
    <section className={`guilloche relative min-w-0 px-5 pt-4 pb-8 sm:px-7 ${side === 'left' ? 'md:rounded-l-xl' : 'md:rounded-r-xl'} max-md:rounded-xl`}>
      {/* Spine shadow */}
      <span aria-hidden className={`pointer-events-none absolute inset-y-0 w-10 max-md:hidden ${side === 'left'
        ? 'right-0 bg-gradient-to-l from-black/15 to-transparent' : 'left-0 bg-gradient-to-r from-black/15 to-transparent'}`} />
      <p className="text-center text-[10px] sm:text-xs font-bold tracking-[0.25em] text-[#7d6e5d] mb-4">CREATOR TAKEOFF ACADEMY</p>
      <div className="md:aspect-[4/5] md:min-h-0 min-h-[340px]">{p === 1 ? details : stampPage(p)}</div>
      <p className="absolute bottom-2.5 inset-x-0 text-center text-xs text-[#8a7a68] tnum">{p}</p>
    </section>
  );

  return (
    <>
      <BackLink />
      <HubTitle>Passport</HubTitle>
      <p className="text-center text-ink-soft mt-2">IG Handle: <strong className="text-ink">@{s.handle}</strong></p>
      <StudentTabs handle={s.handle} active="passport" />

      {/* Collection meter */}
      <div className="rise mx-auto mb-5 flex max-w-md items-center gap-3 rounded-full bg-[var(--hub-navy)] px-4 py-2.5 shadow-[0_5px_0_rgba(0,0,0,0.25)]">
        <span className="pixel text-[9px] text-[#f6cf62] whitespace-nowrap">STAMPS</span>
        <span className="relative h-3 flex-1 rounded-full bg-white/15 overflow-hidden">
          <span className="absolute inset-y-0 left-0 rounded-full coin-1" style={{ width: `${(earned.length / STAMPS.length) * 100}%` }} />
        </span>
        <span className="font-extrabold text-white tnum"><CountUp to={earned.length} />/{STAMPS.length}</span>
      </div>

      <div className="cover rounded-2xl p-2.5 sm:p-3 shadow-[0_30px_60px_-30px_rgba(20,30,60,0.8)] rise">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 md:gap-0">
          {page(left, 'left')}
          {page(right, 'right')}
        </div>
      </div>

      {spreads > 1 && (
        <nav aria-label="Passport pages" className="flex items-center justify-center gap-4 mt-5">
          {spread > 1
            ? <Link href={`?spread=${spread - 1}`} className="arcade grid place-items-center size-10 rounded-full bg-surface border border-rule text-lg font-bold" aria-label="Previous pages">‹</Link>
            : <span className="grid place-items-center size-10 rounded-full bg-surface/50 text-ink-soft/50 text-lg" aria-hidden>‹</span>}
          <span className="tnum text-ink-soft">Pages {left}–{right} of {spreads * 2}</span>
          {spread < spreads
            ? <Link href={`?spread=${spread + 1}`} className="arcade grid place-items-center size-10 rounded-full bg-surface border border-rule text-lg font-bold" aria-label="Next pages">›</Link>
            : <span className="grid place-items-center size-10 rounded-full bg-surface/50 text-ink-soft/50 text-lg" aria-hidden>›</span>}
        </nav>
      )}

      <section className="mt-14">
        <p className="text-center pixel text-[9px] sm:text-[10px] text-brand">★ ACHIEVEMENTS ★</p>
        <h2 className="text-center font-bold tracking-[0.2em] uppercase text-sm mt-2">Stamps you can collect</h2>
        {todo.length ? (
          <>
            <p className="text-center text-sm text-ink-soft mt-1">{todo.length} still locked. Stamps are never taken away once you have them.</p>
            {GROUPS.map((g, gi) => {
              const row = todo.filter((d) => d.group === gi);
              if (!row.length) return null;
              return (
                <ul key={g} aria-label={g} className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-8">
                  {row.map((d) => (
                    <li key={d.key} className="w-36 text-center group">
                      <div className="h-28 grid place-items-center transition-transform group-hover:-translate-y-1 group-hover:rotate-[-3deg]">
                        <Stamp def={d} size={d.shape === 'circle' || d.shape === 'seal' || d.shape === 'octagon' ? 104 : 136} />
                      </div>
                      <p className="mt-2 font-bold">{d.name}</p>
                      <p className="text-xs text-ink-soft">{d.text}</p>
                    </li>
                  ))}
                </ul>
              );
            })}
          </>
        ) : (
          <p className="text-center mt-4 text-lg font-bold">🏆 Every stamp collected. Legendary.</p>
        )}
      </section>

      <Updated at={s.updated_at} />
    </>
  );
}
