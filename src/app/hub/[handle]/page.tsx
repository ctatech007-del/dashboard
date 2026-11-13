import Link from 'next/link';
import { redirect } from 'next/navigation';
import { hubStudent } from '@/lib/hub';
import { day } from '@/lib/format';
import { REWARD_STEPS } from '@/lib/stamps';
import { StudentHeader, Updated } from '@/components/hub';
import { ChallengeProgress, PostGrid } from '@/components/hub-challenge';
import { CountUp } from '@/components/hub-fx';

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="text-center px-2">
      <p className="text-[9px] sm:text-[11px] font-bold tracking-[0.08em] sm:tracking-[0.14em] uppercase whitespace-nowrap text-[#f2c45a]">{label}</p>
      <p className="mt-1 text-2xl sm:text-3xl font-bold text-white tnum leading-none">{children}</p>
    </div>
  );
}

export default async function Challenge({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const s = await hubStudent(decodeURIComponent(handle));
  if (!s) redirect(`/hub?notfound=${encodeURIComponent(decodeURIComponent(handle))}`);   // same as a search that finds nothing
  if (s.handle !== decodeURIComponent(handle)) redirect(`/hub/${s.handle}`);   // old handle → current

  const reached = new Map(s.rewards.map((r) => [r.step, r.reached_at]));
  // Level = 1 + milestones reached (the client's rule)
  const level = 1 + REWARD_STEPS.filter((n) => n <= s.total_posts).length;

  return (
    <>
      <StudentHeader handle={s.handle} active="challenge" />

      <div className="rise mx-auto grid max-w-lg grid-cols-3 divide-x divide-white/20 rounded-2xl bg-[#25366a]/90 px-2 py-4 border border-white/25 shadow-[0_12px_30px_-14px_rgba(20,30,70,0.8)]">
        <Stat label="Level">{level}</Stat>
        <Stat label="Total posts"><CountUp to={s.total_posts} /></Stat>
        <Stat label="Posts this month"><CountUp to={s.month_posts} /></Stat>
      </div>

      <section className="card mt-6 p-5 sm:p-8 rise">
        <ChallengeProgress total={Math.min(100, s.total_posts)} posts={s.total_posts} />
        <div className="mt-7"><PostGrid total={Math.min(100, s.total_posts)} handle={s.handle} /></div>
        <p className="mt-4 text-xs text-ink-soft text-center">
          Every feed post since you joined counts (reels, carousels, static posts). Stories aren’t included.
        </p>

        <hr className="my-7 border-0 border-t-2 border-dashed border-rule" />

        <h2 className="display text-2xl sm:text-3xl">🎁 Rewards along the way</h2>
        <p className="text-ink-soft mt-2 mb-5">
          Every gift circle unlocks a reward. When you reach one, we’ll message you on Heartbeat with what it is and how to claim it.
        </p>
        <ol className="flex flex-wrap gap-2.5">
          {REWARD_STEPS.map((n) => {
            const at = reached.get(n) ?? (n <= s.total_posts ? '' : undefined);
            return (
              <li key={n} title={at ? `Reached ${day(at)}` : undefined}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-semibold border-2 ${at !== undefined ? 'coin-1 border-[#d99a1f] text-white' : 'border-gold/70 text-ink'}`}>
                <span aria-hidden>{n === 100 ? '🏆' : '🎁'}</span>Post {n}
              </li>
            );
          })}
        </ol>
      </section>

      <p className="on-sky text-center text-sm mt-7 md:whitespace-nowrap">
        Changed your Instagram handle? <Link href="/hub/rename" className="font-bold underline">Tell us here</Link>, and your posts and passport stamps stay with you.
      </p>
      <Updated at={s.updated_at} />
    </>
  );
}
