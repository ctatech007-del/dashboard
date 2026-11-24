// Called by the scrape when a run finishes: clears every cached Hub page so the new numbers show at
// once. Only the shared function secret may call it.
import { revalidatePath } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const key = req.headers.get('x-function-secret');
  if (!process.env.FUNCTION_SECRET || key !== process.env.FUNCTION_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  revalidatePath('/hub', 'layout');
  return NextResponse.json({ revalidated: true, at: new Date().toISOString() });
}
