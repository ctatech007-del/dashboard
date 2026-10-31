// Click-to-sort for the Student Stats tables (?sort=key&dir=asc|desc). Pure, so it's unit tested.

export type Dir = 'asc' | 'desc';
export interface Sort { key: string; dir: Dir }

export function parseSort(sp: { sort?: string; dir?: string }, keys: string[], fallback: Sort): Sort {
  const key = sp.sort && keys.includes(sp.sort) ? sp.sort : fallback.key;
  const dir: Dir = sp.dir === 'asc' || sp.dir === 'desc' ? sp.dir : key === fallback.key ? fallback.dir : 'desc';
  return { key, dir };
}

/** Sorts by the chosen column; empty values always go last, whichever way you sort. */
export function sortBy<T>(rows: T[], s: Sort, value: (row: T, key: string) => number | string | null | undefined): T[] {
  return [...rows].sort((a, b) => {
    const va = value(a, s.key), vb = value(b, s.key);
    const ea = va === null || va === undefined, eb = vb === null || vb === undefined;
    if (ea || eb) return ea === eb ? 0 : ea ? 1 : -1;
    const c = typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number);
    return s.dir === 'asc' ? c : -c;
  });
}

/** Where clicking a header goes: same column flips direction; a new column starts at its default. */
export function nextSort(current: Sort, key: string, firstDir: Dir = 'desc'): Sort {
  return current.key === key ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: firstDir };
}
