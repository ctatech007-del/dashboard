import Link from 'next/link';
import { relative } from '@/lib/format';
import { REWARD_STEPS, STAMP, tilt, type StampDef } from '@/lib/stamps';

export function HubTitle({ children }: { children: React.ReactNode }) {
  return <h1 className="display text-5xl md:text-6xl text-center">{children}</h1>;
}

export function Updated({ at }: { at: string | null }) {
  return <p className="text-center text-xs text-ink-soft mt-8">{at ? `Updated ${relative(at)}` : 'Not updated yet'}</p>;
}

/** "100 Post Challenge | Passport" switch on a student's pages. */
export function StudentTabs({ handle, active }: { handle: string; active: 'challenge' | 'passport' }) {
  const tab = (href: string, label: string, on: boolean) => (
    <Link href={href} aria-current={on ? 'page' : undefined}
      className={`rounded-full px-4 py-1.5 text-sm font-bold ${on ? 'bg-brand text-white' : 'text-ink hover:bg-surface'}`}>{label}</Link>
  );
  return (
    <nav aria-label="Your pages" className="flex justify-center gap-1 my-5">
      {tab(`/hub/${handle}`, '100 Post Challenge', active === 'challenge')}
      {tab(`/hub/${handle}/passport`, 'Passport', active === 'passport')}
    </nav>
  );
}

const monthYear = (d: string) =>
  new Date(`${d.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', month: 'short', year: 'numeric' }).toUpperCase();

/** An inked passport stamp: name, its condition and the month it was earned. Unearned = faint outline. */
export function Stamp({ def, month, size = 150 }: { def: StampDef; month?: string; size?: number }) {
  const ink = month ? def.ink : '#bfb2a2';
  const w = def.shape === 'circle' ? 140 : 168, h = def.shape === 'circle' ? 140 : 110;
  const words = def.text.split(' ');
  // Wrap the condition onto two lines of roughly equal length
  let cut = 0, best = Infinity;
  for (let i = 1; i < words.length; i++) {
    const d = Math.abs(words.slice(0, i).join(' ').length - words.slice(i).join(' ').length);
    if (d < best) { best = d; cut = i; }
  }
  const lines = words.length > 2 && def.text.length > 16 ? [words.slice(0, cut).join(' '), words.slice(cut).join(' ')] : [def.text];
  const outline = def.shape === 'circle'
    ? <><circle cx="70" cy="70" r="64" /><circle cx="70" cy="70" r="57" strokeWidth="1.2" /></>
    : def.shape === 'oval'
      ? <><ellipse cx="84" cy="55" rx="80" ry="50" /><ellipse cx="84" cy="55" rx="73" ry="43" strokeWidth="1.2" /></>
      : <><rect x="4" y="4" width="160" height="102" rx="12" /><rect x="11" y="11" width="146" height="88" rx="8" strokeWidth="1.2" strokeDasharray="4 3" /></>;
  const cx = w / 2;
  // Fit the name inside the inner border: shrink with length, two lines past 14 characters.
  const inner = def.shape === 'circle' ? 92 : def.shape === 'oval' ? 120 : 132;
  const nameWords = def.name.toUpperCase().split(' ');
  const nameLines = def.name.length > 14 && nameWords.length > 1
    ? [nameWords.slice(0, Math.ceil(nameWords.length / 2)).join(' '), nameWords.slice(Math.ceil(nameWords.length / 2)).join(' ')]
    : [def.name.toUpperCase()];
  const nameSize = Math.min(15, inner / (Math.max(...nameLines.map((l) => l.length)) * 0.72));
  const nameTop = h / 2 - (lines.length > 1 ? 16 : 10) - (nameLines.length - 1) * nameSize;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={size} height={(size * h) / w} role="img"
      aria-label={`${def.name}: ${def.text}${month ? `, earned ${monthYear(month)}` : ', not earned yet'}`}
      style={{ transform: `rotate(${month ? tilt(def.key) : 0}deg)`, opacity: month ? 0.92 : 0.7 }}>
      <g fill="none" stroke={ink} strokeWidth="2.4">{outline}</g>
      <g fill={ink} textAnchor="middle" fontFamily="var(--font-nunito), sans-serif">
        {nameLines.map((l, i) => (
          <text key={l} x={cx} y={nameTop + i * (nameSize + 1)} fontSize={nameSize.toFixed(1)} fontWeight="900" letterSpacing="0.5">{l}</text>
        ))}
        {lines.map((l, i) => (
          <text key={l} x={cx} y={h / 2 + 6 + i * 12} fontSize={def.shape === 'circle' ? 9 : 10} fontWeight="700">{l}</text>
        ))}
        <text x={cx} y={h / 2 + (lines.length > 1 ? 34 : 24)} fontSize="10" fontWeight="900" letterSpacing="1.5">
          {month ? monthYear(month) : '· · ·'}
        </text>
      </g>
    </svg>
  );
}

export function stampDef(key: string) {
  return STAMP.get(key);
}

/** 10×10 grid: ✓ for each post so far, gift circles at reward steps, a trophy at 100. */
export function PostGrid({ total }: { total: number }) {
  const steps = new Set(REWARD_STEPS);
  return (
    <ol className="grid grid-cols-10 gap-1.5 sm:gap-2" aria-label={`${total} of 100 posts done`}>
      {Array.from({ length: 100 }, (_, i) => {
        const n = i + 1, done = n <= total, reward = steps.has(n), finish = n === 100;
        const look = finish
          ? (done ? 'bg-gold text-white ring-4 ring-gold/30' : 'bg-ink text-gold ring-4 ring-gold/40')
          : reward
            ? (done ? 'bg-gold text-white' : 'bg-[#2e3a5c] text-white')
            : done ? 'bg-good text-white' : 'bg-brand text-white/90';
        return (
          <li key={n} title={finish ? '100: the finish line' : reward ? `Reward at ${n} posts` : `Post ${n}`}
            className={`aspect-square rounded-full grid place-items-center text-[10px] sm:text-xs font-extrabold tnum ${look}`}>
            {finish ? '🏆' : done && !reward ? '✓' : reward ? '🎁' : n}
          </li>
        );
      })}
    </ol>
  );
}
