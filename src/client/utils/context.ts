import { context, type PostData } from '@devvit/web/client';

/**
 * Gets post data from context, handling a known iOS-specific bug where the data
 * is nested under developerData property. Known to affect iOS version 2025.41.
 *
 * @returns The post data, properly extracted for the current platform
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function getPostData<T extends PostData>(): T | undefined {
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);

  if (isIos) {
    // On iOS, the actual postData might be nested under developerData
    const pd = context.postData as unknown as { developerData?: T } | undefined;
    if (pd?.developerData) return pd.developerData;
    return context.postData as T;
  }

  return context.postData as T;
}
