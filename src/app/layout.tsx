import type { Metadata } from 'next';
import { Caveat_Brush, Nunito } from 'next/font/google';
import './globals.css';

const nunito = Nunito({ subsets: ['latin'], variable: '--font-nunito' });
const caveat = Caveat_Brush({ subsets: ['latin'], weight: '400', variable: '--font-caveat' });

export const metadata: Metadata = {
  title: 'Student Stats · CTA',
  description: 'Creator Takeoff Academy: how students perform on Instagram, month by month',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${nunito.variable} ${caveat.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
