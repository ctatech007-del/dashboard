'use client';
// The live parts of the 100 Post Challenge: the counter that rolls up like a slot machine with the
// bar filling along, and the grid whose gift circles open the first time they're reached.
import { useEffect, useState } from 'react';
import { REWARD_STEPS } from '@/lib/stamps';
import { burst } from '@/components/hub-fx';

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
      <p className="display text-5xl sm:text-6xl tnum"><span className="text-brand">{n}</span> / 100 posts</p>
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
 * 10 × 10 circles: orange = not posted yet, green ✓ = posted, gifts at the milestones, a glowing
 * trophy at 100. A milestone reached since the student last looked opens with a little animation.
 */
export function PostGrid({ total, handle }: { total: number; handle: string }) {
  const steps = new Set(REWARD_STEPS);
  const [opening, setOpening] = useState<number[]>([]);

  useEffect(() => {
    const key = `cta-gifts-${handle}`;
    const reached = REWARD_STEPS.filter((s) => s <= total);
    let seen: number[] | null = null;
    try {
      const raw = localStorage.getItem(key);
      seen = raw === null ? null : JSON.parse(raw);
      localStorage.setItem(key, JSON.stringify(reached));
    } catch { return; }   // storage blocked: no animation, nothing breaks
    // First visit only remembers what's already reached; later visits open the new gifts
    const fresh = seen === null || still() ? [] : reached.filter((s) => !seen!.includes(s));
    if (!fresh.length) return;
    setOpening(fresh);
    const t = setTimeout(() => { burst(); setOpening([]); }, 1300);
    return () => clearTimeout(t);
  }, [handle, total]);

  return (
    <ol className="grid grid-cols-10 gap-1.5 sm:gap-2.5 pb-6" aria-label={`${total} of 100 posts done`}>
      {Array.from({ length: 100 }, (_, i) => {
        const n = i + 1, done = n <= total, gift = steps.has(n) && n < 100, open = opening.includes(n);
        let look: string, body: React.ReactNode = n;
        if (n === 100) {
          look = `${done ? 'coin-1' : 'bg-[var(--hub-navy)]'} text-white glow scale-110 z-10`;
          body = <span className="text-base sm:text-2xl">🏆</span>;
        } else if (gift && (!done || open)) {
          look = `bg-[var(--hub-navy)] ring-2 sm:ring-[3px] ring-gold ${open ? 'gift-open' : ''}`;
          body = <span className="text-sm sm:text-lg">🎁</span>;
        } else if (done) {
          look = `bg-good text-white shadow-[inset_0_-3px_0_rgba(0,0,0,0.15)] ${gift ? 'ring-2 sm:ring-[3px] ring-gold' : ''}`;
          body = <svg viewBox="0 0 24 24" className="size-3 sm:size-5" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
        } else {
          look = 'bg-brand text-white shadow-[inset_0_-3px_0_rgba(0,0,0,0.12)]';
        }
        return (
          <li key={n} title={n === 100 ? 'Post 100: the finish line' : gift ? `Reward at ${n} posts` : `Post ${n}`}
            className={`relative aspect-square rounded-full grid place-items-center text-[10px] sm:text-sm font-bold tnum select-none ${look}`}>
            {body}
            {n === 100 && <span className="absolute -bottom-5 sm:-bottom-6 whitespace-nowrap text-[9px] sm:text-xs font-bold text-ink">Post 100</span>}
          </li>
        );
      })}
    </ol>
  );
}
