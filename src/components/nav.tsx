'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const MAIN = [
  { href: '/', label: 'Overview', match: (p: string) => p === '/' },
  { href: '/students', label: 'Students', match: (p: string) => p.startsWith('/students') },
  { href: '/attention', label: 'Needs attention', match: (p: string) => p.startsWith('/attention'), badge: true },
  { href: '/leaderboard', label: 'Leaderboard', match: (p: string) => p.startsWith('/leaderboard') },
  { href: '/viral', label: 'Viral Reels', match: (p: string) => p.startsWith('/viral') },
];
const TOOLS = [
  { href: '/troubleshooting', label: 'Troubleshooting', match: (p: string) => p.startsWith('/troubleshooting') },
  { href: '/roster', label: 'Roster', match: (p: string) => p.startsWith('/roster') },
  { href: '/settings', label: 'Settings', match: (p: string) => p.startsWith('/settings') },
];

/** Sidebar on desktop, a scrolling row on phones. */
export function NavLinks({ attention }: { attention: number }) {
  const path = usePathname();
  const item = (i: (typeof MAIN)[number] | (typeof TOOLS)[number]) => {
    const active = i.match(path);
    return (
      <Link
        key={i.href}
        href={i.href}
        aria-current={active ? 'page' : undefined}
        className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-bold whitespace-nowrap ${
          active ? 'bg-brand text-white' : 'text-ink hover:bg-paper'}`}
      >
        {i.label}
        {'badge' in i && attention > 0 && (
          <span className={`tnum text-xs rounded-full px-1.5 min-w-5 text-center ${active ? 'bg-white text-brand' : 'bg-bad text-white'}`}>
            {attention}
          </span>
        )}
      </Link>
    );
  };
  return (
    <nav aria-label="Main" className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
      {MAIN.map(item)}
      <hr className="hidden md:block border-rule my-3" />
      {TOOLS.map(item)}
    </nav>
  );
}
