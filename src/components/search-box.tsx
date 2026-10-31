'use client';

import { useEffect, useRef } from 'react';

/** Top-bar student search; ⌘K (Ctrl+K) jumps to it, as in the prototype. */
export function SearchBox() {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); ref.current?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <form action="/students" className="relative flex-1 max-w-md">
      <input ref={ref} name="q" type="search" placeholder="Search students" aria-label="Search students"
        className="field !rounded-full !py-1.5 pr-12" />
      <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-rule px-1.5 text-[10px] font-bold text-ink-soft">⌘K</kbd>
    </form>
  );
}
