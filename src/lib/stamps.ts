// The 22 Passport stamps. Names and texts must match the brief word for word
// (docs/brief-2026-10.md); keys match award_stamps() in the database.

export type StampShape = 'rect' | 'circle' | 'oval' | 'octagon' | 'ticket' | 'seal';

/** How a stamp is drawn: outline, ink colour and the big figure in the middle (if any). */
export interface StampDef {
  key: string; name: string; text: string; shape: StampShape; ink: string; big?: string; group: number;
}

// Inks from the client's prototype: faded teal, green, blue, purple, red; groups are the rows
// of "Stamps you can collect" (the brief: category headings are only for our reference).
const TEAL = '#3f8396', GREEN = '#3f8a59', BLUE = '#4a6fb5', PURPLE = '#8466b8', RED = '#c2524a';
const GOLD = '#a8812a', BROWN = '#8b5a2b', CRIMSON = '#a83b5a', SLATE = '#5d6b7d';

export const STAMPS: StampDef[] = [
  { key: 'takeoff', name: 'Takeoff', text: 'Welcome to Creator Takeoff Academy', shape: 'rect', ink: TEAL, group: 0 },
  { key: 'silver_wings', name: 'Silver Wings', text: '6 months in the Academy', shape: 'rect', ink: SLATE, big: '6', group: 0 },
  { key: 'golden_wings', name: 'Golden Wings', text: '1 year in the Academy', shape: 'rect', ink: GOLD, big: '1', group: 0 },
  { key: 'boarding_pass', name: 'Boarding Pass', text: 'First post', shape: 'oval', ink: PURPLE, group: 1 },
  { key: 'jet_setter', name: 'Jet Setter', text: '15 posts in one month', shape: 'ticket', ink: PURPLE, big: '15', group: 1 },
  { key: 'frequent_flyer', name: 'Frequent Flyer', text: '10+ posts 3 months in a row', shape: 'ticket', ink: BLUE, big: '10+', group: 1 },
  { key: 'wanderer', name: 'Wanderer', text: '1K followers', shape: 'circle', ink: BLUE, big: '1K', group: 2 },
  { key: 'explorer', name: 'Explorer', text: '5K followers', shape: 'circle', ink: BLUE, big: '5K', group: 2 },
  { key: 'nomad', name: 'Nomad', text: '10K followers', shape: 'circle', ink: BLUE, big: '10K', group: 2 },
  { key: 'globetrotter', name: 'Globetrotter', text: '25K followers', shape: 'circle', ink: BLUE, big: '25K', group: 2 },
  { key: 'trailblazer', name: 'Trailblazer', text: '50K followers', shape: 'circle', ink: BLUE, big: '50K', group: 2 },
  { key: 'legend', name: 'Legend', text: '100K followers', shape: 'circle', ink: BLUE, big: '100K', group: 2 },
  { key: 'economy_premium', name: 'Economy Premium', text: '+100 followers in one month', shape: 'rect', ink: GREEN, big: '+100', group: 3 },
  { key: 'business_class', name: 'Business Class', text: '+1K followers in one month', shape: 'rect', ink: GREEN, big: '+1K', group: 3 },
  { key: 'first_class', name: 'First Class', text: '+10K followers in one month', shape: 'rect', ink: GREEN, big: '+10K', group: 3 },
  { key: 'hidden_gem', name: 'Hidden Gem', text: '10K views on one post', shape: 'octagon', ink: RED, big: '10K', group: 4 },
  { key: 'landmark', name: 'Landmark', text: '100K views on one post', shape: 'octagon', ink: RED, big: '100K', group: 4 },
  { key: 'wonder_of_the_world', name: 'Wonder of the World', text: '1M views on one post', shape: 'octagon', ink: RED, big: '1M', group: 4 },
  { key: 'around_the_world', name: 'Around the World', text: '100 Post Challenge completed', shape: 'seal', ink: BROWN, big: '100', group: 5 },
  { key: 'co_pilot', name: 'Co-Pilot', text: 'First collab post', shape: 'oval', ink: TEAL, group: 5 },
  { key: 'captain', name: 'Captain', text: 'Top 3 on any leaderboard', shape: 'circle', ink: CRIMSON, big: 'TOP 3', group: 5 },
  { key: 'first_captain', name: 'First Captain', text: '#1 on any leaderboard', shape: 'circle', ink: CRIMSON, big: '#1', group: 5 },
];

export const STAMP = new Map(STAMPS.map((s) => [s.key, s]));

export const REWARD_STEPS = [10, 15, 30, 35, 50, 55, 70, 75, 90, 95, 100];

/** Passport machine-readable lines, e.g. "P<CRT<BOES<<JULIAN<<<…". 44 characters each, like a real one. */
export function mrz(name: string, handle: string, memberSince: string, stamps: number): [string, string] {
  const clean = (s: string) => s.normalize('NFKD').replace(/[^A-Za-z0-9 ]/g, '').toUpperCase().trim();
  const parts = clean(name).split(/\s+/).filter(Boolean);
  const last = parts.length > 1 ? parts[parts.length - 1] : parts[0] ?? '';
  const given = parts.length > 1 ? parts.slice(0, -1).join('<') : '';
  const pad = (s: string) => (s + '<'.repeat(44)).slice(0, 44);
  const since = memberSince.slice(2, 7).replace('-', '');   // 2026-02-01 → 2602
  return [
    pad(`P<CRT<${last}<<${given}`),
    pad(`${clean(handle).replace(/ /g, '<')}<<CTA${since}<<${String(stamps).padStart(2, '0')}${STAMPS.length}`),
  ];
}

/** Small stable number from a string, for each stamp's tilt. */
export function tilt(key: string, spread = 14) {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) | 0;
  return ((Math.abs(h) % (spread * 2 + 1)) - spread);
}
