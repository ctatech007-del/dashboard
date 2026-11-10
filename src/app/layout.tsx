import type { Metadata } from 'next';
import { Fraunces, Outfit } from 'next/font/google';
import './globals.css';

// One look for Student Stats and the Student Hub (the client's redesign): serif headings, Outfit text
const serif = Fraunces({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-serif' });
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });

export const metadata: Metadata = {
  title: 'Student Stats · CTA',
  description: 'Creator Takeoff Academy: how students perform on Instagram, month by month',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${outfit.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
