'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Item = { href: string; label: string; active: boolean; badge?: number; icon: React.ReactNode };

function useItems(flags: number): Item[] {
  const path = usePathname();
  return [
    { href: '/', label: 'Leaderboard', active: path === '/' || path.startsWith('/students'), icon: <IconHome /> },
    { href: '/flags', label: 'Attention', active: path.startsWith('/flags'), badge: flags, icon: <IconFlag /> },
    { href: '/roster', label: 'Roster', active: path.startsWith('/roster'), icon: <IconList /> },
    { href: '/runs', label: 'Runs', active: path.startsWith('/runs'), icon: <IconPulse /> },
    { href: '/settings', label: 'Settings', active: path.startsWith('/settings'), icon: <IconSliders /> },
  ];
}

/** Sidebar links on desktop. */
export function NavLinks({ flags }: { flags: number }) {
  const items = useItems(flags);
  return (
    <nav className="hidden md:flex flex-col gap-1 text-sm">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          aria-current={i.active ? 'page' : undefined}
          className={`flex items-center gap-3 rounded-full px-4 py-2.5 whitespace-nowrap ${
            i.active ? 'bg-ink text-on-neon font-semibold' : 'text-ink-soft hover:text-ink hover:bg-surface'
          }`}
        >
          {i.icon}
          <span className="flex-1">{i.label}</span>
          {!!i.badge && (
            <span className="tnum text-xs font-semibold rounded-full px-2 py-0.5 bg-pink text-on-neon">{i.badge}</span>
          )}
        </Link>
      ))}
    </nav>
  );
}

/** Floating pill bar on phones: the active page shows its label, the rest are icons. */
export function BottomNav({ flags }: { flags: number }) {
  const items = useItems(flags);
  return (
    <nav
      aria-label="Main"
      className="md:hidden fixed bottom-4 inset-x-4 z-20 flex items-center justify-between rounded-full
        bg-surface/95 backdrop-blur border border-rule px-2 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.6)]"
    >
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          aria-current={i.active ? 'page' : undefined}
          aria-label={i.label}
          className={`relative flex items-center gap-2 rounded-full px-4 py-2.5 text-sm ${
            i.active ? 'bg-ink text-on-neon font-semibold' : 'text-ink-soft'
          }`}
        >
          {i.icon}
          {i.active && <span>{i.label}</span>}
          {!!i.badge && !i.active && (
            <span className="absolute top-1 right-2 size-2 rounded-full bg-pink" aria-hidden />
          )}
        </Link>
      ))}
    </nav>
  );
}

const svg = {
  width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
} as const;
function IconHome() {
  return <svg {...svg}><path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" /></svg>;
}
function IconFlag() {
  return <svg {...svg}><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></svg>;
}
function IconList() {
  return <svg {...svg}><path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01" /></svg>;
}
function IconPulse() {
  return <svg {...svg}><path d="M3 12h4l3-8 4 16 3-8h4" /></svg>;
}
function IconSliders() {
  return <svg {...svg}><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg>;
}
