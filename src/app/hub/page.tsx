import Link from 'next/link';
import { hubBoards } from '@/lib/hub';
import { istToday, monthLabel, monthStart, resetCountdown } from '@/lib/period';
import { compact } from '@/components/ui';
import { HubTitle, Updated } from '@/components/hub';

const MEDAL = ['bg-gold', 'bg-silver', 'bg-bronze'];

function Move({ rank, prev }: { rank: number; prev: number | null }) {
  if (prev === null) return <span className="text-[10px] font-extrabold rounded-full px-2 py-0.5 bg-brand-soft text-brand">NEW</span>;
  const m = prev - rank;
  if (m === 0) return <span className="text-xs text-ink-soft" aria-label="no change">–</span>;
  return (
    <span className={`text-xs font-extrabold rounded-full px-2 py-0.5 ${m > 0 ? 'bg-good-soft text-good' : 'bg-bad-soft text-bad'}`}
      aria-label={`${m > 0 ? 'up' : 'down'} ${Math.abs(m)} since yesterday`}>
      {m > 0 ? '▲' : '▼'} {Math.abs(m)}
    </span>
  );
}

export default async function Hub({ searchParams }: { searchParams: Promise<{ notfound?: string }> }) {
  const { notfound } = await searchParams;
  const b = await hubBoards();
  const month = monthLabel(monthStart(istToday())).split(' ')[0];
  const countdown = resetCountdown();
  const podium = [b.follower_growth[1], b.follower_growth[0], b.follower_growth[2]];

  return (
    <>
      <HubTitle>CTA Challenge Hub</HubTitle>

      <section className="mt-6 rounded-2xl bg-gradient-to-br from-[#f28a2e] to-[#ea6f17] px-6 py-8 text-center text-white shadow-[0_10px_30px_-12px_rgba(234,111,23,0.7)]">
        <p className="text-xs font-extrabold tracking-[0.2em] uppercase opacity-90">Search your handle to open your</p>
        <p className="mt-2 flex flex-wrap justify-center items-center gap-2">
          <span className="display text-2xl rounded-full bg-white text-brand px-4 py-1">100 Post Challenge</span>
          <span className="display text-2xl">&amp;</span>
          <span className="display text-2xl rounded-full bg-white text-brand px-4 py-1">Passport</span>
        </p>
        <form action="/hub/go" className="mt-5 mx-auto flex max-w-md rounded-full bg-white p-1.5">
          <label htmlFor="h" className="sr-only">Your Instagram handle</label>
          <span className="pl-3 self-center text-ink-soft font-bold">@</span>
          <input id="h" name="h" required autoComplete="off" autoCapitalize="none" spellCheck={false}
            placeholder="your Instagram handle" className="flex-1 min-w-0 bg-transparent px-2 text-ink outline-none" />
          <button className="rounded-full bg-ink px-5 py-2 text-sm font-extrabold text-white">Search</button>
        </form>
        {notfound && (
          <p role="alert" className="mt-3 text-sm font-bold">
            We couldn’t find @{notfound}. Type your exact handle.{' '}
            <Link href="/hub/rename" className="underline">Changed it recently?</Link>
          </p>
        )}
      </section>

      <h2 className="display text-4xl text-center mt-10 mb-4">Leaderboards</h2>

      <section className="card border-t-4 !border-t-brand p-5">
        <h3 className="display text-2xl">Follower Growth</h3>
        <p className="text-xs text-ink-soft">{month} · {countdown}</p>
        {b.follower_growth.length ? (
          <ol className="mt-6 grid grid-cols-3 items-end gap-3 text-center">
            {podium.map((g, i) => {
              const place = [2, 1, 3][i];
              return (
                <li key={place} className="min-w-0">
                  {g && (
                    <>
                      <span className={`mx-auto grid place-items-center rounded-full text-white font-extrabold ${MEDAL[place - 1]} ${place === 1 ? 'size-12 text-lg' : 'size-10'}`}>{place}</span>
                      <p className="mt-2 text-sm font-extrabold truncate">@{g.ig_handle}</p>
                      <p className="text-lg font-extrabold text-good tnum">+{compact(g.value)}</p>
                      <p className="text-xs text-ink-soft">followers</p>
                      <p className="mt-1"><Move rank={g.rank} prev={g.prev_rank} /></p>
                    </>
                  )}
                  <div className={`mt-3 rounded-t-lg ${['bg-silver/70', 'bg-gold/80', 'bg-bronze/70'][place - 1]} ${['h-16', 'h-24', 'h-12'][i]}`} aria-hidden />
                </li>
              );
            })}
          </ol>
        ) : <p className="mt-4 text-sm text-ink-soft">The ranking starts after the first daily updates this month.</p>}
      </section>

      <div className="grid md:grid-cols-2 gap-4 mt-4">
        <section className="card border-t-4 !border-t-brand p-5">
          <h3 className="display text-2xl">Most Viral Posts</h3>
          <p className="text-xs text-ink-soft">Last 7 days · Reels and videos</p>
          {b.viral.length ? (
            <ol className="mt-3 space-y-2">
              {b.viral.map((v) => (
                <li key={v.url} className="flex items-center gap-2 text-sm">
                  <span className={`grid place-items-center size-6 rounded-full text-xs font-extrabold ${v.rank <= 3 ? `${MEDAL[v.rank - 1]} text-white` : 'bg-paper text-ink-soft'}`}>{v.rank}</span>
                  <span className="flex-1 min-w-0 truncate font-bold">@{v.ig_handle}</span>
                  {v.is_new && <span className="text-[10px] font-extrabold rounded-full px-1.5 py-0.5 bg-brand-soft text-brand">NEW</span>}
                  <a href={v.url} target="_blank" rel="noreferrer" className="tnum font-extrabold hover:underline">
                    {compact(v.value)} views ↗
                  </a>
                </li>
              ))}
            </ol>
          ) : <p className="mt-3 text-sm text-ink-soft">No Reels in the last 7 days yet.</p>}
        </section>

        <section className="card border-t-4 !border-t-brand p-5">
          <h3 className="display text-2xl">Total Posts</h3>
          <p className="text-xs text-ink-soft">{month} · {countdown}</p>
          {b.total_posts.length ? (
            <ol className="mt-3 space-y-2">
              {b.total_posts.map((t, i) => (
                <li key={t.ig_handle} className="flex items-center gap-2 text-sm">
                  <span className={`grid place-items-center size-6 rounded-full text-xs font-extrabold ${t.rank <= 3 ? `${MEDAL[t.rank - 1]} text-white` : 'bg-paper text-ink-soft'}`}>{t.rank}</span>
                  <span className="flex-1 min-w-0 truncate font-bold">@{t.ig_handle}</span>
                  {i === b.total_posts.length - 1 && b.total_posts_tied.length > 0 && (
                    <details className="relative">
                      <summary className="list-none cursor-pointer text-xs font-extrabold rounded-full px-2 py-0.5 bg-paper">👥 +{b.total_posts_tied.length}</summary>
                      <ul className="absolute right-0 z-10 mt-1 w-48 card p-3 text-xs space-y-1">
                        <li className="text-ink-soft">Also on {t.value} posts:</li>
                        {b.total_posts_tied.map((h) => <li key={h} className="font-bold">@{h}</li>)}
                      </ul>
                    </details>
                  )}
                  <span className="tnum font-extrabold">{t.value} posts</span>
                </li>
              ))}
            </ol>
          ) : <p className="mt-3 text-sm text-ink-soft">No posts counted this month yet.</p>}
        </section>
      </div>

      <Updated at={b.updated_at} />
    </>
  );
}
