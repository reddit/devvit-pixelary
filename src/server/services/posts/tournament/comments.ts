export function generateTournamentCommentText(word: string): string {
  return `**Pixelary Drawing Tournaments!**

The current challenge is: "**${word}**"

**How it works**
- **Pick the best drawing**: In the game area above, you'll see pairs of community drawings. Choose the one you think deserves to win — every pick shifts the Elo scores.
- **Join the battle**: Have your own take on “${word}”? Post your drawing as an image comment to enter and earn points.

**Climb the leaderboard**
Each drawing's rating changes with every pick. The top 10 of the day earn special rewards when the tournament resets every 24 hours.

**Explore the gallery**: See every creative (and chaotic) interpretation of “${word}” in the full gallery.

May the best artist win!`;
}
