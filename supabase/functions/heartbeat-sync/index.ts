// Every 3 hours: match students to Heartbeat members, record "last seen" and active days, and (when
// switched on in Settings) send reward messages. POST {"dry": true} only reads and reports.
import { authorized, db, errorText, json } from '../_shared/env.ts';
import { type HbMember, istDay, matchMembers, rewardMessage } from '../_shared/heartbeat.ts';

const API = 'https://api.heartbeat.chat/v0';
const KEY = Deno.env.get('HEARTBEAT_API_KEY');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function hb(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init, headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`Heartbeat ${path}: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

Deno.serve(async (req) => {
  if (!authorized(req)) return json({ error: 'unauthorized' }, 401);
  if (!KEY) return json({ error: 'HEARTBEAT_API_KEY is not set' }, 500);
  const { dry = false } = await req.json().catch(() => ({}));

  try {
    const members = (await hb('/users')) as HbMember[];
    const { data: students, error } = await db.from('students')
      .select('id, name, ig_handle, email, heartbeat_user_id, heartbeat_last_login')
      .in('status', ['active', 'paused']);
    if (error) throw error;
    const matches = matchMembers(students, members.filter((m) => !m.isAdmin));
    const unmatched = students.filter((s) => !matches.has(s.id)).map((s) => s.ig_handle);
    const report = {
      members: members.length, students: students.length, matched: matches.size,
      by: Object.fromEntries(['id', 'email', 'instagram'].map((v) => [v, [...matches.values()].filter((m) => m.via === v).length])),
      unmatched, logins: 0, messages: 0,
    };
    if (dry) return json({ dry: true, ...report });

    // Save matches, last seen and the day of each latest login
    const logins: { student_id: string; day: string }[] = [];
    for (const s of students) {
      const m = matches.get(s.id)?.member;
      if (!m) continue;
      const last = m.lastLogin ?? null;
      if (m.id !== s.heartbeat_user_id || last !== s.heartbeat_last_login) {
        const { error: e } = await db.from('students')
          .update({ heartbeat_user_id: m.id, heartbeat_last_login: last }).eq('id', s.id);
        if (e) throw e;
      }
      if (last) logins.push({ student_id: s.id, day: istDay(last) });
    }
    if (logins.length) {
      const { error: e } = await db.from('heartbeat_logins').upsert(logins, { onConflict: 'student_id,day', ignoreDuplicates: true });
      if (e) throw e;
      report.logins = logins.length;
    }

    // Reward messages: only when switched on, only for fresh rewards (no backlog), never twice.
    const { data: cfg } = await db.from('settings').select('reward_messages, reward_message').single();
    if (cfg?.reward_messages) {
      const { data: due } = await db.from('rewards')
        .select('student_id, step, students!inner(name, heartbeat_user_id)')
        .is('sent_at', null).not('students.heartbeat_user_id', 'is', null)
        .gte('reached_at', new Date(Date.now() - 3 * 864e5).toISOString());
      for (const r of due ?? []) {
        const st = r.students as unknown as { name: string; heartbeat_user_id: string };
        await hb('/directMessages', {
          method: 'PUT', body: JSON.stringify({ to: st.heartbeat_user_id, text: rewardMessage(cfg.reward_message, st.name, r.step) }),
        });
        await db.from('rewards').update({ sent_at: new Date().toISOString(), sent_by: 'Heartbeat (automatic)' })
          .eq('student_id', r.student_id).eq('step', r.step).is('sent_at', null);
        report.messages++;
        await sleep(150);   // Heartbeat allows 10 requests a second
      }
    }
    return json(report);
  } catch (e) {
    return json({ error: errorText(e) }, 500);
  }
});
