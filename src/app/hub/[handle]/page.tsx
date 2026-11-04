import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { hubStudent } from '@/lib/hub';
import { day } from '@/lib/format';
import { istToday, monthLabel, monthStart } from '@/lib/period';
import { REWARD_STEPS } from '@/lib/stamps';
import { BackLink, HubTitle, HudStat, Plane, PostGrid, StudentTabs, Updated } from '@/components/hub';
import { Confetti, CountUp } from '@/components/hub-fx';

export default async function Challenge({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const s = await hubStudent(decodeURIComponent(handle));
  if (!s) notFound();
  if (s.handle !== decodeURIComponent(handle)) redirect(`/hub/${s.handle}`);   // old handle → current

  const reached = new Map(s.rewards.map((r) => [r.step, r.reached_at]));
  const total = Math.min(100, s.total_posts);
  const next = REWARD_STEPS.find((n) => n > s.total_posts);
  const level = REWARD_STEPS.filter((n) => n <= s.total_posts).length + 1;
  const month = monthLabel(monthStart(istToday())).split(' ')[0];
  // Confetti when a reward was reached in the last 3 days
  const fresh = s.rewards.some((r) => Date.now() - new Date(r.reached_at).getTime() < 3 * 864e5);

  return (
    <>
      <BackLink />
      <HubTitle>100 Post Challenge</HubTitle>
      <p className="text-center text-ink-soft mt-2">IG Handle: <strong className="text-ink">@{s.handle}</strong></p>
      <StudentTabs handle={s.handle} active="challenge" />
      <Confetti fire={fresh} />

      {/* Game HUD */}
      <div className="rise grid grid-cols-4 gap-2 rounded-2xl bg-[var(--hub-navy)] px-3 py-4 sm:px-6 shadow-[0_6px_0_rgba(0,0,0,0.25)] border-2 border-[#3a4d82]">
        <HudStat label="LEVEL">{level}</HudStat>
        <HudStat label="POSTS"><CountUp to={s.total_posts} /></HudStat>
        <HudStat label={month.slice(0, 3).toUpperCase()}><CountUp to={s.month_posts} /></HudStat>
        <HudStat label="RANK">{s.month_rank ? <>#{s.month_rank}<span className="text-xs text-white/60">/{s.players}</span></> : '–'}</HudStat>
      </div>

      <section className="card mt-5 p-4 sm:p-8 rise">
        <p className="text-center display text-6xl sm:text-8xl leading-none">
          <span className="text-brand"><CountUp to={total} /></span> / 100 <span className="text-4xl sm:text-6xl">posts</span>
        </p>

        {/* Flight path: the plane flies along as posts come in, gifts mark the reward steps */}
        <div className="relative mx-auto mt-6 mb-2 max-w-xl h-8" aria-hidden>
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-3 rounded-full bg-paper border border-rule overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-[#f6b25c] to-brand" style={{ width: `${total}%` }} />
          </div>
          {REWARD_STEPS.filter((n) => n < 100).map((n) => (
            <span key={n} className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 size-2 rounded-full ${n <= total ? 'bg-white' : 'bg-gold'}`} style={{ left: `${n}%` }} />
          ))}
          <span className="absolute -right-2 top-1/2 -translate-y-1/2 text-lg">🏁</span>
          <span className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 text-[var(--hub-navy)] bob" style={{ left: `${Math.max(total, 2)}%` }}>
            <Plane className="size-7 rotate-90 drop-shadow" />
          </span>
        </div>
        <p className="text-center text-sm sm:text-base text-ink-soft mb-7">
          📅 <strong className="text-ink">{s.month_posts}</strong> post{s.month_posts === 1 ? '' : 's'} in {month}
          {next && <> · <strong className="text-ink">{next - s.total_posts}</strong> to go until your next reward</>}
        </p>

        <PostGrid total={total} reached={new Set(reached.keys())} />

        <p className="mt-5 text-xs text-ink-soft text-center">
          Every feed post since you joined counts (Reels, carousels, photos; collabs too). Stories don’t.
        </p>

        <hr className="my-7 border-0 border-t-2 border-dashed border-rule" />

        <h2 className="display text-3xl sm:text-4xl flex items-center gap-2"><span className="wiggle inline-block">🎁</span> Rewards along the way</h2>
        <p className="text-ink-soft mt-2 mb-5 max-w-xl">
          The gold circles are your milestones. Every time you reach one, a new reward unlocks.
          We’ll send you a message on Heartbeat to let you know what it is and how to claim it.
        </p>
        <ol className="flex flex-wrap gap-2.5">
          {REWARD_STEPS.map((n) => {
            const at = reached.get(n);
            const isNext = n === next;
            const label = n === 100 ? '🏆 Post 100' : `${at ? '✓' : '🎁'} Post ${n}`;
            if (at) {
              return (
                <li key={n}>
                  <Confetti className="arcade coin-1 rounded-full px-4 py-2 text-sm font-bold" >
                    <span title={`Unlocked ${day(at)}: check Heartbeat`}>{label}</span>
                  </Confetti>
                </li>
              );
            }
            return (
              <li key={n} className={`rounded-full px-4 py-2 text-sm font-bold border-2 ${isNext ? 'border-brand text-brand bg-brand-soft here' : 'border-gold text-ink'}`}>
                {label}{isNext && <span className="font-semibold"> · {n - s.total_posts} to go</span>}
              </li>
            );
          })}
        </ol>
      </section>

      <p className="text-center text-sm mt-7">
        Changed your Instagram handle? <Link href="/hub/rename" className="font-bold text-brand underline">Tell us here</Link> and your posts stay with you.
      </p>
      <Updated at={s.updated_at} />
    </>
  );
}
