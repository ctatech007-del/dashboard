import { test } from 'node:test';
import assert from 'node:assert/strict';
import { instagramHandle, istDay, matchMembers, rewardMessage, rewardReady } from '../supabase/functions/_shared/heartbeat.ts';

const student = (id: string, ig: string, email: string | null = null, hb: string | null = null) =>
  ({ id, ig_handle: ig, email, heartbeat_user_id: hb, name: id });

test('instagram links in any shape become a handle', () => {
  assert.equal(instagramHandle('https://www.instagram.com/Riya.Travels/'), 'riya.travels');
  assert.equal(instagramHandle('@riya'), 'riya');
  assert.equal(instagramHandle('not a handle!'), null);
  assert.equal(instagramHandle(undefined), null);
});

test('matching: saved id, then email, then Instagram; a member is never used twice', () => {
  const members = [
    { id: 'm1', email: 'a@x.com', socialLinks: { instagram: 'instagram.com/aaa' } },
    { id: 'm2', email: 'b@x.com' },
    { id: 'm3', socialLinks: { instagram: '@ccc' } },
  ];
  const got = matchMembers([
    student('s1', 'zzz', 'A@X.com'),          // email
    student('s2', 'ccc'),                     // instagram
    student('s3', 'aaa'),                     // Instagram points at m1, already taken by email
    student('s4', 'qqq', null, 'm2'),         // saved id
  ], members);
  assert.deepEqual([...got].map(([s, m]) => [s, m.member.id, m.via]).sort(),
    [['s1', 'm1', 'email'], ['s2', 'm3', 'instagram'], ['s4', 'm2', 'id']]);
});

test('a saved id claims its member before any guess', () => {
  const got = matchMembers([student('s1', 'aaa'), student('s2', 'other', null, 'm1')],
    [{ id: 'm1', socialLinks: { instagram: 'aaa' } }]);
  assert.equal(got.get('s2')?.member.id, 'm1');
  assert.equal(got.has('s1'), false);
});

test('logins become IST days', () => {
  assert.equal(istDay('2026-10-30T19:00:00Z'), '2026-10-31');
  assert.equal(istDay('2026-10-30T18:00:00Z'), '2026-10-30');
});

test('reward message: first name, step, rich text, no HTML injection', () => {
  assert.equal(rewardMessage('Hi {name}! {step} posts <3\n\nClaim it here.', 'Riya Sharma', 15),
    '<p>Hi Riya! 15 posts &lt;3</p><p>Claim it here.</p>');
});

test('reward message as the client wrote it: {first_name}, post number and the prize link', () => {
  const t = 'Hi {first_name},\n\nCongrats on reaching post #{step}!\n\nHere\'s your prize 🎁 👉 {claim}';
  assert.equal(rewardMessage(t, 'Riya Sharma', 30, 'https://travelamore.notion.site/p/Music?x=1&y=2'),
    '<p>Hi Riya,</p><p>Congrats on reaching post #30!</p>'
    + '<p>Here\'s your prize 🎁 👉 <a href="https://travelamore.notion.site/p/Music?x=1&amp;y=2">Click here to claim it</a></p>');
  assert.equal(rewardMessage('Hi {{first_name}}', 'Riya Sharma', 10), '<p>Hi Riya</p>');
  // Held back until that milestone has a prize link
  assert.equal(rewardReady(t, { 10: 'https://a' }, 10), true);
  assert.equal(rewardReady(t, { 10: 'https://a' }, 35), false);
  assert.equal(rewardReady('No link here', {}, 35), true);
});
