import { context, PostData } from '@devvit/web/client';

/**
 * Gets post data from context, handling a known iOS-specific bug where the data
 * is nested under developerData property. Known to affect iOS version 2025.41.
 *
 * @returns The post data, properly extracted for the current platform
 */
export function getPostData<T extends PostData>(): T | undefined {
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);

  if (isIos) {
    // On iOS, the actual postData might be nested under developerData
    return (context.postData?.developerData as T) ?? (context.postData as T);
  }

  return context.postData as T;
}
