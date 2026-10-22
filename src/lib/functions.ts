import 'server-only';

/** Calls an Edge Function with the shared secret. Lives outside actions.ts on purpose: in a
 *  'use server' file every export becomes a callable endpoint, and this one carries the secret. */
export async function callFunction(name: string, body: unknown = {}) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-function-secret': process.env.FUNCTION_SECRET! },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  return { res, body: await res.json().catch(() => ({})) };
}
