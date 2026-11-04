import Link from 'next/link';
import { relative } from '@/lib/format';
import { REWARD_STEPS, STAMP, tilt, type StampDef } from '@/lib/stamps';

export function HubTitle({ children }: { children: React.ReactNode }) {
  return <h1 className="display title-pop text-5xl md:text-7xl text-center rise">{children}</h1>;
}

export function Updated({ at }: { at: string | null }) {
  return (
    <p className="text-xs text-ink-soft mt-8 flex items-center gap-1.5">
      <span aria-hidden>🔄</span>{at ? `Updated ${relative(at)}` : 'Not updated yet'}
    </p>
  );
}

export function BackLink() {
  return <p className="text-sm"><Link href="/hub" className="font-semibold text-ink-soft hover:text-ink">← Back to leaderboards</Link></p>;
}

/** "100 Post Challenge | Passport" switch; sticks to the top while scrolling, as in the prototype. */
export function StudentTabs({ handle, active }: { handle: string; active: 'challenge' | 'passport' }) {
  const tab = (href: string, label: string, on: boolean) => (
    <Link href={href} aria-current={on ? 'page' : undefined}
      className={`rounded-full px-5 py-2 text-sm font-bold transition-colors ${on ? 'bg-brand text-white arcade' : 'text-ink hover:bg-paper'}`}>{label}</Link>
  );
  return (
    <nav aria-label="Your pages" className="sticky top-3 z-30 flex justify-center my-6">
      <span className="sticky-tabs flex gap-1 rounded-full bg-surface/85 border border-rule p-1.5 shadow-lg">
        {tab(`/hub/${handle}`, '100 Post Challenge', active === 'challenge')}
        {tab(`/hub/${handle}/passport`, 'Passport', active === 'passport')}
      </span>
    </nav>
  );
}

/** Gold, silver and bronze coins with depth; plain for 4th and below. */
export function Coin({ rank, className = 'size-7 text-xs' }: { rank: number; className?: string }) {
  return <span className={`coin tnum ${rank <= 3 ? `coin-${rank}` : 'coin-n'} ${className}`}>{rank}</span>;
}

/* ───────────── Icons ───────────── */

export function GridIcon({ className = 'size-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      {[4, 12, 20].flatMap((y) => [4, 12, 20].map((x) => <circle key={`${x}${y}`} cx={x} cy={y} r="2.6" />))}
    </svg>
  );
}

export function PassportIcon({ className = 'size-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="4" y="2.5" width="16" height="19" rx="2.5" />
      <circle cx="12" cy="10" r="3.2" />
      <path d="M8 17h8" strokeLinecap="round" />
    </svg>
  );
}

export function Plane({ className = 'size-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M21.5 15.5v-2L13.5 9V3.5a1.5 1.5 0 0 0-3 0V9l-8 4.5v2l8-2.5v5.5l-2 1.5V22l3.5-1 3.5 1v-1.5l-2-1.5V13z" />
    </svg>
  );
}

/** Puffy outlined cloud, like the skies in 2000s platformers. */
function Cloud({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 120 56" className={className} style={style} aria-hidden>
      <path d="M18 50h86a14 14 0 0 0 1-28 20 20 0 0 0-36-10 16 16 0 0 0-28 6A16 16 0 0 0 18 50z"
        fill="var(--hub-card)" stroke="var(--hub-line)" strokeWidth="3" />
      <path d="M30 38c6 4 14 4 20 0M66 34c5 3 11 3 16 0" fill="none" stroke="var(--hub-line)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Behind every Hub page: clouds drifting by, a plane on a dotted route, and faded passport stamps
 * at the edges (the client asked for "a faded out passport" feel in the background).
 */
export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <Cloud className="drift absolute top-16 w-28 opacity-70" style={{ animationDuration: '70s', animationDelay: '-20s' }} />
      <Cloud className="drift absolute top-[38rem] w-20 opacity-50" style={{ animationDuration: '95s', animationDelay: '-60s' }} />
      <Cloud className="drift absolute top-[70rem] w-32 opacity-60" style={{ animationDuration: '85s', animationDelay: '-5s' }} />
      <svg className="absolute -left-10 top-40 w-[34rem] opacity-[0.16] max-md:hidden" viewBox="0 0 400 260" fill="none">
        <path d="M10 240 C 120 60, 260 40, 390 20" stroke="var(--ink-soft)" strokeWidth="2.5" strokeDasharray="2 10" strokeLinecap="round" />
      </svg>
      <span className="absolute left-[27rem] top-36 text-ink-soft opacity-30 rotate-[30deg] max-md:hidden"><Plane className="size-7" /></span>
      <div className="absolute -left-14 top-[30rem] w-56 opacity-[0.12] -rotate-12 max-lg:hidden">
        <Stamp def={STAMP.get('takeoff')!} month="2026-02-01" size={220} plain />
      </div>
      <div className="absolute -right-12 top-[14rem] w-52 opacity-[0.12] rotate-12 max-lg:hidden">
        <Stamp def={STAMP.get('wanderer')!} month="2026-06-01" size={200} plain />
      </div>
      <div className="absolute -right-10 top-[48rem] w-56 opacity-[0.12] -rotate-6 max-lg:hidden">
        <Stamp def={STAMP.get('hidden_gem')!} month="2026-05-01" size={200} plain />
      </div>
    </div>
  );
}

/* ───────────── Stamps ───────────── */

/** Shared SVG bits for every stamp on the page: the worn-ink texture and the curved text paths. */
export function StampDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden>
      <defs>
        <filter id="stamp-ink" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="7" result="noise" />
          <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.4 2.05" result="speckle" />
          <feComposite in="SourceGraphic" in2="speckle" operator="in" result="inked" />
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="3" result="warp" />
          <feDisplacementMap in="inked" in2="warp" scale="2.2" />
        </filter>
        {/* Name around the top of round stamps, ornaments around the bottom */}
        <path id="stamp-arc-top" d="M 19 75 A 56 56 0 0 1 131 75" />
        <path id="stamp-arc-bottom" d="M 12 75 A 63 63 0 0 0 138 75" />
      </defs>
    </svg>
  );
}

const monthYear = (d: string) =>
  new Date(`${d.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', month: 'short', year: 'numeric' }).toUpperCase();

/** Split a condition into at most two lines of about equal length. */
function twoLines(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const words = text.split(' ');
  let cut = 1, best = Infinity;
  for (let i = 1; i < words.length; i++) {
    const d = Math.abs(words.slice(0, i).join(' ').length - words.slice(i).join(' ').length);
    if (d < best) { best = d; cut = i; }
  }
  return [words.slice(0, cut).join(' '), words.slice(cut).join(' ')];
}

/** Font size so a line of `chars` letters fits `width` units (Outfit bold, caps ≈ 0.68em wide). */
const fit = (chars: number, width: number, max: number) => Math.min(max, width / (Math.max(chars, 1) * 0.68));

/**
 * A rubber stamp: worn ink, a slight tilt, the month it was earned. Unearned stamps are faint with a
 * lock. `plain` drops the tilt and animation (used for the faded background decoration).
 */
export function Stamp({ def, month, size = 150, plain = false, delay = 0, fluid = false }: {
  def: StampDef; month?: string; size?: number; plain?: boolean; delay?: number; fluid?: boolean;
}) {
  const earned = !!month;
  const ink = earned ? def.ink : '#b8a994';
  const date = month ? monthYear(month) : '';
  const name = def.name.toUpperCase();
  const text = def.text.toUpperCase();
  // The rest of the condition once the big figure is shown: "10K views on one post" → "VIEWS ON ONE POST"
  const rest = def.big && text.startsWith(def.big) ? text.slice(def.big.length).trim() : text;
  const t = (x: number, y: number, s: number, body: string, extra: React.SVGProps<SVGTextElement> = {}) => (
    <text key={`${y}-${body}`} x={x} y={y} fontSize={s.toFixed(1)} fontWeight="800" letterSpacing="1" {...extra}>{body}</text>
  );
  let w = 180, h = 120;
  let art: React.ReactNode;

  if (def.shape === 'circle' || def.shape === 'seal') {
    w = 150; h = 150;
    const edge = def.shape === 'seal'
      ? <polygon points={Array.from({ length: 48 }, (_, i) => {
          const a = (i / 48) * Math.PI * 2, r = i % 2 ? 66 : 72;
          return `${(75 + r * Math.cos(a)).toFixed(1)},${(75 + r * Math.sin(a)).toFixed(1)}`;
        }).join(' ')} />
      : <circle cx="75" cy="75" r="70" />;
    const lines = twoLines(rest, 12);
    art = (
      <>
        <g fill="none" stroke={ink} strokeWidth="3">{edge}<circle cx="75" cy="75" r="47" strokeWidth="1.6" /></g>
        <g fill={ink} textAnchor="middle">
          <text fontSize={fit(name.length, 150, 13).toFixed(1)} fontWeight="800" letterSpacing="2.5">
            <textPath href="#stamp-arc-top" startOffset="50%">{name}</textPath>
          </text>
          <text fontSize="11" letterSpacing="6"><textPath href="#stamp-arc-bottom" startOffset="50%">★ ✈ ★</textPath></text>
          {def.big
            ? <>{t(75, lines.length > 1 ? 73 : 78, fit(def.big.length, 70, 26), def.big)}
                {lines.map((l, i) => t(75, (lines.length > 1 ? 86 : 92) + i * 9, fit(l.length, 84, 8), l))}</>
            : lines.map((l, i) => t(75, 76 + i * 12, fit(l.length, 80, 10), l))}
          {date && t(75, 112, 7.5, date, { letterSpacing: '1.5' })}
        </g>
      </>
    );
  } else if (def.shape === 'oval') {
    w = 190; h = 120;
    const lines = twoLines(text, 18);
    art = (
      <>
        <g fill="none" stroke={ink} strokeWidth="3">
          <ellipse cx="95" cy="60" rx="90" ry="55" />
          <ellipse cx="95" cy="60" rx="80" ry="45" strokeWidth="1.5" strokeDasharray="5 4" />
        </g>
        <g fill={ink} textAnchor="middle">
          {t(95, 38, fit(name.length + 4, 120, 13), `★ ${name} ★`)}
          {lines.map((l, i) => t(95, (lines.length > 1 ? 62 : 68) + i * 13, fit(l.length, 130, 11), l))}
          {date && t(95, 94, 8, date, { letterSpacing: '1.5' })}
        </g>
      </>
    );
  } else if (def.shape === 'octagon') {
    w = 150; h = 150;
    const oct = (o: number) => `${40 + o},${5 + o} ${110 - o},${5 + o} ${145 - o},${40 + o} ${145 - o},${110 - o} ${110 - o},${145 - o} ${40 + o},${145 - o} ${5 + o},${110 - o} ${5 + o},${40 + o}`;
    const lines = twoLines(rest, 12);
    art = (
      <>
        <g fill="none" stroke={ink} strokeWidth="3"><polygon points={oct(0)} /><polygon points={oct(9)} strokeWidth="1.5" /></g>
        <g fill={ink} textAnchor="middle">
          {t(75, 44, fit(name.length, 100, 13), name)}
          {t(75, 80, fit((def.big ?? '').length, 90, 30), def.big ?? '')}
          {lines.map((l, i) => t(75, 97 + i * 11, fit(l.length, 92, 9.5), l))}
          {date && t(75, 126, 7.5, date, { letterSpacing: '1.5' })}
        </g>
      </>
    );
  } else if (def.shape === 'ticket') {
    w = 200; h = 112;
    const lines = twoLines(rest, 16);
    art = (
      <>
        <g fill="none" stroke={ink} strokeWidth="3">
          <path d="M8 4h184a4 4 0 0 1 4 4v36a12 12 0 0 0 0 24v36a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V68a12 12 0 0 0 0-24V8a4 4 0 0 1 4-4z" />
          <path d="M148 10v92" strokeWidth="1.5" strokeDasharray="4 4" />
        </g>
        <g fill={ink} textAnchor="middle">
          {t(76, 28, fit(name.length, 120, 12), name)}
          {t(76, 62, fit((def.big ?? '').length, 90, 30), def.big ?? '')}
          {lines.map((l, i) => t(76, 78 + i * 11, fit(l.length, 120, 9), l))}
          {date && t(76, 102, 7.5, date, { letterSpacing: '1.5' })}
          <g transform="translate(160 40) scale(1.2)"><path d="M21.5 15.5v-2L13.5 9V3.5a1.5 1.5 0 0 0-3 0V9l-8 4.5v2l8-2.5v5.5l-2 1.5V22l3.5-1 3.5 1v-1.5l-2-1.5V13z" /></g>
        </g>
      </>
    );
  } else {
    // Rounded rectangle with a dashed inner border: Takeoff, Wings and the "class" stamps
    const lines = twoLines(rest, def.big ? 22 : 20);
    art = (
      <>
        <g fill="none" stroke={ink} strokeWidth="3">
          <rect x="3" y="3" width="174" height="114" rx="14" />
          <rect x="11" y="11" width="158" height="98" rx="9" strokeWidth="1.5" strokeDasharray="5 4" />
          <path d="M34 42h112" strokeWidth="1.2" />
        </g>
        <g fill={ink} textAnchor="middle">
          {t(90, 34, fit(name.length + 4, 140, 14), `✈ ${name} ✈`)}
          {def.big && t(90, 70, fit(def.big.length, 110, 26), def.big)}
          {lines.map((l, i) => t(90, (def.big ? 85 : lines.length > 1 ? 62 : 70) + i * 12, fit(l.length, 140, def.big ? 9 : 10.5), l))}
          {date && t(90, 103, 7.5, date, { letterSpacing: '1.5' })}
        </g>
      </>
    );
  }

  const deg = plain || !earned ? 0 : tilt(def.key);
  return (
    <span className={`relative ${fluid ? 'block' : 'inline-block'}`} style={{ transform: `rotate(${deg}deg)` }}>
      <svg viewBox={`0 0 ${w} ${h}`} width={fluid ? '100%' : size} height={fluid ? undefined : (size * h) / w} role="img"
        aria-label={`${def.name}: ${def.text}${earned ? `, earned ${date}` : ', not earned yet'}`}
        className={plain || !earned ? '' : 'slam'} style={{ animationDelay: `${delay}ms`, opacity: earned ? 0.88 : 0.5 }}
        fontFamily="var(--font-outfit), sans-serif">
        <g filter={earned ? 'url(#stamp-ink)' : undefined}>{art}</g>
      </svg>
      {!earned && (
        <span className="absolute inset-0 grid place-items-center" aria-hidden>
          <span className="grid place-items-center size-9 rounded-full bg-surface/90 border-2 border-gold text-base shadow">🔒</span>
        </span>
      )}
    </span>
  );
}

export function stampDef(key: string) {
  return STAMP.get(key);
}

/* ───────────── 100 Post Challenge ───────────── */

/**
 * The 10×10 board, played like a 2000s platformer level: collected posts are green coins (+1 on
 * hover), the next post is a hopping "?" block, gifts wait at the reward steps and a glowing trophy
 * at 100.
 */
export function PostGrid({ total, reached }: { total: number; reached: Set<number> }) {
  const steps = new Set(REWARD_STEPS);
  return (
    <ol className="grid grid-cols-10 gap-1.5 sm:gap-2.5" aria-label={`${total} of 100 posts done`}>
      {Array.from({ length: 100 }, (_, i) => {
        const n = i + 1, done = n <= total, next = n === total + 1, reward = steps.has(n), finish = n === 100;
        const got = reward && (done || reached.has(n));
        let look: string, body: React.ReactNode = n, extra = '';
        if (finish) {
          look = got ? 'coin-1 text-white glow' : 'bg-[var(--hub-navy)] text-white glow';
          body = <span className="text-base sm:text-2xl bob inline-block">🏆</span>;
          extra = 'scale-110 z-10';
        } else if (reward) {
          look = got ? 'coin-1 text-white ring-2 ring-[#f6cf62]' : 'bg-[var(--hub-navy)] ring-2 sm:ring-[3px] ring-gold';
          body = <span className="wiggle inline-block text-sm sm:text-lg">{got ? '🎉' : '🎁'}</span>;
        } else if (done) {
          look = 'bg-good text-white plus1 spin-in shadow-[inset_0_-3px_0_rgba(0,0,0,0.18)]';
          body = '✓';
        } else if (next) {
          // Mystery block: your next post
          look = 'rounded-md! coin-1 text-[#7a4a06] hop border-2 border-[#9a6410] shadow-[inset_0_-4px_0_rgba(0,0,0,0.2),0_0_0_3px_rgba(239,124,34,0.35)]';
          body = (
            <>
              {[['left-1 top-1'], ['right-1 top-1'], ['left-1 bottom-1'], ['right-1 bottom-1']].map(([at]) => (
                <span key={at} aria-hidden className={`absolute ${at} size-[3px] sm:size-1 rounded-full bg-[#9a6410]`} />
              ))}
              <span className="pixel text-xs sm:text-lg leading-none">?</span>
            </>
          );
        } else {
          look = 'bg-brand text-white/95 shadow-[inset_0_-3px_0_rgba(0,0,0,0.14)]';
        }
        return (
          <li key={n} title={finish ? '100: the finish line' : reward ? `Reward at ${n} posts` : next ? `Your next post: #${n}` : `Post ${n}`}
            className={`relative aspect-square rounded-full grid place-items-center text-[10px] sm:text-sm font-bold tnum select-none ${look} ${extra}`}
            style={done && !reward ? { animationDelay: `${Math.min(i, 60) * 18}ms` } : undefined}>
            {body}
          </li>
        );
      })}
    </ol>
  );
}

/** A big arcade score readout: label in pixel letters, value underneath. */
export function HudStat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="text-center">
      <p className="pixel text-[8px] sm:text-[10px] text-[#f6cf62]">{label}</p>
      <p className="mt-1 text-lg sm:text-2xl font-extrabold text-white tnum leading-none">{children}</p>
    </div>
  );
}
