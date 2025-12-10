# Pixelary Drawing Redis Schema Versions

## Version 1: Stringified data

The very first version of the post schema
https://github.snooguts.net/reddit/pixelary/blob/main/src/posts/Editor/ReviewPage.tsx#L68C1-L76C60

```tsx
const postData: PostData = {
  word,
  data,
  author: currentUser.username,
  authorId: currentUser.id,
  date: new Date(),
};

redis.set(`post-${post.id}`, JSON.stringify(postData));
```

## Version 2a: Hash in Redis

pixelary/old_pixelary/src/utils/migration.ts

```tsx
export const migrateDrawingPostEssentials = async (
  postId: string,
  context: Context
): Promise<boolean> => {
  const oldPostKey = `post-${postId}`;
  const postType =
    (await context.redis.hGet(oldPostKey, 'postType')) ?? 'drawing';
  if (postType !== 'drawing') return false;

  const fields = [
    'data',
    'authorUsername',
    'date',
    'expired',
    'word',
    'dictionaryName',
  ];
  const postData = Object.fromEntries(
    await Promise.all(
      fields.map(async (field) => [
        field,
        (await context.redis.hGet(oldPostKey, field)) ?? '',
      ])
    )
  );
  postData.postType = 'drawing';
  postData.dictionaryName = postData.dictionaryName
    ? postData.dictionaryName
    : 'main';

  // Save new data const newPostKey = `post:${postId}`; await
  context.redis.hSet(newPostKey, postData);
  return true;
};
```

## Version 2b: old pixelary

pixelary/old_pixelary/src/service/Service.tsx

```tsx

    postData: (postId: PostId) => `post:${postId}`,
    const key = this.keys.postData(data.postId);
    await Promise.all([
      // Save post object
      this.redis.hSet(key, {
        postId: data.postId,
        data: JSON.stringify(data.data),
        authorUsername: data.authorUsername,
        date: Date.now().toString(),
        word: data.word,
        dictionaryName: data.dictionaryName,
        postType: 'drawing',
      }),
```

## Version 3: Pixelary 2.0

pixelary/src/server/services/posts/drawing.ts

```tsx
const drawing = (postId: T3) => `drawing:${postId}`;

type PostData =
  | {
      type: 'drawing';
      word: string;
      dictionary: string;
      drawing: {
        data: string;
        colors: string[];
        bg: number;
        size: number;
      };
      authorId: string;
      authorName: string;
    }
  | {
      type: 'pinned';
    }
  | {
      type: 'collection';
      collectionId: string;
      label: string;
    }
  | {
      type: 'tournament';
      word: string;
    };
```
