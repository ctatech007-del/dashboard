const TZ = 'Asia/Kolkata';

export function relative(ts: string | null | undefined): string {
  if (!ts) return 'never';
  const mins = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function day(ts: string | null | undefined): string {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('en-GB', { timeZone: TZ, day: 'numeric', month: 'short' });
}

export function weekLabel(weekStart: string): string {
  const d = new Date(`${weekStart}T00:00:00+05:30`);
  return d.toLocaleDateString('en-GB', { timeZone: TZ, day: 'numeric', month: 'short' });
}

// ───────────── daily scrape schedule ─────────────
// pg_cron runs in UTC; the team thinks in IST (UTC+5:30). Only daily schedules are allowed
// ("m h * * *"), matching the settings.scrape_cron check constraint.
const IST_OFFSET = 330;
const DAY = 1440;

/** "HH:MM" IST → daily cron in UTC. */
export function istToCron(time: string): string | null {
  const m = time.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!m) return null;
  const utc = (Number(m[1]) * 60 + Number(m[2]) - IST_OFFSET + DAY) % DAY;
  return `${utc % 60} ${Math.floor(utc / 60)} * * *`;
}

/** Daily cron in UTC → "HH:MM" IST. */
export function cronToIst(cron: string): string | null {
  const m = cron.trim().match(/^(\d{1,2}) (\d{1,2}) \* \* \*$/);
  if (!m) return null;
  const ist = (Number(m[2]) * 60 + Number(m[1]) + IST_OFFSET) % DAY;
  return `${String(Math.floor(ist / 60)).padStart(2, '0')}:${String(ist % 60).padStart(2, '0')}`;
}

export const OUTCOME_LABEL: Record<string, string> = {
  ok: 'OK',
  private: 'Private account',
  not_found: 'Not found',
  error: 'Scrape error',
  never_scraped: 'Not scraped yet',
};

export function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Minimal CSV parser: quoted fields, commas, CRLF. Returns rows of trimmed cells. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell.trim()); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell.trim()); cell = '';
      if (row.some((x) => x)) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell.trim());
  if (row.some((x) => x)) rows.push(row);
  return rows;
}
