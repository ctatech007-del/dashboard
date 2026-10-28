import Link from 'next/link';
import { monthLabel } from '@/lib/period';

export function PageTitle({ title, sub, children }: { title: string; sub?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="display text-4xl md:text-5xl">{title}</h1>
        {sub && <p className="text-sm text-ink-soft mt-1">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

export function Section({ title, action, children, className = '' }: {
  title: string; action?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={`card p-5 ${className}`}>
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="display text-2xl">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export const compact = (n: number | null | undefined) =>
  n === null || n === undefined ? '–'
    : Math.abs(n) >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`
      : Math.abs(n) >= 1e4 ? `${(n / 1e3).toFixed(n >= 1e5 ? 0 : 1)}K`
        : n.toLocaleString('en-IN');
export const signed = (n: number | null | undefined) =>
  n === null || n === undefined ? '–' : `${n > 0 ? '+' : n < 0 ? '−' : ''}${compact(Math.abs(n))}`;

/** ▲/▼ change pill. Colour follows direction; the arrow and sign carry it too, never colour alone. */
export function Delta({ value, suffix = '', vs }: { value: number | null; suffix?: string; vs?: string }) {
  if (value === null || !Number.isFinite(value)) return <span className="text-xs text-ink-soft">{vs ? `no ${vs} to compare` : '–'}</span>;
  const up = value > 0, flat = Math.round(value) === 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold rounded-full px-2 py-0.5 tnum ${
      flat ? 'bg-paper text-ink-soft' : up ? 'bg-good-soft text-good' : 'bg-bad-soft text-bad'}`}>
      {flat ? '–' : up ? '▲' : '▼'} {Math.abs(Math.round(value))}{suffix}
      {vs && <span className="font-semibold opacity-80">vs {vs}</span>}
    </span>
  );
}

/** Stat tile: label, value, optional delta and footnote. */
export function Kpi({ label, value, tone, children }: {
  label: string; value: React.ReactNode; tone?: 'good' | 'bad'; children?: React.ReactNode;
}) {
  return (
    <div className="card px-5 py-4">
      <p className="text-xs font-bold text-ink-soft">{label}</p>
      <p className={`text-3xl font-extrabold mt-1 ${tone === 'good' ? 'text-good' : tone === 'bad' ? 'text-bad' : ''}`}>{value}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

/** Rank number in a medal-coloured circle for the top 3. */
export function RankDot({ rank }: { rank: number }) {
  const medal = rank === 1 ? 'bg-gold text-white' : rank === 2 ? 'bg-silver text-white' : rank === 3 ? 'bg-bronze text-white' : 'bg-paper text-ink-soft';
  return <span className={`inline-grid place-items-center size-7 rounded-full text-xs font-extrabold tnum ${medal}`}>{rank}</span>;
}

/** Handle on top, name and Instagram link underneath; the handle opens the student page. */
export function StudentCell({ id, handle, name }: { id: string; handle: string; name: string }) {
  return (
    <div className="min-w-0">
      <Link href={`/students/${id}`} className="font-extrabold hover:underline underline-offset-4">@{handle}</Link>
      <p className="text-xs text-ink-soft truncate">
        {name} ·{' '}
        <a href={`https://instagram.com/${handle}`} target="_blank" rel="noreferrer" className="hover:text-ink">Instagram ↗</a>
      </p>
    </div>
  );
}

/** "Oct 2026 (to Oct 12)" style label for a month picker option. */
export function monthOption(m: string, current: boolean, upto: string) {
  return `${monthLabel(m)}${current ? ` (to ${new Date(`${upto}T00:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' })})` : ''}`;
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-rule px-6 py-10 text-center">
      <p className="font-extrabold">{title}</p>
      {children && <p className="text-sm text-ink-soft mt-1 max-w-md mx-auto">{children}</p>}
    </div>
  );
}
