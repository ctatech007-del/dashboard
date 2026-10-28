import Link from 'next/link';
import { teamClient } from '@/lib/supabase';
import { day } from '@/lib/format';
import { compact, Empty, PageTitle, RankDot, StudentCell } from '@/components/ui';

export default async function ViralReels({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const { db } = await teamClient();
  const all = (await searchParams).all === '1';
  // Only final (day-7) counts rank here; students who left keep their Reels on this list.
  const { data: reels } = await db.from('counted_posts')
    .select('id, student_id, url, posted_at, final_views, raw->likesCount')
    .in('post_type', ['reel', 'video']).not('final_views', 'is', null)
    .order('final_views', { ascending: false }).limit(all ? 100 : 10);
  const ids = [...new Set((reels ?? []).map((r) => r.student_id))];
  const { data: who } = ids.length
    ? await db.from('students').select('id, name, ig_handle, status').in('id', ids)
    : { data: [] as { id: string; name: string; ig_handle: string; status: string }[] };
  const byId = new Map((who ?? []).map((s) => [s.id, s]));

  return (
    <>
      <PageTitle title="Viral Reels" sub="All-time top Reels by final views (counted 7 days after posting). Images and carousels have no public view count." />
      {!reels?.length ? (
        <Empty title="No final view counts yet">A Reel gets its final count 7 days after it’s posted.</Empty>
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table className="table">
              <thead><tr><th>#</th><th>Student</th><th>Posted</th><th>Views</th><th>Likes</th><th /></tr></thead>
              <tbody>
                {reels.map((r, i) => {
                  const s = byId.get(r.student_id);
                  return (
                    <tr key={r.id}>
                      <td><RankDot rank={i + 1} /></td>
                      <td>
                        {s ? <StudentCell id={s.id} handle={s.ig_handle} name={s.name} /> : '–'}
                        {s?.status === 'left' && <span className="text-xs text-ink-soft">left the academy</span>}
                      </td>
                      <td className="text-ink-soft">{day(r.posted_at)}</td>
                      <td className="font-extrabold tnum">{compact(r.final_views)}</td>
                      <td className="tnum">{compact(typeof r.likesCount === 'number' ? r.likesCount : null)}</td>
                      <td><a href={r.url} target="_blank" rel="noreferrer" className="font-bold text-brand hover:underline">View ↗</a></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!all && reels.length === 10 && (
            <p className="mt-3 text-center"><Link href="/viral?all=1" className="btn btn-quiet">Show top 100</Link></p>
          )}
        </>
      )}
    </>
  );
}
