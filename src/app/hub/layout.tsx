import type { Metadata } from 'next';
import { Mrs_Saint_Delafield } from 'next/font/google';
import { StampDefs } from '@/components/hub';

// Signature on the Passport, generated from the student's real name
const signature = Mrs_Saint_Delafield({ subsets: ['latin'], weight: '400', variable: '--font-signature' });

export const metadata: Metadata = {
  title: 'CTA Challenge Hub',
  description: 'Creator Takeoff Academy: leaderboards, your 100 Post Challenge and your Creator Passport',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default function HubLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`hub sky ${signature.variable} relative min-h-screen overflow-x-clip`}>
      <StampDefs />
      <main className="relative z-10 mx-auto max-w-[52rem] px-4 py-8 md:py-12">{children}</main>
    </div>
  );
}
