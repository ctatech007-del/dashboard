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

// ───────────── weekly scrape schedule ─────────────
// pg_cron runs in UTC; the team thinks in IST (UTC+5:30). Only weekly schedules are allowed
// ("m h * * dow", dow 0 = Sunday), matching the settings.scrape_cron check constraint.
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const IST_OFFSET = 330;
const WEEK = 7 * 1440;

/** IST weekday (0 = Sunday) and "HH:MM" → weekly cron in UTC. */
export function istToCron(dow: number, time: string): string | null {
  const m = time.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!m || !Number.isInteger(dow) || dow < 0 || dow > 6) return null;
  const utc = (dow * 1440 + Number(m[1]) * 60 + Number(m[2]) - IST_OFFSET + WEEK) % WEEK;
  return `${utc % 60} ${Math.floor(utc / 60) % 24} * * ${Math.floor(utc / 1440)}`;
}

/** Weekly cron in UTC → IST weekday (0 = Sunday) and "HH:MM". */
export function cronToIst(cron: string): { dow: number; time: string } | null {
  const m = cron.trim().match(/^(\d{1,2}) (\d{1,2}) \* \* ([0-6])$/);
  if (!m) return null;
  const ist = (Number(m[3]) * 1440 + Number(m[2]) * 60 + Number(m[1]) + IST_OFFSET) % WEEK;
  const hh = String(Math.floor(ist / 60) % 24).padStart(2, '0');
  const mm = String(ist % 60).padStart(2, '0');
  return { dow: Math.floor(ist / 1440), time: `${hh}:${mm}` };
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
