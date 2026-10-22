// Writes the latest numbers into the team's Google Sheet. Read-only output: every tab is cleared
// and rewritten on each run. Share the Sheet with the service account's email as Editor.
import { authorized, db, json } from '../_shared/env.ts';

const SA = JSON.parse(Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON') ?? '{}');
const API = 'https://sheets.googleapis.com/v4/spreadsheets';

Deno.serve(async (req) => {
  if (!authorized(req)) return json({ error: 'unauthorized' }, 401);
  const { data: cfg } = await db.from('settings').select('sheet_id').single();
  if (!cfg?.sheet_id) return json({ skipped: 'No sheet_id in settings' });
  if (!SA.client_email) return json({ skipped: 'GOOGLE_SERVICE_ACCOUNT_JSON not set' });

  const token = await accessToken();
  const tabs = await buildTabs();
  await ensureTabs(cfg.sheet_id, token, Object.keys(tabs));

  const ranges = Object.keys(tabs).map((t) => `'${t}'`);
  await gapi(`${API}/${cfg.sheet_id}/values:batchClear`, token, { ranges });
  await gapi(`${API}/${cfg.sheet_id}/values:batchUpdate`, token, {
    valueInputOption: 'USER_ENTERED',
    data: Object.entries(tabs).map(([t, values]) => ({ range: `'${t}'!A1`, values })),
  });
  return json({ ok: true, tabs: Object.keys(tabs) });
});

type Row = (string | number | null)[];

async function buildTabs(): Promise<Record<string, Row[]>> {
  const ist = (ts: string | null) =>
    ts ? new Date(ts).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' }) : '';
  const tabs: Record<string, Row[]> = {};

  const { data: lb } = await db.from('leaderboard').select('*').eq('status', 'active')
    .order('batch_name').order('batch_rank');
  for (const r of lb ?? []) {
    const tab = `Leaderboard - ${r.batch_name}`.slice(0, 99);
    tabs[tab] ??= [['Rank', 'Name', 'Handle', 'Total posts', 'This week', 'Streak (weeks)',
      'Best streak', 'Last milestone', 'Last post', 'Status']];
    tabs[tab].push([r.batch_rank, r.name, `@${r.ig_handle}`, r.total_posts ?? 0,
      r.posts_this_week ?? 0, r.current_streak ?? 0, r.longest_streak ?? 0,
      r.last_milestone ?? '', ist(r.last_post_at), r.last_outcome ?? 'never scraped']);
  }

  const { data: weekly } = await db.from('weekly_stats')
    .select('week_start, posts, students!inner(name, ig_handle, status, batches(name))')
    .neq('students.status', 'removed')
    .order('week_start', { ascending: false });
  tabs['Weekly'] = [['Week starting', 'Name', 'Handle', 'Batch', 'Posts']];
  for (const w of weekly ?? []) {
    const s = w.students as unknown as { name: string; ig_handle: string; batches: { name: string } };
    tabs['Weekly'].push([w.week_start, s.name, `@${s.ig_handle}`, s.batches?.name ?? '', w.posts]);
  }

  const { data: ms } = await db.from('milestones_hit')
    .select('milestone, reached_at, students!inner(name, ig_handle, batches(name))')
    .order('reached_at', { ascending: false });
  tabs['Milestones'] = [['Reached on', 'Name', 'Handle', 'Batch', 'Milestone']];
  for (const m of ms ?? []) {
    const s = m.students as unknown as { name: string; ig_handle: string; batches: { name: string } };
    tabs['Milestones'].push([ist(m.reached_at), s.name, `@${s.ig_handle}`, s.batches?.name ?? '',
      m.milestone]);
  }

  const { data: flags } = await db.from('open_flags').select('*').order('batch_name');
  tabs['Flags'] = [['Name', 'Handle', 'Batch', 'Reason', 'Detail', 'Days without data']];
  for (const f of flags ?? []) {
    tabs['Flags'].push([f.name, `@${f.ig_handle}`, f.batch_name, f.reason, f.detail ?? '',
      f.days_without_data ?? 'never']);
  }
  return tabs;
}

async function ensureTabs(sheetId: string, token: string, names: string[]) {
  const meta = await gapi(`${API}/${sheetId}?fields=sheets.properties.title`, token);
  const have = new Set(meta.sheets.map((s: { properties: { title: string } }) => s.properties.title));
  const add = names.filter((n) => !have.has(n));
  if (add.length) {
    await gapi(`${API}/${sheetId}:batchUpdate`, token, {
      requests: add.map((title) => ({ addSheet: { properties: { title } } })),
    });
  }
}

async function gapi(url: string, token: string, body?: unknown) {
  const res = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Sheets API ${res.status}: ${await res.text()}`);
  return res.json();
}

// Service-account OAuth: sign a JWT with the account's private key, swap it for a token.
async function accessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, '')
    .replace(/\+/g, '-').replace(/\//g, '_');
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: SA.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  })}`;
  const pem = SA.private_key.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
  const key = await crypto.subtle.importKey('pkcs8',
    Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key,
    new TextEncoder().encode(unsigned)));
  const jwt = `${unsigned}.${btoa(String.fromCharCode(...sig)).replace(/=+$/, '')
    .replace(/\+/g, '-').replace(/\//g, '_')}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  });
  if (!res.ok) throw new Error(`Google token ${res.status}: ${await res.text()}`);
  return (await res.json()).access_token;
}
