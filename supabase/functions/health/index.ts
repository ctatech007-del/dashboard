// Health facts only the functions can see: which secrets are set and how much Apify credit is left.
// Values are never returned, only whether they exist.
import { APIFY_TOKEN, authorized, json } from '../_shared/env.ts';

Deno.serve(async (req) => {
  if (!authorized(req)) return json({ error: 'unauthorized' }, 401);

  const secrets = {
    apify: !!APIFY_TOKEN,
    google: !!Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON'),
    alerts: !!Deno.env.get('RESEND_API_KEY'),
  };

  let apify: { usedUsd: number; limitUsd: number | null } | { error: string };
  try {
    const res = await fetch('https://api.apify.com/v2/users/me/limits', {
      headers: { Authorization: `Bearer ${APIFY_TOKEN}` },
    });
    if (!res.ok) throw new Error(`Apify ${res.status}`);
    const { data } = await res.json();
    apify = {
      usedUsd: Number(data?.current?.monthlyUsageUsd ?? 0),
      limitUsd: data?.limits?.maxMonthlyUsageUsd ?? null,
    };
  } catch (e) {
    apify = { error: String(e instanceof Error ? e.message : e) };
  }
  return json({ secrets, apify });
});
