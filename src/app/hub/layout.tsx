import type { Metadata } from 'next';
import { Fraunces, Mrs_Saint_Delafield, Outfit } from 'next/font/google';
import { StampDefs } from '@/components/hub';

// Signature on the Passport, generated from the student's real name
const signature = Mrs_Saint_Delafield({ subsets: ['latin'], weight: '400', variable: '--font-signature' });
// The client's redesign: serif headings, Outfit for everything else
const serif = Fraunces({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-serif' });
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });

export const metadata: Metadata = {
  title: 'CTA Challenge Hub',
  description: 'Creator Takeoff Academy: leaderboards, your 100 Post Challenge and your Creator Passport',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default function HubLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`hub hub-sky ${signature.variable} ${serif.variable} ${outfit.variable} relative min-h-screen overflow-x-clip`}>
      <StampDefs />
      <main className="relative z-10 mx-auto max-w-[52rem] px-4 py-8 md:py-12">{children}</main>
    </div>
  );
}
