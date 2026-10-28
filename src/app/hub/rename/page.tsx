import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { HubTitle } from '@/components/hub';
import { RenameForm } from './form';

const STATUS: Record<string, { title: string; text: string }> = {
  checking: { title: 'Checking…', text: 'We’re confirming the new handle is your account. This takes a minute or two: refresh this page.' },
  approved: { title: 'Done ✓', text: 'Your new handle is saved. All your posts and stamps came with you.' },
  needs_review: { title: 'Passed to the team', text: 'We couldn’t confirm it automatically, so the team will check and update it for you.' },
  rejected: { title: 'Not changed', text: 'The team couldn’t confirm this change. Message them on Heartbeat if that’s a mistake.' },
};

export default async function Rename({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const { r } = await searchParams;
  let status: string | null = null;
  if (r && /^[0-9a-f-]{36}$/.test(r)) {
    const db = await supabase();
    const { data } = await db.rpc('hub_rename_status', { rid: r });
    status = (data as string | null) ?? null;
  }
  const s = status ? STATUS[status] : null;

  return (
    <>
      <p className="text-sm"><Link href="/hub" className="font-bold text-ink-soft hover:text-ink">← Back to leaderboards</Link></p>
      <HubTitle>Changed your handle?</HubTitle>
      <div className="card p-6 mt-6 max-w-md mx-auto">
        {s ? (
          <div role="status">
            <p className="display text-3xl">{s.title}</p>
            <p className="text-sm mt-2">{s.text}</p>
            <p className="mt-4 text-sm"><Link href="/hub" className="font-bold text-brand underline">Back to the Hub</Link></p>
          </div>
        ) : (
          <>
            <p className="text-sm text-ink-soft mb-4">
              Tell us your old and new Instagram handle. We check it’s the same account, then move your posts,
              rewards and stamps over automatically.
            </p>
            <RenameForm />
          </>
        )}
      </div>
    </>
  );
}
