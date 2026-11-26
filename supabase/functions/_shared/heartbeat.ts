// Pure helpers for the Heartbeat sync. No Deno-only imports, so `npm test` covers them.
import { cleanHandle } from './apify.ts';

export interface HbMember {
  id: string;
  email?: string;
  name?: string;
  lastLogin?: string | null;
  isAdmin?: boolean;
  socialLinks?: { instagram?: string };
}
export interface HbStudent {
  id: string; ig_handle: string; email: string | null; heartbeat_user_id: string | null; name: string;
}

/** Instagram handle from whatever members type into their profile ("@x", "instagram.com/x/", "x"). */
export function instagramHandle(link: string | undefined): string | null {
  if (!link) return null;
  const h = cleanHandle(link);
  return /^[a-z0-9._]{1,30}$/.test(h) ? h : null;
}

/**
 * Match students to Heartbeat members: the saved member id first, then email, then the Instagram
 * link on the member's profile. A member is never matched to two students. Admin (team) accounts
 * can be linked by id or email (e.g. the client's own test students), never by an Instagram guess.
 */
export function matchMembers(students: HbStudent[], members: HbMember[]) {
  const byId = new Map(members.map((m) => [m.id, m]));
  const byEmail = new Map(members.filter((m) => m.email).map((m) => [m.email!.toLowerCase(), m]));
  const byInsta = new Map<string, HbMember>();
  for (const m of members) {
    if (m.isAdmin) continue;   // team accounts are only ever linked by id or an email the team entered
    const h = instagramHandle(m.socialLinks?.instagram);
    if (h && !byInsta.has(h)) byInsta.set(h, m);
  }
  const taken = new Set<string>();
  const out = new Map<string, { member: HbMember; via: 'id' | 'email' | 'instagram' }>();
  // Saved ids win, so they claim their members before email/Instagram guesses do.
  for (const s of students) {
    const m = s.heartbeat_user_id ? byId.get(s.heartbeat_user_id) : undefined;
    if (m) { out.set(s.id, { member: m, via: 'id' }); taken.add(m.id); }
  }
  for (const s of students) {
    if (out.has(s.id)) continue;
    const viaEmail = s.email ? byEmail.get(s.email.toLowerCase()) : undefined;
    const viaInsta = byInsta.get(s.ig_handle.toLowerCase());
    const pick = viaEmail && !taken.has(viaEmail.id) ? { member: viaEmail, via: 'email' as const }
      : viaInsta && !taken.has(viaInsta.id) ? { member: viaInsta, via: 'instagram' as const } : null;
    if (pick) { out.set(s.id, pick); taken.add(pick.member.id); }
  }
  return out;
}

/** IST calendar day of a timestamp, e.g. a login at 23:30 UTC is the next day in India. */
export const istDay = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

/** Reward message: {name} → first name, {step} → posts; plain text becomes Heartbeat rich text. */
/**
 * The reward message for one student and milestone, as Heartbeat HTML. In the text: {first_name} (or
 * {name}, {{first_name}}) is their first name, {step} the number of posts, and {claim} becomes a
 * "Click here to claim it" link to that milestone's prize. A blank line starts a new paragraph.
 */
export function rewardMessage(template: string, name: string, step: number, link?: string) {
  const first = name.trim().split(/\s+/)[0] || name;
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const text = esc(template.replaceAll('{{first_name}}', first).replaceAll('{first_name}', first)
    .replaceAll('{name}', first).replaceAll('{step}', String(step)));
  const claim = link ? `<a href="${esc(link)}">Click here to claim it</a>` : 'Click here to claim it';
  return text.split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, '<br>').replaceAll('{claim}', claim)}</p>`).join('');
}

/** A reward can go out once its text needs no link, or its milestone has one. */
export function rewardReady(template: string, links: Record<string, string>, step: number) {
  return !template.includes('{claim}') || Boolean(links[String(step)]?.trim());
}
