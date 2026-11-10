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

/** Confetti once when the page opens (`fire`), and again whenever the child is clicked. */
export function Confetti({ fire, children, className }: { fire?: boolean; children?: React.ReactNode; className?: string }) {
  const done = useRef(false);
  useEffect(() => {
    if (fire && !done.current) { done.current = true; setTimeout(burst, 500); }
  }, [fire]);
  if (!children) return null;
  return <button type="button" onClick={burst} className={className}>{children}</button>;
}
