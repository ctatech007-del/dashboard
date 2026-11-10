import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { hubStudent } from '@/lib/hub';
import { COLLECT_ROWS, mrz, placement, STAMP, STAMPS, visaPages } from '@/lib/stamps';
import { Plane, Stamp, StudentHeader, Updated } from '@/components/hub';
import { Booklet } from '@/components/hub-booklet';
import { CountUp } from '@/components/hub-fx';

const THUD_MS = 140;

/** One passport page: cream security paper, the academy name on top, a page number from page 2. */
function Paper({ n, visa, children }: { n: number; visa?: boolean; children: React.ReactNode }) {
  return (
    <div className="guilloche relative aspect-[10/13] w-full px-5 pt-4 pb-7 sm:px-6">
      <p className="text-center text-[9px] sm:text-[11px] font-bold tracking-[0.25em] uppercase text-[#7d6e5d]">Creator Takeoff Academy</p>
      {visa && <Plane className="pointer-events-none absolute left-1/2 top-1/2 size-[60%] -translate-x-1/2 -translate-y-1/2 rotate-45 text-[#2b2119] opacity-[0.045]" />}
      {children}
      {n > 1 && <p className="absolute inset-x-0 bottom-2 text-center text-[10px] sm:text-xs text-[#8a7a68] tnum">{n}</p>}
    </div>
  );
}

export default async function Passport({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const s = await hubStudent(decodeURIComponent(handle));
  if (!s) notFound();
  if (s.handle !== decodeURIComponent(handle)) redirect(`/hub/${s.handle}/passport`);

  const earned = s.stamps.filter((x) => STAMP.has(x.stamp));   // Takeoff first, then oldest first
  const got = new Set(earned.map((x) => x.stamp));
  const since = new Date(`${s.member_since}T00:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', month: 'short', year: 'numeric' });
  const [mrz1, mrz2] = mrz(s.name, s.member_since, earned.length);
  // Capitalised as the client asked; names typed in lower case get capitals, "Eva zu Beck" stays as written
  const signature = s.name === s.name.toLowerCase()
    ? s.name.trim().split(/\s+/).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ') : s.name.trim();

  const field = (label: string, value: React.ReactNode) => (
    <div>
      <p className="text-[8px] sm:text-[10px] font-semibold tracking-[0.14em] uppercase text-[#8a7a68]">{label}</p>
      <p className="text-[11px] sm:text-sm font-bold leading-tight">{value}</p>
    </div>
  );

  const dataPage = (
    <Paper n={1} key="p1">
      <div className="mt-2 sm:mt-3 flex h-[calc(100%-1.5rem)] flex-col">
        <p className="flex items-center gap-2.5 font-extrabold tracking-[0.12em] text-sm sm:text-lg pb-2.5 border-b border-[#d8cbb5]">
          <span className="grid place-items-center size-7 sm:size-9 rounded-full border-2 border-[#a8812a] text-[#a8812a] shadow-[inset_0_0_0_2px_#f5ecdc,inset_0_0_0_3px_#a8812a]">
            <Plane className="size-3 sm:size-4 rotate-90" />
          </span>
          CREATOR PASSPORT
        </p>
        <div className="mt-3 sm:mt-4 grid grid-cols-[34%_1fr] gap-3 sm:gap-4">
          <div className="holo relative aspect-[3/4] rounded-md border border-[#d8cbb5] overflow-hidden" aria-hidden>
            <span className="absolute left-1/2 top-[22%] -translate-x-1/2 size-[42%] rounded-full bg-[#a69c8c]/70" />
            <span className="absolute left-1/2 -bottom-[18%] -translate-x-1/2 w-[80%] aspect-square rounded-full bg-[#a69c8c]/70" />
          </div>
          <div className="space-y-1.5 sm:space-y-2 min-w-0">
            {field('Handle', <span className="break-all">@{s.handle}</span>)}
            {field('Type', 'Creator')}
            {field('Member since', since)}
            {field('Stamps', `${earned.length} / ${STAMPS.length}`)}
            {field('Issued by', 'Creator Takeoff Academy')}
          </div>
        </div>
        <div className="mt-3 sm:mt-4">
          <p className="text-[8px] sm:text-[10px] font-semibold tracking-[0.14em] uppercase text-[#8a7a68]">Signature of holder</p>
          <p className="mt-1 border-b border-[#bfb09a] pb-0.5 text-3xl sm:text-5xl leading-tight text-[#25366a] truncate" style={{ fontFamily: 'var(--font-signature), cursive' }}>{signature}</p>
        </div>
        <div className="mt-auto pt-2 font-mono text-[7.5px] sm:text-[10.5px] leading-relaxed tracking-[0.06em] text-[#3a3027] whitespace-nowrap overflow-hidden" aria-label="Passport machine-readable lines">
          <p>{mrz1}</p><p>{mrz2}</p>
        </div>
      </div>
    </Paper>
  );

  // Visa pages: five stamps each, at this member's stable positions and angles; an even page count.
  // Each page's stamps thud on one after another when it comes into view.
  const visas = visaPages(earned).map((list, i) => (
    <Paper n={i + 2} visa key={`p${i + 2}`}>
      {list.map((x, j) => {
        const p = placement(s.handle, x.stamp, j);
        const def = STAMP.get(x.stamp)!;
        const round = def.shape === 'circle' || def.shape === 'seal' || def.shape === 'octagon';
        return (
          <div key={x.stamp} className="stamp-hover absolute" style={{
            left: `${p.left + (round ? 4 : 0)}%`, top: `calc(1.9rem + ${p.top * 0.8}%)`, width: round ? '36%' : '45%',
          }}>
            <Stamp def={def} month={x.earned_month} fluid angle={p.tilt} strength={p.ink} delay={250 + j * THUD_MS} />
          </div>
        );
      })}
    </Paper>
  ));
  const pages = [dataPage, ...visas];
  if (pages.length % 2) pages.push(<Paper n={pages.length + 1} visa key="blank"><span /></Paper>);

  return (
    <>
      <StudentHeader handle={s.handle} active="passport" />

      {/* Stamp progress */}
      <div className="rise mx-auto mb-6 flex max-w-md items-center gap-3 rounded-full bg-[#25366a]/90 border border-white/25 px-5 py-3 shadow-[0_12px_30px_-14px_rgba(20,30,70,0.8)]">
        <span className="text-[10px] sm:text-xs font-bold tracking-[0.16em] uppercase text-[#f2c45a]">Stamps</span>
        <span className="relative h-2.5 flex-1 rounded-full bg-white/15 overflow-hidden">
          <span className="grow-x absolute inset-y-0 left-0 rounded-full coin-1" style={{ width: `${(earned.length / STAMPS.length) * 100}%` }} />
        </span>
        <span className="font-bold text-white tnum"><CountUp to={earned.length} />/{STAMPS.length}</span>
      </div>

      <div className="rise"><Booklet pages={pages} /></div>

      <section className="card mt-10 px-4 py-7 sm:px-8 sm:py-9 rise">
        <h2 className="display text-center text-3xl sm:text-4xl">Stamps you can collect</h2>
        {COLLECT_ROWS.map((row) => row.filter((k) => !got.has(k))).filter((row) => row.length).map((row) => (
          <ul key={row[0]} className="mt-8 flex flex-wrap justify-center gap-y-7">
            {row.map((k) => {
              const d = STAMP.get(k)!;
              return (
                <li key={k} className="group w-1/3 md:w-1/6 px-1 text-center">
                  <div className="h-20 sm:h-24 grid place-items-center transition-transform duration-200 group-hover:-translate-y-1 group-hover:-rotate-3">
                    <Stamp def={d} size={d.shape === 'circle' || d.shape === 'seal' || d.shape === 'octagon' ? 80 : 100} />
                  </div>
                  <p className="mt-2 text-sm font-bold">{d.name}</p>
                  <p className="text-xs text-ink-soft">{d.text}</p>
                </li>
              );
            })}
          </ul>
        ))}
        {got.size === STAMPS.length && <p className="mt-6 text-center font-bold">🏆 Every stamp collected. Legendary.</p>}
      </section>

      <p className="on-sky text-center text-sm mt-7 md:whitespace-nowrap">
        Changed your Instagram handle? <Link href="/hub/rename" className="font-bold underline">Tell us here</Link>, and your posts and passport stamps stay with you.
      </p>
      <Updated at={s.updated_at} />
    </>
  );
}
