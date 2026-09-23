import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMemoryStore, readAuditLog, resetMemoryStore } from './memory-store';

process.env.ENCRYPTION_KEY = 'test-encryption-key-1234567890ab';
process.env.DATA_BACKEND = 'memory';

test('memory store: age gate, feed, likes, subscribe, profile, soft delete', async () => {
  resetMemoryStore();
  const store = createMemoryStore();
  const member = await store.getUserById('usr_member');
  assert.equal(member?.ageVerification, false);

  const confirmed = await store.confirmAge('usr_member');
  assert.equal(confirmed.ageVerification, true);
  assert.ok(readAuditLog().some((entry) => entry.metadata && 'ageVerification' in entry.metadata));

  const newest = await store.listContent({ sort: 'newest', page: 1, pageSize: 12 }, 'usr_member');
  assert.equal(newest.items.length, 12);
  assert.equal(newest.hasMore, true);
  assert.ok(newest.total >= 16);
  assert.ok(newest.items.every((item) => item.locked || item.mediaUrl !== null));
  assert.ok(newest.items[0].createdAt >= newest.items[1].createdAt);

  const popular = await store.listContent({ sort: 'popular', page: 1, pageSize: 5 }, 'usr_member');
  assert.ok(popular.items[0].likeCount >= popular.items[1].likeCount);

  const photo = await store.listContent({ sort: 'newest', page: 1, pageSize: 20, category: 'photo' }, 'usr_member');
  assert.ok(photo.items.length > 0);
  assert.ok(photo.items.every((item) => item.category === 'photo'));

  const tagged = await store.listContent(
    { sort: 'newest', page: 1, pageSize: 20, tags: ['night'] },
    'usr_member',
  );
  assert.ok(tagged.items.every((item) => item.tags.includes('night')));

  const premium = await store.listContent({ sort: 'newest', page: 1, pageSize: 12, premiumOnly: true }, 'usr_member');
  assert.ok(premium.items.every((item) => item.isPremium));
  assert.ok(premium.items.length > 0);

  const following = await store.listContent(
    { sort: 'newest', page: 1, pageSize: 12, followingOnly: true },
    'usr_member',
  );
  assert.equal(following.total, 0);

  const locked = await store.getContent('cnt_01', 'usr_member');
  assert.equal(locked?.isPremium, true);
  assert.equal(locked?.locked, true);
  assert.equal(locked?.mediaUrl, null);

  const subscribed = await store.toggleSubscribe('usr_member', 'alexrivera');
  assert.equal(subscribed.subscribed, true);
  assert.equal(subscribed.followerCount, 1281);
  const unlocked = await store.getContent('cnt_01', 'usr_member', { countView: false });
  assert.equal(unlocked?.locked, false);
  assert.ok(unlocked?.mediaUrl);

  const afterFollow = await store.listContent(
    { sort: 'newest', page: 1, pageSize: 20, followingOnly: true },
    'usr_member',
  );
  assert.ok(afterFollow.total > 0);

  const target = await store.getContent('cnt_02', 'usr_member', { countView: false });
  const liked = await store.toggleLike('usr_member', 'cnt_02');
  assert.equal(liked.liked, true);
  assert.equal(liked.likeCount, (target?.likeCount ?? 0) + 1);
  const unliked = await store.toggleLike('usr_member', 'cnt_02');
  assert.equal(unliked.liked, false);
  assert.equal(unliked.likeCount, liked.likeCount - 1);

  await assert.rejects(() => store.toggleSubscribe('usr_member', 'member'), /not a creator/);
  await assert.rejects(() => store.updateContent('usr_member', 'cnt_02', { title: 'Nope' }), /own content/);

  const created = await store.createContent('usr_member', {
    title: 'Member upload',
    description: 'Finished upload',
    tags: ['studio'],
    category: 'photo',
    mediaUrl: 'https://example.com/photo.jpg',
    mediaType: 'IMAGE',
    isPremium: false,
    status: 'PUBLISHED',
    rating: 0,
  });
  assert.equal(created.creator.isCreator, true);
  await store.softDeleteContent('usr_member', created.id);
  assert.equal(await store.getContent(created.id, 'usr_member'), null);
  assert.ok(readAuditLog().some((entry) => entry.action === 'delete' && entry.entityId === created.id));

  const saved = await store.updateProfile('usr_member', {
    displayName: 'Member Name',
    bio: 'Hello',
    location: 'Austin',
    orientation: 'queer',
    interests: ['music'],
    preferences: {
      showOnlineStatus: true,
      allowMessages: false,
      hideFromSearch: true,
      notificationEmail: 'hidden@example.com',
    },
  });
  assert.equal(saved.preferences.allowMessages, false);
  assert.equal(saved.preferences.notificationEmail, 'hidden@example.com');
  const again = await store.getEditableProfile('usr_member');
  assert.equal(again?.preferences.hideFromSearch, true);
  const publicProfile = await store.getCreator('member', 'usr_alex');
  assert.equal(publicProfile?.displayName, 'Member Name');
  assert.ok(publicProfile && !('preferences' in publicProfile));

  const report = await store.reportContent('usr_member', 'cnt_03', 'spam', 'duplicate posts');
  assert.equal(report.alreadyReported, false);
  const duplicate = await store.reportContent('usr_member', 'cnt_03', 'spam');
  assert.equal(duplicate.alreadyReported, true);

  const related = await store.relatedContent('cnt_02', 'usr_member');
  assert.ok(related.length > 0);
  assert.ok(related.every((item) => item.id !== 'cnt_02'));

  const creator = await store.getCreator('alexrivera', 'usr_member');
  assert.equal(creator?.isVerified, true);
  assert.ok((creator?.contentCount ?? 0) >= 12);
  assert.equal(creator?.subscribed, true);
});
