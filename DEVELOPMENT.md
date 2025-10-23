# Development Guide

## Setup

- Install deps: `npm install`
- Playtest: `npm run dev` (builds client/server and runs `devvit playtest`)
- Open UI locally: `npm run dev:vite` (serves client at port 7474)

## Deploy

- `npm run deploy` (build, upload, publish)

## Architecture

- Client: React + Canvas in `src/client/`
- Server: Express + tRPC in `src/server/`
- Shared: Zod schemas/types and words in `src/shared/`

### Endpoints (tRPC)

See `src/server/trpc/router.ts` for all available endpoints.

### Storage (Redis)

See `src/server/services/redis.ts` for centralized Redis key management and
storage patterns.

## Testing

- Run tests: `npm run check` (includes type-check, lint, prettier, and tests)
- Client tests: `src/client/**/*.test.*`
- Server tests: `src/server/**/*.test.*`
- Shared tests: `src/shared/**/*.test.*`

## Tech Stack

- [Devvit](https://developers.reddit.com/): Reddit's developer platform
- [Vite](https://vite.dev/): For compiling the webView
- [React](https://react.dev/): For UI
- [Express](https://expressjs.com/): For backend logic
- [Tailwind](https://tailwindcss.com/): For styles
- [TypeScript](https://www.typescriptlang.org/): For type safety

## Commands

- `npm run dev`: Starts a development server where you can develop your
  application live on Reddit
- `npm run build`: Builds your client and server projects
- `npm run deploy`: Uploads and publishes your app
- `npm run login`: Logs your CLI into Reddit
- `npm run check`: Type checks, lints, and prettifies your app

## Cursor Integration

This project is configured cursor environment. To get started,
[download cursor](https://www.cursor.com/downloads) and enable the `devvit-mcp`
when prompted.
