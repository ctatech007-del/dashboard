'use client';
// Small game effects for the Hub: scores that count up, and confetti for a fresh reward.
import { useEffect, useRef, useState } from 'react';

const still = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Counts from 0 to `to` like an arcade score, then shows the exact number. */
export function CountUp({ to, ms = 900 }: { to: number; ms?: number }) {
  const [n, setN] = useState(to);
  useEffect(() => {
    if (still() || to <= 0) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    setN(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return <>{n.toLocaleString('en-US')}</>;
}

const COLORS = ['#ef7c22', '#e3a92b', '#2f8f52', '#4a6fb5', '#c2524a', '#8466b8'];

export function burst() {
  if (still()) return;
  for (let i = 0; i < 90; i++) {
    const el = document.createElement('span');
    el.className = 'confetti';
    el.style.left = `${Math.random() * 100}vw`;
    el.style.background = COLORS[i % COLORS.length];
    el.style.setProperty('--dx', `${(Math.random() - 0.5) * 240}px`);
    el.style.setProperty('--r', `${Math.round(Math.random() * 720)}deg`);
    el.style.animationDuration = `${1.8 + Math.random() * 1.6}s`;
    el.style.animationDelay = `${Math.random() * 0.4}s`;
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }
}

const TRAVEL = ['🚀', '✈️', '🧭', '📷', '🏝️', '🖼️', '🗺️', '🌍', '🍹', '⛱️', '🧳', '🎒', '🌴', '🛫'];

/** The reward celebration (see .gift-overlay): blur, gift box, lid off, travel emojis everywhere. */
export function giftCelebration(done: () => void) {
  if (still()) { done(); return; }
  const o = document.createElement('div');
  o.className = 'gift-overlay';
  o.setAttribute('aria-hidden', 'true');
  o.innerHTML = '<div class="gift-box"><div class="body"></div><div class="lid"></div></div>';
  for (let i = 0; i < 90; i++) {
    const e = document.createElement('span');
    e.className = 'gift-fly';
    e.textContent = TRAVEL[i % TRAVEL.length];
    const a = Math.random() * Math.PI * 2, d = 12 + Math.random() * 42;   // distance in vmax
    e.style.setProperty('--dx', `${Math.cos(a) * d}vmax`);
    e.style.setProperty('--dy', `${Math.sin(a) * d}vmax`);
    e.style.setProperty('--r', `${Math.round((Math.random() - 0.5) * 540)}deg`);
    e.style.fontSize = `${28 + Math.random() * 22}px`;
    e.style.animationDelay = `${1.5 + Math.random() * 0.4}s`;
    o.appendChild(e);
  }
  document.body.appendChild(o);
  setTimeout(() => { o.remove(); done(); }, 4600);
}

/** Confetti once when the page opens (`fire`), and again whenever the child is clicked. */
export function Confetti({ fire, children, className }: { fire?: boolean; children?: React.ReactNode; className?: string }) {
  const done = useRef(false);
  useEffect(() => {
    if (fire && !done.current) { done.current = true; setTimeout(burst, 500); }
  }, [fire]);
  if (!children) return null;
  return <button type="button" onClick={burst} className={className}>{children}</button>;
}
