import { NextResponse, type NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { csvCell } from '@/lib/format';

export async function GET(req: NextRequest) {
  const db = await supabase();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });

  let q = db.from('leaderboard').select('*').eq('status', 'active')
    .order('batch_name').order('batch_rank');
  const batch = req.nextUrl.searchParams.get('batch');
  if (batch) q = q.eq('batch_id', batch);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const head = ['batch', 'rank', 'name', 'handle', 'start_date', 'total_posts', 'posts_this_week',
    'current_streak', 'longest_streak', 'last_milestone', 'last_post_at', 'data_status'];
  const lines = [head.join(',')];
  for (const r of data ?? []) {
    lines.push([r.batch_name, r.batch_rank, r.name, `@${r.ig_handle}`, r.start_date, r.total_posts ?? 0,
      r.posts_this_week ?? 0, r.current_streak ?? 0, r.longest_streak ?? 0, r.last_milestone,
      r.last_post_at, r.last_outcome ?? 'not scraped'].map(csvCell).join(','));
  }
  const date = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const name = data?.[0] && batch ? `${data[0].batch_name}-${date}` : `all-batches-${date}`;
  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="cta-leaderboard-${name.replace(/[^\w-]+/g, '-')}.csv"`,
    },
  });
}
