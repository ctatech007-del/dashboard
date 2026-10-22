// Pure helpers for turning Apify Instagram scraper items into rows.
// No Deno/Node-specific imports, so this file is unit tested with Node (`npm test`).
//
// Field names follow apify/instagram-profile-scraper and apify/instagram-post-scraper output.
// VERIFY against a real test run before go-live: Apify occasionally renames fields.

export type PostType = 'image' | 'carousel' | 'reel' | 'video';
export type Outcome = 'ok' | 'private' | 'not_found' | 'error';

export interface RawPost {
  id?: string;
  shortCode?: string;
  type?: string;            // "Image" | "Sidecar" | "Video"
  productType?: string;     // "clips" for reels, "feed", "igtv"
  url?: string;
  timestamp?: string;       // ISO
  ownerUsername?: string;
  ownerId?: string;
  isPinned?: boolean;
}

export interface RawProfile {
  id?: string;
  username?: string;
  inputUrl?: string;
  private?: boolean;
  postsCount?: number;
  latestPosts?: RawPost[];
  error?: string;
  errorDescription?: string;
}

export interface NormalizedPost {
  shortcode: string;
  post_type: PostType;
  posted_at: string;
  url: string;
  raw: RawPost;
}

export interface ProfileResult {
  handle: string;           // lowercased handle the item refers to
  igUserId: string | null;
  outcome: Outcome;
  detail: string | null;
  posts: NormalizedPost[];
  // true when every returned post is newer than `since`: there may be more we didn't get
  mayOverflow: boolean;
}

export const LATEST_POSTS_LIMIT = 12;

export function cleanHandle(input: string): string {
  return input
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/[/?#].*$/, '')
    .replace(/^@/, '')
    .toLowerCase();
}

export function postType(p: RawPost): PostType | null {
  const t = (p.type ?? '').toLowerCase();
  const product = (p.productType ?? '').toLowerCase();
  if (t === 'sidecar') return 'carousel';
  if (t === 'image') return 'image';
  if (t === 'video') return product === 'clips' ? 'reel' : 'video';
  return null;
}

export function normalizePost(p: RawPost): NormalizedPost | null {
  const type = postType(p);
  if (!type || !p.shortCode || !p.timestamp) return null;
  const posted = new Date(p.timestamp);
  if (Number.isNaN(posted.getTime())) return null;
  return {
    shortcode: p.shortCode,
    post_type: type,
    posted_at: posted.toISOString(),
    url: p.url ?? `https://www.instagram.com/p/${p.shortCode}/`,
    raw: p,
  };
}

/** Interpret one profile-scraper item. `since` = last successful check for that student. */
export function parseProfile(item: RawProfile, since: Date | null): ProfileResult {
  const handle = cleanHandle(item.username ?? item.inputUrl ?? '');
  const err = (item.error ?? '').toLowerCase();

  if (err) {
    const notFound = err.includes('not_found') || err.includes('not found') ||
      err.includes('does not exist');
    return {
      handle, igUserId: null,
      outcome: notFound ? 'not_found' : 'error',
      detail: item.errorDescription ?? item.error ?? null,
      posts: [], mayOverflow: false,
    };
  }
  if (item.private) {
    return { handle, igUserId: item.id ?? null, outcome: 'private',
      detail: 'Account is private', posts: [], mayOverflow: false };
  }

  const posts = (item.latestPosts ?? [])
    .map(normalizePost)
    .filter((p): p is NormalizedPost => p !== null);

  // Pinned posts can be old, so only unpinned posts decide whether we might have missed some.
  const unpinned = (item.latestPosts ?? []).filter((p) => !p.isPinned);
  const mayOverflow = since !== null &&
    unpinned.length >= LATEST_POSTS_LIMIT - 3 &&
    unpinned.every((p) => p.timestamp && new Date(p.timestamp) > since);

  return { handle, igUserId: item.id ?? null, outcome: 'ok', detail: null, posts, mayOverflow };
}

/** Profiles we asked for that came back with no item at all → not found. */
export function missingHandles(requested: string[], items: RawProfile[]): string[] {
  const seen = new Set(items.map((i) => cleanHandle(i.username ?? i.inputUrl ?? '')));
  return requested.map(cleanHandle).filter((h) => !seen.has(h));
}
