'use client';
// The live parts of the 100 Post Challenge: the counter that rolls up like a slot machine with the
// bar filling along, and the grid whose gift circles open the first time they're reached.
import { useEffect, useState } from 'react';
import { REWARD_STEPS } from '@/lib/stamps';
import { giftCelebration } from '@/components/hub-fx';

const still = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** "X / 100 posts", progress bar and the next-reward line. */
export function ChallengeProgress({ total, posts }: { total: number; posts: number }) {
  const [n, setN] = useState(total);
  useEffect(() => {
    if (still() || total <= 0) return;
    let raf = 0;
    const t0 = performance.now(), ms = 1500;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setN(Math.round(total * (1 - Math.pow(1 - p, 4))));   // fast at first, slowing at the end
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    setN(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [total]);

  const next = REWARD_STEPS.find((s) => s > posts);
  const left = next ? next - posts : 0;
  return (
    <div className="text-center">
      <p className="display text-4xl sm:text-6xl tnum whitespace-nowrap"><span className="text-brand">{n}</span> / 100 posts</p>
      <div className="mx-auto mt-4 h-2.5 max-w-sm rounded-full bg-paper overflow-hidden" role="progressbar"
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={total} aria-label="Posts towards 100">
        <div className="h-full rounded-full bg-good" style={{ width: `${n}%` }} />
      </div>
      <p className="mt-4 font-semibold">
        {posts >= 100 ? 'You did it! All 100 posts done 🏆'
          : `You have just ${left} ${left === 1 ? 'post' : 'posts'} to go until your next reward! 🤩`}
      </p>
    </div>
  );
}

/**
 * The 100 circles, as in the client's version: 1–99 in rows of ten (orange = not yet, green ✓ =
 * posted, navy gift circles with a breathing gold ring at the milestones) and Post 100 as a big
 * trophy circle centred underneath.
 *
 * Gift celebration (the client's rule): only for a reward reached in the latest daily update, and only
 * once per reward on each phone or computer. A student who reached 15 posts last week and is now at
 * 20 sees nothing.
 */
export function PostGrid({ total, handle, recent }: { total: number; handle: string; recent: number[] }) {
  const steps = new Set(REWARD_STEPS);
  const [opening, setOpening] = useState<number[]>([]);

  useEffect(() => {
    const key = `cta-gifts-${handle}`;
    let seen: number[] = [];
    try {
      seen = JSON.parse(localStorage.getItem(key) ?? '[]');
      localStorage.setItem(key, JSON.stringify([...new Set([...seen, ...recent])]));
    } catch { return; }   // storage blocked: no animation, nothing breaks
    const fresh = still() ? [] : recent.filter((s) => s <= total && !seen.includes(s));
    if (!fresh.length) return;
    setOpening(fresh);
    const t = setTimeout(() => giftCelebration(() => setOpening([])), 400);
    return () => clearTimeout(t);
  }, [handle, total, recent]);

  const check = (cls: string) => (
    <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  const done100 = total >= 100;

  return (
    <div aria-label={`${total} of 100 posts done`}>
      <ol className="grid grid-cols-10 gap-1.5 sm:gap-2.5">
        {Array.from({ length: 99 }, (_, i) => {
          const n = i + 1, done = n <= total, gift = steps.has(n), open = opening.includes(n);
          let look: string, body: React.ReactNode = n;
          if (gift && (!done || open)) {
            look = `bg-[var(--hub-navy)] gold-ring ${open ? 'gift-open' : ''}`;
            body = <span className="gift-wiggle text-sm sm:text-lg">🎁</span>;
          } else if (done) {
            look = `bg-good text-white shadow-[inset_0_-3px_0_rgba(0,0,0,0.15)] ${gift ? 'ring-2 sm:ring-[3px] ring-gold' : ''}`;
            body = check('size-3 sm:size-5');
          } else {
            look = 'bg-brand text-white shadow-[inset_0_-3px_0_rgba(0,0,0,0.12)]';
          }
          return (
            <li key={n} title={gift ? `Reward at ${n} posts` : `Post ${n}`}
              style={gift ? { animationDelay: `${(n % 7) * -0.35}s` } : undefined}
              className={`relative aspect-square rounded-full grid place-items-center text-[10px] sm:text-sm font-bold tnum select-none ${look}`}>
              {body}
            </li>
          );
        })}
      </ol>
      <div className="mt-6 sm:mt-8 flex flex-col items-center" title="Post 100: the finish line">
        <span className={`grid place-items-center size-20 sm:size-28 rounded-full text-white ${done100 ? 'bg-good glow' : 'bg-[var(--hub-navy)] gold-ring'}`}>
          {done100 ? check('size-9 sm:size-12') : <span className="gift-wiggle text-4xl sm:text-5xl">🏆</span>}
        </span>
        <span className="mt-2.5 text-xs sm:text-sm font-extrabold tracking-[0.18em] uppercase text-[#c8962a]">Post 100</span>
      </div>
    </div>
  );
}
