// The 22 Passport stamps. Names and texts must match the brief word for word
// (docs/brief-2026-10.md); keys match award_stamps() in the database.

export type StampShape = 'circle' | 'rect' | 'oval';

export interface StampDef { key: string; name: string; text: string; shape: StampShape; ink: string }

// Groups are only for us (the brief: "the category headings are just for our reference").
const ACADEMY = { shape: 'circle' as const, ink: '#c4561b' };
const POSTS = { shape: 'rect' as const, ink: '#2f7a4c' };
const FOLLOWERS = { shape: 'oval' as const, ink: '#2e4f8f' };
const GROWTH = { shape: 'rect' as const, ink: '#8a3f8f' };
const VIEWS = { shape: 'circle' as const, ink: '#b03a35' };
const OTHER = { shape: 'oval' as const, ink: '#1f6f78' };

export const STAMPS: StampDef[] = [
  { key: 'takeoff', name: 'Takeoff', text: 'Welcome to Creator Takeoff Academy', ...ACADEMY },
  { key: 'silver_wings', name: 'Silver Wings', text: '6 months in the Academy', ...ACADEMY },
  { key: 'golden_wings', name: 'Golden Wings', text: '1 year in the Academy', ...ACADEMY },
  { key: 'boarding_pass', name: 'Boarding Pass', text: 'First post', ...POSTS },
  { key: 'jet_setter', name: 'Jet Setter', text: '15 posts in one month', ...POSTS },
  { key: 'frequent_flyer', name: 'Frequent Flyer', text: '10+ posts 3 months in a row', ...POSTS },
  { key: 'wanderer', name: 'Wanderer', text: '1K followers', ...FOLLOWERS },
  { key: 'explorer', name: 'Explorer', text: '5K followers', ...FOLLOWERS },
  { key: 'nomad', name: 'Nomad', text: '10K followers', ...FOLLOWERS },
  { key: 'globetrotter', name: 'Globetrotter', text: '25K followers', ...FOLLOWERS },
  { key: 'trailblazer', name: 'Trailblazer', text: '50K followers', ...FOLLOWERS },
  { key: 'legend', name: 'Legend', text: '100K followers', ...FOLLOWERS },
  { key: 'economy_premium', name: 'Economy Premium', text: '+100 followers in one month', ...GROWTH },
  { key: 'business_class', name: 'Business Class', text: '+1K followers in one month', ...GROWTH },
  { key: 'first_class', name: 'First Class', text: '+10K followers in one month', ...GROWTH },
  { key: 'hidden_gem', name: 'Hidden Gem', text: '10K views on one post', ...VIEWS },
  { key: 'landmark', name: 'Landmark', text: '100K views on one post', ...VIEWS },
  { key: 'wonder_of_the_world', name: 'Wonder of the World', text: '1M views on one post', ...VIEWS },
  { key: 'around_the_world', name: 'Around the World', text: '100 Post Challenge completed', ...OTHER },
  { key: 'co_pilot', name: 'Co-Pilot', text: 'First collab post', ...OTHER },
  { key: 'captain', name: 'Captain', text: 'Top 3 on any leaderboard', ...OTHER },
  { key: 'first_captain', name: 'First Captain', text: '#1 on any leaderboard', ...OTHER },
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
