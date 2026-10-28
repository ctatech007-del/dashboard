import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanHandle, missingHandles, parseProfile, postType,
} from '../supabase/functions/_shared/apify.ts';

test('cleanHandle strips urls, @ and case', () => {
  assert.equal(cleanHandle('https://www.instagram.com/Travel.Riya/?hl=en'), 'travel.riya');
  assert.equal(cleanHandle(' @Riya_Goes '), 'riya_goes');
});

test('post types', () => {
  assert.equal(postType({ type: 'Sidecar' }), 'carousel');
  assert.equal(postType({ type: 'Image' }), 'image');
  assert.equal(postType({ type: 'Video', productType: 'clips' }), 'reel');
  assert.equal(postType({ type: 'Video', productType: 'feed' }), 'video');
  assert.equal(postType({ type: 'Story' }), null);
});

test('private and not-found profiles are outcomes, not silent skips', () => {
  assert.equal(parseProfile({ username: 'a', private: true }, null).outcome, 'private');
  assert.equal(parseProfile({ username: 'a', error: 'not_found' }, null).outcome, 'not_found');
  assert.equal(parseProfile({ username: 'a', error: 'rate limited' }, null).outcome, 'error');
});

test('overflow detection: full page of new unpinned posts', () => {
  const since = new Date('2026-11-16T00:00:00Z');
  const fresh = Array.from({ length: 12 }, (_, i) => ({
    shortCode: `p${i}`, type: 'Image', timestamp: `2026-11-2${i % 5}T10:00:00Z`,
  }));
  assert.equal(parseProfile({ username: 'a', latestPosts: fresh }, since).mayOverflow, true);
  const mixed = [...fresh.slice(0, 11), { shortCode: 'old', type: 'Image', timestamp: '2026-10-01T00:00:00Z' }];
  assert.equal(parseProfile({ username: 'a', latestPosts: mixed }, since).mayOverflow, false);
  // a pinned old post must not hide an overflow
  const pinned = [{ shortCode: 'pin', type: 'Image', timestamp: '2025-01-01T00:00:00Z', isPinned: true }, ...fresh.slice(0, 11)];
  assert.equal(parseProfile({ username: 'a', latestPosts: pinned }, since).mayOverflow, true);
});

test('missing handles become not_found', () => {
  assert.deepEqual(missingHandles(['Aaa', 'bbb'], [{ username: 'aaa' }]), ['bbb']);
});

test('followers, reel views and collabs come through; images have no views', () => {
  const r = parseProfile({
    username: 'Riya', followersCount: 1520, followsCount: 300, postsCount: 41,
    latestPosts: [
      { shortCode: 'r1', type: 'Video', productType: 'clips', timestamp: '2026-11-20T10:00:00Z', videoViewCount: 1962, ownerUsername: 'riya' },
      { shortCode: 'c1', type: 'Sidecar', timestamp: '2026-11-19T10:00:00Z', ownerUsername: 'riya' },
      { shortCode: 'x1', type: 'Image', timestamp: '2026-11-18T10:00:00Z', ownerUsername: 'someone_else' },
    ],
  }, null);
  assert.deepEqual([r.followers, r.following, r.postsCount], [1520, 300, 41]);
  assert.deepEqual(r.posts.map((p) => [p.shortcode, p.views, p.is_collab]),
    [['r1', 1962, false], ['c1', null, false], ['x1', null, true]]);
  assert.equal(parseProfile({ username: 'a', private: true }, null).followers, null);
});
