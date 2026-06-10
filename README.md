# 🏰 Epic-Earth Engine

An MMORPG game engine inspired by Ragnarok Online, built as a pnpm monorepo with a Next.js client and a dedicated WebSocket game server.

## Stack

| Layer | Technology |
|---|---|
| **Monorepo** | pnpm 10.15.1 + Turborepo |
| **Client** | Next.js 15 (React 19), Three.js / React Three Fiber, Zustand |
| **Server** | Node.js, `ws` WebSocket server, tsx (dev runner) |
| **Database** | Supabase (PostgreSQL + Auth) |
| **Styling** | Tailwind CSS 4, `@tailwindcss/postcss` |
| **Shared** | `@epic-earth/shared` — typed packet contracts, RO-inspired formulas, map definitions |
| **Language** | TypeScript 5.9 (strict across all packages) |

## Prerequisites

- Node.js >= 20
- pnpm 10.15.1 (`corepack enable` / `npm i -g pnpm@10.15.1`)
- A Supabase project (free tier works)

## Quick start

```bash
pnpm install
```

Create env files:

**`apps/client/.env.local`**
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
GEMINI_API_KEY=your-gemini-key
APP_URL=http://localhost:3000
```

**`apps/server/.env`**
```
PORT=3001
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key
```

Apply the database schema:

```bash
# via Supabase CLI or dashboard SQL editor
# file: supabase/migrations/00001_initial_schema.sql
```

Start both client and server:

```bash
pnpm dev
```

Or run them individually:

```bash
cd apps/client && pnpm dev   # http://localhost:3000
cd apps/server && pnpm dev   # ws://localhost:3001
```

## Available commands

| Command | Description |
|---|---|
| `pnpm dev` | Start client + server in dev mode (turbo) |
| `pnpm build` | Build all packages |
| `pnpm lint` | Run ESLint (client only; server is a no-op) |
| `pnpm typecheck` | Run `tsc --noEmit` across all packages |
| `pnpm clean` | Remove build artifacts |

## Project structure

```
apps/
  client/          # Next.js 15 app — game UI, R3F canvas, ECS, Zustand store
    src/
      core/        # ECSWorld, Zustand store, GameClock
      ui/          # React components, R3F canvas (dynamic import, no SSR)
      world/       # Grid pathfinding, map/region/portal/spawn managers
      network/     # WebSocketChannel + typed packet dispatch
      data/        # JSON catalogs (items, monsters, jobs, skills, npcs)
      entities/    # Player, Monster, NPC, Pet entity classes
      stats/       # RO-derived stat formulas
      inventory/   # Inventory, equipment, storage systems
      lib/         # Supabase anon-client
  server/          # WebSocket game server
    src/
      index.ts     # HTTP + WS server entry, packet routing
      session/     # PlayerSession (per-connection state)
      auth/        # Supabase JWT verification
      db/          # Supabase service client + character CRUD
      systems/     # WorldRoom (map-scoped multiplayer broadcast)
packages/
  shared/          # Direct-import type package (no build step)
    src/
      contracts.ts # Map definition layers, CellType enum
      formulas.ts  # Stat calculations (ASPD, ATK, DEF, flee, hit)
      network.ts   # PacketType enum + all packet payload types
supabase/
  migrations/      # SQL schema (accounts, characters, inventory, etc.)
```

## Architecture overview

- **ECS-lite core**: Entities carry typed component maps. Systems query entities by component and run inside `store.tick(deltaTime)`.
- **Data-driven**: All game content (items, monsters, jobs, skills) lives in `apps/client/src/data/*.json` — the JSON files are the source of truth, not hardcoded logic.
- **GameClock**: A `requestAnimationFrame`-based loop that calls `store.tick()` with delta time, separate from R3F's render loop.
- **Packet protocol**: Typed JSON messages over WebSocket. `ClientPacket` and `ServerPacket` discriminated unions are shared between server and client via the `@epic-earth/shared` package.
- **Supabase**: Used for authentication (client-side anon key) and data persistence (server-side service key).

## Gotchas

- The `@epic-earth/shared` package is **not compiled** — its `main`/`types` point directly to `./src/index.ts`. The `bundler` module resolution in tsconfig handles this.
- ESLint errors **do not** block builds (`ignoreDuringBuilds: true`). Type errors **do** (`ignoreBuildErrors: false`).
- Server has no linter configured.
- No test framework is set up yet.
- Client `README.md` is AI Studio boilerplate — ignore it.
