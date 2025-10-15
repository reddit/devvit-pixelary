// Note: Menu API may not be available in current devvit version
// import { Menu } from '@devvit/web/server';

/**
 * Moderator menu actions for Pixelary
 * Provides admin tools for dictionary management and post operations
 */

// Commented out until Menu API is available
/*
export const moderatorMenu = Menu({
  name: 'Pixelary Admin',
  location: 'post',
  forUserType: 'moderator',
});

moderatorMenu.addMenuItem({
  label: 'Edit Dictionary',
  handler: async (event: { postId: string }) => {
    // This would open a dictionary management interface
    console.log('Opening dictionary editor for post:', event.postId);

    // In a real implementation, this would:
    // 1. Open a modal with dictionary management UI
    // 2. Allow adding/removing words
    // 3. Show banned words list
    // 4. Allow setting featured community (if r/Pixelary)
  },
});

moderatorMenu.addMenuItem({
  label: 'Edit Banned Words',
  handler: async (event: { postId: string }) => {
    console.log('Opening banned words editor for post:', event.postId);

    // This would open a banned words management interface
  },
});

moderatorMenu.addMenuItem({
  label: 'Reveal Word',
  handler: async (event: { postId: string }) => {
    console.log('Revealing word for post:', event.postId);

    // This would reveal the word in a comment
    // Only available for drawing posts
  },
});

moderatorMenu.addMenuItem({
  label: 'Create Weekly Collection',
  handler: async (event: { postId: string }) => {
    console.log('Creating weekly collection for post:', event.postId);

    // This would create a weekly leaderboard post
    // Only available in r/Pixelary
  },
});

// Special menu for r/Pixelary moderators
export const pixelaryAdminMenu = Menu({
  name: 'Pixelary Super Admin',
  location: 'post',
  forUserType: 'moderator',
  forSubreddit: 'Pixelary',
});

pixelaryAdminMenu.addMenuItem({
  label: 'Set Featured Community',
  handler: async (event: { postId: string }) => {
    console.log('Setting featured community for post:', event.postId);

    // This would open a featured community selector
  },
});

pixelaryAdminMenu.addMenuItem({
  label: 'View Analytics',
  handler: async (event: { postId: string }) => {
    console.log('Opening analytics for post:', event.postId);

    // This would show word selection analytics and game statistics
  },
});

pixelaryAdminMenu.addMenuItem({
  label: 'Manage Communities',
  handler: async (event: { postId: string }) => {
    console.log('Managing communities for post:', event.postId);

    // This would show the list of communities and allow management
  },
});
*/
