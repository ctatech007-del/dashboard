import type { Metadata } from 'next';
import { Mrs_Saint_Delafield, Outfit, Press_Start_2P } from 'next/font/google';
import { Backdrop, StampDefs } from '@/components/hub';

// Signature on the Passport, generated from the student's real name
const signature = Mrs_Saint_Delafield({ subsets: ['latin'], weight: '400', variable: '--font-signature' });
// Body font of the client's prototype
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });
// Arcade lettering for the game HUD and small labels
const pixel = Press_Start_2P({ subsets: ['latin'], weight: '400', variable: '--font-pixel' });

export const metadata: Metadata = {
  title: 'CTA Challenge Hub',
  description: 'Creator Takeoff Academy: leaderboards, your 100 Post Challenge and your Creator Passport',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default function HubLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`hub ${signature.variable} ${outfit.variable} ${pixel.variable} relative min-h-screen overflow-x-clip`}>
      <StampDefs />
      <Backdrop />
      <main className="relative mx-auto max-w-[52rem] px-4 py-8 md:py-12">{children}</main>
    </div>
  );
}
