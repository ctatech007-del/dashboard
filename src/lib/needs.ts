// Who needs attention, as in the prototype: no recent post, contract ending, not seen on
// Heartbeat, or a profile we couldn't read. Pure, so it's unit tested.

export type Need = 'no_post' | 'contract' | 'last_seen' | 'data';

export interface NeedInput {
  status: string;
  noPostDays: number | null;
  contractDays: number | null;
  lastOutcome: string | null;
  lastSeenDays?: number | null;    // days since the latest Heartbeat login
}

/** Defaults the Overview summary uses: 14+ days without a post, contract ending within 30 days. */
export const NEED_DAYS = { no_post: 14, contract: 30, last_seen: 14 } as const;

export function needs(s: NeedInput, days: Partial<Record<Exclude<Need, 'data'>, number>> = {}): Need[] {
  if (s.status !== 'active') return [];
  const d = { ...NEED_DAYS, ...days };
  const out: Need[] = [];
  if (s.noPostDays !== null && s.noPostDays >= d.no_post) out.push('no_post');
  if (s.contractDays !== null && s.contractDays <= d.contract) out.push('contract');
  if (s.lastSeenDays != null && s.lastSeenDays >= d.last_seen) out.push('last_seen');
  if (s.lastOutcome !== 'ok') out.push('data');
  return out;
}

export const NEED_LABEL: Record<Need, string> = {
  no_post: 'No post',
  contract: 'Contract',
  last_seen: 'Last seen',
  data: 'Data problem',
};
