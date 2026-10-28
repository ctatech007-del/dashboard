'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/** Month select that keeps the rest of the query string. */
export function MonthPicker({ options, value }: { options: { value: string; label: string }[]; value: string }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-ink-soft font-bold">Month</span>
      <select
        className="field !w-auto !py-1.5 font-bold"
        value={value}
        onChange={(e) => {
          const q = new URLSearchParams(params);
          q.set('month', e.target.value);
          router.push(`${path}?${q}`);
        }}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
