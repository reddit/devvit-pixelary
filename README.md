# Pixelary

Pixelary is a community drawing and guessing game built for Reddit communities.
Players draw pixel art based on randomly selected words, and other community
members guess what they've drawn. The game was designed and built for
[r/Pixelary](https://reddit.com/r/Pixelary), but anyone can install it.

Pixelary is an [open source](https://github.com/reddit/devvit-pixelary) project.

## How It Works

**Gameplay Flow**

1. **Word Selection** - Choose from three random words (10 seconds)
2. **Drawing** - Create pixel art on a 16x16 canvas (60 seconds)
3. **Guessing** - Community members guess what you drew
4. **Scoring** - Earn points for posting and getting correct guesses

**Scoring System**

- **25 points** for posting a drawing
- **1 point per correct guess** on your drawing
- **5 points** for solving someone else's drawing

## Progression System

Players earn points to level up, unlocking perks:

- Level 2+: Extra drawing time (+15s per level)
- Level 3: Add/remove custom words
- Level 4: +35 extended colors (43 total colors)
- All levels: Level flair

## Word Selection

Pixelary uses a non-personalized slate bandit system for word selection:

- **UCB algorithm** balances popular words with underutilized ones
- Tracks pick rates, post rates, and completion metrics
- Automatically optimizes word selection over time

## Community & Support

- **Join the discussion**: [r/Pixelary](https://reddit.com/r/Pixelary)
- **Open source**:
  [GitHub Repository](https://github.com/reddit/devvit-pixelary)
- **Support**: Visit our community or open an issue on GitHub

---

_May the best artist win!_
