'use client';
// The Passport booklet: two-page spreads on desktop, one page on phones. Pages turn like a real
// book: drag or swipe the page around the spine (past a third it completes, otherwise it falls
// back), or use the arrows / arrow keys. The pages themselves are rendered on the server.
import { useCallback, useEffect, useRef, useState } from 'react';

type Turn = { dir: 1 | -1; angle: number } | null;

const ease = (t: number) => 1 - Math.pow(1 - t, 3);

export function Booklet({ pages }: { pages: React.ReactNode[] }) {
  const [mobile, setMobile] = useState(false);
  const [at, setAt] = useState(0);                 // desktop: spread index; mobile: page index
  const [turn, setTurn] = useState<Turn>(null);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; dir: 1 | -1 | 0; width: number } | null>(null);
  const anim = useRef(0);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const set = () => { setMobile(mq.matches); setAt(0); };
    set();
    mq.addEventListener('change', set);
    return () => mq.removeEventListener('change', set);
  }, []);

  const count = mobile ? pages.length : pages.length / 2;
  const can = (dir: 1 | -1) => (dir === 1 ? at < count - 1 : at > 0);

  /** Animate the turning page to 180° (done) or back to 0°. */
  const settle = useCallback((dir: 1 | -1, from: number, done: boolean) => {
    cancelAnimationFrame(anim.current);
    const to = done ? 180 : 0, t0 = performance.now(), ms = 260 + Math.abs(to - from) * 2;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const step = (t: number) => {
      const p = still ? 1 : Math.min(1, (t - t0) / ms);
      const angle = from + (to - from) * ease(p);
      if (p < 1) { setTurn({ dir, angle }); anim.current = requestAnimationFrame(step); return; }
      setTurn(null);
      if (done) setAt((a) => a + dir);
    };
    anim.current = requestAnimationFrame(step);
  }, []);

  const go = useCallback((dir: 1 | -1) => { if (!turn && can(dir)) settle(dir, 0, true); }, [turn, at, count]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mobile) return;
    const key = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest('input, textarea')) return;
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [go, mobile]);

  // Dragging: only horizontal moves turn pages, so vertical scrolling on phones keeps working.
  const down = (e: React.PointerEvent) => {
    if (turn) return;
    const r = box.current!.getBoundingClientRect();
    drag.current = { x: e.clientX, y: e.clientY, dir: 0, width: mobile ? r.width : r.width / 2 };
    if (!mobile) drag.current.dir = e.clientX > r.left + r.width / 2 ? 1 : -1;
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!turn) {
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) { if (Math.abs(dy) > 12) drag.current = null; return; }
      if (mobile) d.dir = dx < 0 ? 1 : -1;
      if (!d.dir || !can(d.dir as 1 | -1)) { drag.current = null; return; }
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    const dir = d.dir as 1 | -1;
    setTurn({ dir, angle: Math.max(0, Math.min(180, (-dir * dx / d.width) * 180)) });
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    if (d && turn) settle(turn.dir, turn.angle, turn.angle > 60);
  };

  const blank = <div className="guilloche h-full" />;
  const page = (i: number) => pages[i] ?? blank;
  const shade = turn ? Math.sin((turn.angle * Math.PI) / 180) : 0;

  // What lies underneath, and which leaf is turning
  let left: React.ReactNode = null, right: React.ReactNode, leaf: React.ReactNode = null;
  if (mobile) {
    right = turn ? page(turn.dir === 1 ? at + 1 : at) : page(at);
    if (turn) {
      const front = page(turn.dir === 1 ? at : at - 1);
      const deg = turn.dir === 1 ? -turn.angle : -180 + turn.angle;
      leaf = <Leaf origin="left" deg={deg} front={front} back={blank} shade={shade} />;
    }
  } else {
    const l = at * 2, r = l + 1;
    left = page(turn?.dir === -1 ? l - 2 : l);
    right = page(turn?.dir === 1 ? r + 2 : r);
    if (turn?.dir === 1) leaf = <Leaf origin="left" deg={-turn.angle} front={page(r)} back={page(r + 1)} shade={shade} />;
    if (turn?.dir === -1) leaf = <Leaf origin="right" deg={turn.angle} front={page(l)} back={page(l - 1)} shade={shade} />;
  }

  const label = mobile ? `Page ${at + 1} of ${pages.length}` : `Pages ${at * 2 + 1}–${at * 2 + 2} of ${pages.length}`;
  const arrow = (dir: 1 | -1) => (
    <button type="button" onClick={() => go(dir)} disabled={!can(dir)} aria-label={dir === 1 ? 'Next pages' : 'Previous pages'}
      className="grid place-items-center size-10 rounded-full bg-surface text-lg font-bold text-ink shadow disabled:opacity-40">
      {dir === 1 ? '›' : '‹'}
    </button>
  );

  return (
    <div>
      <div className="leather rounded-2xl p-2.5 sm:p-3">
        <div ref={box} className="book relative grid md:grid-cols-2 cursor-grab active:cursor-grabbing"
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          {!mobile && <div className="relative edges-l rounded-l-lg overflow-hidden">{left}</div>}
          <div className={`relative overflow-hidden ${mobile ? 'edges-r rounded-lg' : 'edges-r rounded-r-lg'}`}>
            {right}
            {turn && <div className="pointer-events-none absolute inset-0 bg-black" style={{ opacity: shade * 0.18 }} />}
          </div>
          {!mobile && (
            <>
              {/* Spine: fold shadow and stitching */}
              <span aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 w-12 -translate-x-1/2 bg-[linear-gradient(90deg,transparent,rgba(0,0,0,0.16)_45%,rgba(0,0,0,0.22)_50%,rgba(0,0,0,0.16)_55%,transparent)]" />
              <span aria-hidden className="pointer-events-none absolute inset-y-3 left-1/2 border-l-2 border-dashed border-[#b9a98c]/70" />
            </>
          )}
          {leaf && (
            <div className={`pointer-events-none absolute inset-y-0 ${mobile ? 'inset-x-0' : turn?.dir === 1 ? 'left-1/2 right-0' : 'left-0 right-1/2'}`}>{leaf}</div>
          )}
        </div>
      </div>
      <nav aria-label="Passport pages" className="flex items-center justify-center gap-4 mt-5">
        {arrow(-1)}
        <span className="on-sky tnum text-sm font-semibold">{label}</span>
        {arrow(1)}
      </nav>
    </div>
  );
}

/** The turning page: front and back faces rotating around the spine, curving and catching light. */
function Leaf({ origin, deg, front, back, shade }: {
  origin: 'left' | 'right'; deg: number; front: React.ReactNode; back: React.ReactNode; shade: number;
}) {
  const curve = origin === 'left' ? 'to right' : 'to left';
  return (
    <div className="leaf" style={{ transformOrigin: `${origin} center`, transform: `rotateY(${deg}deg) skewY(${(origin === 'left' ? -1 : 1) * shade * 1.5}deg)` }}>
      <div className="face overflow-hidden">
        {front}
        <div className="absolute inset-0" style={{ background: `linear-gradient(${curve}, rgba(0,0,0,${shade * 0.25}), transparent 60%)` }} />
      </div>
      <div className="face back overflow-hidden">
        {back}
        <div className="absolute inset-0" style={{ background: `linear-gradient(${curve === 'to right' ? 'to left' : 'to right'}, rgba(0,0,0,${shade * 0.25}), transparent 60%)` }} />
      </div>
    </div>
  );
}
