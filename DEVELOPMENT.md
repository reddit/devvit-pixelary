# Development Guide

## Setup

- Install deps: `npm install`
- Playtest: `npm run dev` (builds client/server and runs `devvit playtest`)
- Open UI locally: `npm run dev:vite` (serves client at port 7474)

## Deploy

- `npm run launch` (build, upload, publish)

## Architecture

- Client: React + Canvas in `src/client/`
- Server: Express + tRPC in `src/server/`
- Shared: Zod schemas/types and words in `src/shared/`

### Endpoints (tRPC)

- `system.ping`, `session.init`
- `drawing.{upsert,get,clear}`
- `progress.submit`, `leaderboard.top`
- `stats.get`, `presence.ping`
- `game.{start,status,finish}`, `history.get`
- `config.update`

### Storage (Redis)

- `post:{postId}:config` (cache), `postdata` (source-of-truth)
- `post:{postId}:drawing:{username}` (hash + chunked parts)
- `post:{postId}:leaderboard` (zset), `post:{postId}:stats` (hash)
- `post:{postId}:presence` (zset), `post:{postId}:users` (zset)
- `post:{postId}:game:{username}` (hash), `post:{postId}:history:{username}`
  (zset)

### Realtime

- Presence channel `presence:{postId}`; client subscribes, server publishes

## Testing

- Run tests: `npm run type-check && npm run lint && vitest`
- Client tests: `src/client/utils/*.test.ts`
- Server tests: `src/server/services/*.test.ts`,
  `src/server/trpc/router.test.ts`

## Tech Stack

- [Devvit](https://developers.reddit.com/): Reddit's developer platform
- [Vite](https://vite.dev/): For compiling the webView
- [React](https://react.dev/): For UI
- [Express](https://expressjs.com/): For backend logic
- [Tailwind](https://tailwindcss.com/): For styles
- [TypeScript](https://www.typescriptlang.org/): For type safety

## Getting Started

> Make sure you have Node 22 downloaded on your machine before running!

1. Run `npm create devvit@latest --template=react`
2. Go through the installation wizard. You will need to create a Reddit account
   and connect it to Reddit developers
3. Copy the command on the success page into your terminal

## Commands

- `npm run dev`: Starts a development server where you can develop your
  application live on Reddit
- `npm run build`: Builds your client and server projects
- `npm run deploy`: Uploads a new version of your app
- `npm run launch`: Publishes your app for review
- `npm run login`: Logs your CLI into Reddit
- `npm run check`: Type checks, lints, and prettifies your app

## Cursor Integration

This template comes with a pre-configured cursor environment. To get started,
[download cursor](https://www.cursor.com/downloads) and enable the `devvit-mcp`
when prompted.
