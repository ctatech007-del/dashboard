import { createClient } from 'npm:@supabase/supabase-js@2';

export const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
export const APIFY_TOKEN = Deno.env.get('APIFY_TOKEN')!;
// Shared secret for cron, the web app's re-run button and Apify webhooks.
export const FUNCTION_SECRET = Deno.env.get('FUNCTION_SECRET')!;

export const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

export function authorized(req: Request): boolean {
  const url = new URL(req.url);
  const key = req.headers.get('x-function-secret') ?? url.searchParams.get('key');
  return !!FUNCTION_SECRET && key === FUNCTION_SECRET;
}

/** Readable text for anything thrown, including Supabase errors (plain objects, not Errors). */
export function errorText(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object') {
    const { message, details, hint, code } = e as Record<string, unknown>;
    if (message) return [message, details, hint, code && `(${code})`].filter(Boolean).join(' · ');
    return JSON.stringify(e);
  }
  return String(e);
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}

export function fnUrl(name: string, params: Record<string, string> = {}): string {
  const q = new URLSearchParams({ ...params, key: FUNCTION_SECRET });
  return `${SUPABASE_URL}/functions/v1/${name}?${q}`;
}

/** Start an Apify actor run with a webhook that fires when it finishes (any terminal state). */
export async function startActor(actor: string, input: unknown, webhookUrl: string) {
  const webhooks = btoa(JSON.stringify([{
    eventTypes: ['ACTOR.RUN.SUCCEEDED', 'ACTOR.RUN.FAILED', 'ACTOR.RUN.TIMED_OUT', 'ACTOR.RUN.ABORTED'],
    requestUrl: webhookUrl,
  }]));
  const res = await fetch(
    `https://api.apify.com/v2/acts/${actor}/runs?webhooks=${encodeURIComponent(webhooks)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${APIFY_TOKEN}` },
      body: JSON.stringify(input),
    },
  );
  if (!res.ok) throw new Error(`Apify start failed: ${res.status} ${await res.text()}`);
  return (await res.json()).data as { id: string; defaultDatasetId: string };
}

export async function datasetItems<T>(datasetId: string): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?clean=true&offset=${offset}&limit=1000`,
      { headers: { Authorization: `Bearer ${APIFY_TOKEN}` } },
    );
    if (!res.ok) throw new Error(`Apify dataset read failed: ${res.status}`);
    const page = (await res.json()) as T[];
    out.push(...page);
    if (page.length < 1000) return out;
  }
}
