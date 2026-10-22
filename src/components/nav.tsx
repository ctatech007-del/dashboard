'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function NavLinks({ flags }: { flags: number }) {
  const path = usePathname();
  const items = [
    { href: '/', label: 'Leaderboard', active: path === '/' || path.startsWith('/students') },
    { href: '/flags', label: 'Flags', badge: flags },
    { href: '/roster', label: 'Roster' },
    { href: '/settings', label: 'Settings' },
  ];
  return (
    <nav className="flex md:flex-col gap-1 text-sm overflow-x-auto min-w-0">
      {items.map((i) => {
        const active = i.active ?? path.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center justify-between gap-3 rounded-md px-3 py-2 whitespace-nowrap ${
              active ? 'bg-ink text-paper font-semibold' : 'hover:bg-paper'
            }`}
          >
            {i.label}
            {!!i.badge && (
              <span className={`tnum text-xs rounded-full px-2 py-0.5 ${active ? 'bg-paper text-ink' : 'bg-flag-soft text-flag'}`}>
                {i.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
