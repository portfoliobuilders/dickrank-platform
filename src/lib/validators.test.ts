import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contentListQuerySchema, createContentSchema, updateProfileSchema } from './validators';

test('lists content with category, sort, and page defaults', () => {
  const parsed = contentListQuerySchema.parse({
    category: 'photo',
    sort: 'popular',
    page: '2',
    tags: 'studio,night',
  });
  assert.equal(parsed.category, 'photo');
  assert.equal(parsed.sort, 'popular');
  assert.equal(parsed.page, 2);
});

test('rejects empty content titles', () => {
  const result = createContentSchema.safeParse({
    title: '  ',
    mediaUrl: 'https://example.com/a.jpg',
    mediaType: 'IMAGE',
  });
  assert.equal(result.success, false);
});

test('requires an email or a blank notification field', () => {
  const bad = updateProfileSchema.safeParse({
    displayName: 'Alex',
    bio: '',
    location: '',
    orientation: null,
    interests: [],
    preferences: {
      showOnlineStatus: false,
      allowMessages: true,
      hideFromSearch: false,
      notificationEmail: 'not-an-email',
    },
  });
  assert.equal(bad.success, false);

  const good = updateProfileSchema.parse({
    displayName: 'Alex',
    bio: '',
    location: '',
    orientation: 'queer',
    interests: ['studio'],
    preferences: {
      showOnlineStatus: false,
      allowMessages: true,
      hideFromSearch: false,
      notificationEmail: '',
    },
  });
  assert.equal(good.displayName, 'Alex');
});
