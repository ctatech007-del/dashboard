// Table cells shared by Students and Needs attention.
import { relative } from '@/lib/format';
import type { StudentRow } from '@/lib/stats';
import { compact, signed } from '@/components/ui';

export const monthYear = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', month: 'short', year: 'numeric' });

export function Followers({ s }: { s: StudentRow }) {
  return <span className="font-extrabold tnum">{compact(s.followers)}</span>;
}

export function Growth({ s }: { s: StudentRow }) {
  if (s.growth === null) return <span className="text-ink-soft">–</span>;
  return <span className={`font-bold tnum ${s.growth > 0 ? 'text-good' : s.growth < 0 ? 'text-bad' : ''}`}>{signed(s.growth)}</span>;
}

/** Days without a post: amber from a week, red from two. */
export function NoPost({ s }: { s: StudentRow }) {
  if (s.status === 'left' || s.noPostDays === null) return <span className="text-ink-soft">–</span>;
  const d = s.noPostDays;
  return <span className={`font-bold tnum ${d >= 14 ? 'text-bad' : d >= 7 ? 'text-brand' : ''}`}>{d} d</span>;
}

export function LastSeen() {
  return <span className="text-ink-soft" title="Heartbeat isn’t connected yet">–</span>;
}

/** Last note's age; hovering shows the note itself. */
export function LastContact({ s }: { s: StudentRow }) {
  if (!s.lastNote) return <span className="text-ink-soft">never</span>;
  return (
    <span className="relative group inline-block">
      <span className="underline decoration-dotted underline-offset-4 cursor-help" tabIndex={0}>{relative(s.lastNote.created_at)}</span>
      <span role="tooltip" className="invisible group-hover:visible group-focus-within:visible absolute right-0 top-6 z-10 w-64 card p-3 text-xs text-left">
        <span className="block whitespace-pre-line text-ink">{s.lastNote.body}</span>
        <span className="block mt-1 text-ink-soft">{s.lastNote.author}</span>
      </span>
    </span>
  );
}

export function ContractEnds({ s }: { s: StudentRow }) {
  if (s.status === 'left') {
    return <span className="text-xs font-bold text-ink-soft uppercase">{s.leave_date ? `Left ${monthYear(s.leave_date)}` : 'Left'}</span>;
  }
  if (s.contractDays === null) return <span className="text-ink-soft">–</span>;
  const d = s.contractDays;
  return <span className={`font-bold tnum ${d < 0 ? 'text-bad' : d <= 30 ? 'text-brand' : ''}`}>{d < 0 ? `ended ${-d} d ago` : `${d} d`}</span>;
}
