// Search: exact handle only (current or a previous one), so nobody can browse other students.
import { NextResponse, type NextRequest } from 'next/server';
import { hubLookup } from '@/lib/hub';

export async function GET(req: NextRequest) {
  const typed = (req.nextUrl.searchParams.get('h') ?? '').trim().replace(/^@/, '').slice(0, 40);
  const handle = typed ? await hubLookup(typed) : null;
  const to = handle ? `/hub/${encodeURIComponent(handle)}` : `/hub?notfound=${encodeURIComponent(typed)}`;
  return NextResponse.redirect(new URL(to, req.url));
}
