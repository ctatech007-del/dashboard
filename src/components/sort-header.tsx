import Link from 'next/link';
import { nextSort, type Dir, type Sort } from '@/lib/sort';

/** A sortable column header: the label is a link; the active column shows ▲ or ▼. */
export function SortTh({ label, sub, k, sort, href, firstDir = 'desc', align = 'left' }: {
  label: string; sub?: string; k: string; sort: Sort; href: (s: Sort) => string; firstDir?: Dir; align?: 'left' | 'right';
}) {
  const active = sort.key === k;
  return (
    <th aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined} className={align === 'right' ? '!text-right' : ''}>
      <Link href={href(nextSort(sort, k, firstDir))} className={`inline-flex flex-col hover:text-ink ${active ? 'text-ink' : ''} ${align === 'right' ? 'items-end' : ''}`}>
        <span>{label}{active && <span className="text-brand ml-1">{sort.dir === 'asc' ? '▲' : '▼'}</span>}</span>
        {sub && <small>{sub}</small>}
      </Link>
    </th>
  );
}

/** Builds the URL for a sort, keeping the page's other filters. */
export function sortHref(path: string, keep: Record<string, string | undefined>) {
  return (s: Sort) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(keep)) if (v) q.set(k, v);
    q.set('sort', s.key);
    q.set('dir', s.dir);
    return `${path}?${q}`;
  };
}
