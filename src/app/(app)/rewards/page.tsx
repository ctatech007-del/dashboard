import Link from 'next/link';
import { teamClient } from '@/lib/supabase';
import { day } from '@/lib/format';
import { markRewardSent } from '@/app/actions';
import { Empty, PageTitle, StudentCell } from '@/components/ui';

export default async function Rewards({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { db } = await teamClient();
  const show = (await searchParams).show === 'sent' ? 'sent' : 'due';
  const q = db.from('rewards').select('student_id, step, reached_at, sent_at, sent_by, note, students(name, ig_handle, heartbeat_url)');
  const { data } = await (show === 'due'
    ? q.is('sent_at', null).order('reached_at')
    : q.not('sent_at', 'is', null).order('sent_at', { ascending: false }).limit(200));
  const rows = (data ?? []).map((r) => ({ ...r, st: r.students as unknown as { name: string; ig_handle: string; heartbeat_url: string | null } }));
  const { count: due } = await db.from('rewards').select('step', { count: 'exact', head: true }).is('sent_at', null);

  return (
    <>
      <PageTitle title="Rewards" sub="100 Post Challenge rewards: who reached a step and still needs their message on Heartbeat.">
        <nav className="flex gap-1">
          <Link href="/rewards" aria-current={show === 'due' ? 'page' : undefined} className="chip">To send ({due ?? 0})</Link>
          <Link href="/rewards?show=sent" aria-current={show === 'sent' ? 'page' : undefined} className="chip">Sent</Link>
        </nav>
      </PageTitle>
      {!rows.length ? (
        <Empty title={show === 'due' ? 'Nothing to send' : 'Nothing sent yet'}>
          Rewards appear here the day a student’s post count reaches 10, 15, 30, 35, 50, 55, 70, 75, 90, 95 or 100.
        </Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Student</th><th>Reward</th><th>Reached</th><th>{show === 'due' ? 'Heartbeat' : 'Sent'}</th><th /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.student_id}-${r.step}`}>
                  <td><StudentCell id={r.student_id} handle={r.st.ig_handle} name={r.st.name} /></td>
                  <td><span className={`font-extrabold ${r.step === 100 ? 'text-brand' : ''}`}>{r.step === 100 ? '🏆 100 posts' : `🎁 ${r.step} posts`}</span></td>
                  <td className="text-ink-soft">{day(r.reached_at)}</td>
                  <td>
                    {show === 'due'
                      ? (r.st.heartbeat_url
                        ? <a href={r.st.heartbeat_url} target="_blank" rel="noreferrer" className="font-bold text-brand hover:underline">Open member page ↗</a>
                        : <Link href={`/roster?edit=${r.student_id}`} className="text-ink-soft text-xs">add Heartbeat link</Link>)
                      : <span className="text-xs text-ink-soft">{day(r.sent_at)} by {r.sent_by}{r.note && <span className="block">{r.note}</span>}</span>}
                  </td>
                  <td>
                    <form action={markRewardSent} className="flex items-center gap-2 justify-end">
                      <input type="hidden" name="student_id" value={r.student_id} />
                      <input type="hidden" name="step" value={r.step} />
                      {show === 'due' ? (
                        <>
                          <input name="note" placeholder="Note (optional)" className="field !w-40 !py-1 text-xs" aria-label="Note" />
                          <button className="btn !py-1.5 text-xs">Mark as sent</button>
                        </>
                      ) : (
                        <button name="undo" value="1" className="btn btn-quiet !py-1.5 text-xs">Undo</button>
                      )}
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-ink-soft mt-3">Once Heartbeat is connected (Phase 4), these messages go out automatically and are logged here.</p>
    </>
  );
}
