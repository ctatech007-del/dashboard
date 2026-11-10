import Link from 'next/link';
import { hubBoards, hubSuggest } from '@/lib/hub';
import { istToday, monthLabel, monthStart, resetCountdown } from '@/lib/period';
import { compact } from '@/components/ui';
import { Coin, GridIcon, HubTitle, InstaHandle as Who, PassportIcon, Plane, Stamp, Updated } from '@/components/hub';
import { CountUp } from '@/components/hub-fx';
import { STAMP } from '@/lib/stamps';

function Move({ rank, prev }: { rank: number; prev: number | null }) {
  if (prev === null) return <New />;
  const m = prev - rank;
  if (m === 0) return <span className="text-xs text-ink-soft" aria-label="no change">–</span>;
  return (
    <span className={`text-xs font-bold rounded-full px-2 py-0.5 ${m > 0 ? 'bg-good-soft text-good' : 'bg-bad-soft text-bad'}`}
      aria-label={`${m > 0 ? 'up' : 'down'} ${Math.abs(m)} since yesterday`}>
      {m > 0 ? '▲' : '▼'} {Math.abs(m)}
    </span>
  );
}

function New() {
  return <span className="text-[10px] font-extrabold tracking-wide rounded-md px-1.5 py-0.5 bg-brand text-white">NEW</span>;
}

function Board({ title, sub, icon, children }: { title: string; sub: string; icon: string; children: React.ReactNode }) {
  return (
    <section className="card relative overflow-hidden p-5 sm:p-6 rise">
      <span aria-hidden className="absolute inset-x-0 top-0 h-1.5 bg-brand" />
      <span aria-hidden className="absolute right-4 top-5 grid place-items-center size-10 rounded-full bg-brand-soft text-xl wiggle">{icon}</span>
      <h3 className="display text-2xl sm:text-3xl">{title}</h3>
      <p className="text-sm text-ink-soft">{sub}</p>
      {children}
    </section>
  );
}

const PLACE = ['1ST', '2ND', '3RD'];
const MEDAL = ['🥇', '🥈', '🥉'];
const BLOCK = ['coin-1', 'coin-2', 'coin-3'];

export default async function Hub({ searchParams }: { searchParams: Promise<{ notfound?: string }> }) {
  const { notfound } = await searchParams;
  const [b, suggest] = await Promise.all([hubBoards(), notfound ? hubSuggest(notfound) : Promise.resolve([])]);
  const month = monthLabel(monthStart(istToday())).split(' ')[0];
  const countdown = resetCountdown();
  const podium = [b.follower_growth[1], b.follower_growth[0], b.follower_growth[2]];

  return (
    <>
      <HubTitle>CTA Challenge Hub</HubTitle>

      {/* Search: the orange "boarding gate" with faded stamps, as in the prototype */}
      <section className="relative mt-7 overflow-hidden rounded-3xl bg-[linear-gradient(135deg,rgba(242,140,60,0.92),rgba(240,165,80,0.85))] border border-white/50 px-5 py-10 sm:py-12 text-center text-white shadow-[0_24px_50px_-24px_rgba(150,60,0,0.6)] rise">
        <div aria-hidden className="pointer-events-none absolute inset-0 text-white">
          <span className="absolute -left-10 -top-12 opacity-25">
            <Stamp def={{ ...STAMP.get('captain')!, name: 'Entry', text: 'CTA', big: '✈', ink: '#fff' }} month="2026-01-01" size={170} plain />
          </span>
          <span className="absolute -right-8 -bottom-10 rotate-[14deg] opacity-25">
            <Stamp def={{ ...STAMP.get('takeoff')!, text: '100 Post Challenge', ink: '#fff' }} month="2026-01-01" size={200} plain />
          </span>
          <svg className="absolute inset-x-0 top-6 h-24 w-full opacity-35" viewBox="0 0 800 100" preserveAspectRatio="none" fill="none">
            <path d="M-10 90 C 200 0, 600 0, 810 70" stroke="white" strokeWidth="2" strokeDasharray="2 9" strokeLinecap="round" />
          </svg>
          <span className="absolute right-[16%] top-5 rotate-[70deg] opacity-80 bob"><Plane className="size-6" /></span>
          <span className="absolute left-[12%] bottom-8 text-lg opacity-70 bob">✦</span>
          <span className="absolute right-[30%] bottom-14 text-xs opacity-60">✦</span>
        </div>

        <p className="relative text-xs sm:text-sm font-bold tracking-[0.22em] uppercase">Search your IG handle to open your</p>
        <p className="relative mt-3 flex flex-wrap justify-center items-center gap-3">
          <span className="display text-2xl sm:text-[2.6rem] rounded-2xl bg-white text-brand px-4 py-1.5 flex items-center gap-2.5 shadow-[0_6px_0_rgba(150,60,0,0.25)] -rotate-1">
            <GridIcon className="size-6 sm:size-8" />100 Post Challenge
          </span>
          <span className="display text-2xl sm:text-[2.6rem]">&amp;</span>
          <span className="display text-2xl sm:text-[2.6rem] rounded-2xl bg-white text-brand px-4 py-1.5 flex items-center gap-2.5 shadow-[0_6px_0_rgba(150,60,0,0.25)] rotate-1">
            <PassportIcon className="size-6 sm:size-8" />Passport
          </span>
        </p>
        <form action="/hub/go" className="relative mt-7 mx-auto flex max-w-lg rounded-full bg-white p-1.5 shadow-[0_10px_30px_-10px_rgba(120,50,0,0.5)] focus-within:ring-4 focus-within:ring-white/60">
          <label htmlFor="h" className="sr-only">Your Instagram handle</label>
          <span className="pl-4 self-center text-ink-soft font-bold">@</span>
          <input id="h" name="h" required autoComplete="off" autoCapitalize="none" spellCheck={false} defaultValue={notfound}
            placeholder="Instagram handle" className="flex-1 min-w-0 bg-transparent px-2 py-2 text-ink text-base font-semibold outline-none placeholder:text-ink-soft/70" />
          <button className="arcade rounded-full bg-[#f1e7d8] px-6 py-2.5 text-sm font-extrabold text-[#2b2119]">Search</button>
        </form>
        {notfound && (
          <div role="alert" className="relative mt-4 text-sm font-semibold">
            <p>We couldn’t find that handle in the challenge yet. Check the spelling and try again.</p>
            {suggest.length > 0 && (
              <p className="mt-2 flex flex-wrap justify-center items-center gap-2">
                Did you mean
                {suggest.map((h) => (
                  <Link key={h} href={`/hub/${h}`} className="arcade rounded-full bg-white/95 text-brand px-3 py-1 font-bold">@{h}</Link>
                ))}
              </p>
            )}
            <p className="mt-2 opacity-90">Changed your handle? <Link href="/hub/rename" className="underline font-bold">Tell us here</Link></p>
          </div>
        )}
      </section>

      <div className="mt-12 mb-5 text-center">
        <p className="on-sky text-xs font-bold tracking-[0.22em] uppercase">★ {month} high scores ★</p>
        <h2 className="display on-sky text-5xl sm:text-6xl mt-1">Leaderboards</h2>
      </div>

      <Board title="Follower Growth" sub={`${month} · ${countdown}`} icon="🚀">
        {b.follower_growth.length ? (
          <ol className="mt-6 grid grid-cols-3 items-end gap-2 sm:gap-4 text-center">
            {podium.map((g, i) => {
              const place = [2, 1, 3][i];
              return (
                <li key={place} className="min-w-0 flex flex-col">
                  {g && (
                    <div className="pop" style={{ animationDelay: `${[350, 600, 150][i]}ms` }}>
                      {place === 1 && <p aria-hidden className="text-2xl -mb-1 bob">👑</p>}
                      <span className="relative inline-block">
                        <Coin rank={place} className={place === 1 ? 'size-16 text-2xl' : 'size-12 text-lg'} />
                        {place === 1 && <><span aria-hidden className="absolute -left-4 top-1 text-gold text-sm bob">✦</span><span aria-hidden className="absolute -right-3 bottom-0 text-gold text-xs">✦</span></>}
                      </span>
                      <p className="mt-2 text-sm sm:text-base font-bold truncate"><Who handle={g.ig_handle} /></p>
                      <p className="text-xl sm:text-2xl font-extrabold text-good tnum">+<CountUp to={g.value} /></p>
                      <p className="text-xs text-ink-soft">followers</p>
                      <p className="mt-1.5 mb-3"><Move rank={g.rank} prev={g.prev_rank} /></p>
                    </div>
                  )}
                  <div aria-hidden style={{ animationDelay: `${[200, 0, 400][i]}ms` }}
                    className={`grow ${place === 1 ? 'shine' : ''} ${BLOCK[place - 1]} rounded-t-xl rounded-b-none flex flex-col items-center justify-start pt-3 gap-1 shadow-none ${['h-24', 'h-32', 'h-20'][i]}`}>
                    <span className="text-2xl sm:text-3xl drop-shadow">{MEDAL[place - 1]}</span>
                    <span className="text-[10px] sm:text-xs font-extrabold tracking-[0.12em] text-white/90">{PLACE[place - 1]}</span>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : <p className="mt-4 text-sm text-ink-soft">The ranking starts after the first daily updates this month.</p>}
      </Board>

      <div className="grid md:grid-cols-2 gap-5 mt-5">
        <Board title="Most Viral Posts" sub="Last 7 days" icon="🔥">
          {b.viral.length ? (
            <ol className="mt-4 divide-y divide-rule">
              {b.viral.map((v) => (
                <li key={v.url} className="flex items-center gap-3 py-3 text-sm">
                  <Coin rank={v.rank} />
                  <span className="flex-1 min-w-0 flex items-center gap-2">
                    <Who handle={v.ig_handle} className="truncate font-semibold" />{v.is_new && <New />}
                  </span>
                  <a href={v.url} target="_blank" rel="noreferrer" className="tnum font-extrabold hover:underline whitespace-nowrap" aria-label={`${compact(v.value)} views, open the post`}>
                    {compact(v.value)} <span className="font-normal text-ink-soft">views</span> <span className="text-brand">↗</span>
                  </a>
                </li>
              ))}
            </ol>
          ) : <p className="mt-4 text-sm text-ink-soft">No Reels in the last 7 days yet.</p>}
        </Board>

        <Board title="Total Posts" sub={`${month} · ${countdown}`} icon="📸">
          {b.total_posts.length ? (
            <ol className="mt-4 divide-y divide-rule">
              {b.total_posts.map((t, i) => (
                <li key={t.ig_handle} className="flex items-center gap-3 py-3 text-sm">
                  <Coin rank={t.rank} />
                  <span className="flex-1 min-w-0 flex items-center gap-2">
                    <Who handle={t.ig_handle} className="truncate font-semibold" />
                    {i === b.total_posts.length - 1 && b.total_posts_tied.length > 0 && (
                      <details className="relative">
                        <summary className="list-none cursor-pointer text-xs font-bold rounded-full px-2 py-0.5 bg-paper whitespace-nowrap">👥 +{b.total_posts_tied.length}</summary>
                        <ul className="absolute left-0 z-20 mt-1 w-52 card p-3 text-xs space-y-1.5">
                          <li className="text-ink-soft">Also on {t.value} posts:</li>
                          {b.total_posts_tied.map((h) => <li key={h}><Who handle={h} className="font-semibold" /></li>)}
                        </ul>
                      </details>
                    )}
                  </span>
                  <span className="tnum font-extrabold whitespace-nowrap">{t.value} <span className="font-normal text-ink-soft">{t.value === 1 ? 'post' : 'posts'}</span></span>
                </li>
              ))}
            </ol>
          ) : <p className="mt-4 text-sm text-ink-soft">No posts counted this month yet.</p>}
        </Board>
      </div>

      <Updated at={b.updated_at} />
    </>
  );
}
