// Failure alerts by email (Resend). Off until RESEND_API_KEY is set and Settings has an address.
import { db } from './env.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
// Needs a domain verified in Resend; onboarding@resend.dev only reaches the Resend account owner.
const ALERT_FROM = Deno.env.get('ALERT_FROM') ?? 'CTA Post Tracker <onboarding@resend.dev>';

/** Best-effort: an alert that can't be sent must never fail the scrape itself. */
export async function alert(subject: string, text: string): Promise<void> {
  try {
    if (!RESEND_API_KEY) return;
    const { data } = await db.from('settings').select('alert_emails').single();
    const to = (data?.alert_emails ?? []) as string[];
    if (!to.length) return;
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: ALERT_FROM, to, subject: `[CTA Tracker] ${subject}`, text }),
    });
    if (!res.ok) console.error('alert not sent', res.status, await res.text());
  } catch (e) {
    console.error('alert not sent', e);
  }
}
