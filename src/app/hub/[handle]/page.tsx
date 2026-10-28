import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { hubStudent } from '@/lib/hub';
import { day } from '@/lib/format';
import { istToday, monthLabel, monthStart } from '@/lib/period';
import { REWARD_STEPS } from '@/lib/stamps';
import { HubTitle, PostGrid, StudentTabs, Updated } from '@/components/hub';

export default async function Challenge({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const s = await hubStudent(decodeURIComponent(handle));
  if (!s) notFound();
  if (s.handle !== decodeURIComponent(handle)) redirect(`/hub/${s.handle}`);   // old handle → current

  const reached = new Map(s.rewards.map((r) => [r.step, r.reached_at]));
  const next = REWARD_STEPS.find((n) => n > s.total_posts);
  const total = Math.min(100, s.total_posts);

  return (
    <>
      <p className="text-sm"><Link href="/hub" className="font-bold text-ink-soft hover:text-ink">← Back to leaderboards</Link></p>
      <HubTitle>{total} / 100 posts</HubTitle>
      <p className="text-center text-sm text-ink-soft mt-1">@{s.handle}</p>
      <StudentTabs handle={s.handle} active="challenge" />

      <div className="card p-4 sm:p-6">
        <div className="h-2 rounded-full bg-paper overflow-hidden mb-3" aria-hidden>
          <div className="h-full rounded-full bg-good" style={{ width: `${total}%` }} />
        </div>
        <p className="text-center text-sm font-bold mb-5">
          📅 {s.month_posts} post{s.month_posts === 1 ? '' : 's'} in {monthLabel(monthStart(istToday())).split(' ')[0]}
          {next && <span className="text-ink-soft font-semibold"> · {next - s.total_posts} to go until your next reward</span>}
        </p>
        <PostGrid total={total} />
        <p className="mt-4 text-xs text-ink-soft text-center">
          Every feed post since you joined counts (Reels, carousels, photos; collabs too). Stories don’t.
        </p>
      </div>

      <section className="card p-5 mt-4">
        <h2 className="display text-2xl">🎁 Rewards along the way</h2>
        <p className="text-sm text-ink-soft mt-1 mb-4">
          The gift circles are your rewards. When you reach one, we’ll message you on Heartbeat with what it is and how to claim it.
        </p>
        <ol className="grid sm:grid-cols-2 gap-2">
          {REWARD_STEPS.map((n) => {
            const at = reached.get(n);
            return (
              <li key={n} className={`flex items-center gap-3 rounded-lg px-3 py-2 ${at ? 'bg-good-soft' : 'bg-paper'}`}>
                <span className={`grid place-items-center size-9 rounded-full text-xs font-extrabold text-white ${n === 100 ? 'bg-gold' : at ? 'bg-good' : 'bg-[#2e3a5c]'}`}>
                  {n === 100 ? '🏆' : n}
                </span>
                <span className="text-sm">
                  <strong>{n === 100 ? 'The finish line: 100 posts' : `${n} posts`}</strong>
                  <span className="block text-xs text-ink-soft">
                    {at ? `Unlocked ${day(at)} · check Heartbeat` : `${n - s.total_posts} posts to go`}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <p className="text-center text-sm mt-6">
        Changed your Instagram handle? <Link href="/hub/rename" className="font-bold text-brand underline">Tell us here</Link> and your posts stay with you.
      </p>
      <Updated at={s.updated_at} />
    </>
  );
}
