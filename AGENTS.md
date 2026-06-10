# AGENTS.md — Epic-Earth Engine

## Monorepo structure

pnpm workspace (v10.15.1) + Turborepo. `apps/*` and `packages/*`.

| package | path | description |
|---|---|---|
| `@epic-earth/client` | `apps/client/` | Next.js 15 (React 19) + Three.js/R3F + Zustand + Supabase |
| `@epic-earth/server` | `apps/server/` | WebSocket server (`ws`), tsx runner, Supabase |
| `@epic-earth/shared` | `packages/shared/` | Types only: packet contracts, formulas, map defs, `CellType` |

## Commands (run from root)

- `pnpm dev` — turbo dev (all packages)
- `pnpm build` — turbo build
- `pnpm lint` — turbo lint
- `pnpm typecheck` — turbo typecheck (tsc --noEmit per package)
- `pnpm clean` — turbo clean

Client dev standalone: `cd apps/client && pnpm dev` (next dev, port 3000)
Server dev standalone: `cd apps/server && pnpm dev` (tsx watch, port 3001)

## Required env vars

- **client** (`apps/client/.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GEMINI_API_KEY`, `APP_URL`
- **server** (`apps/server/.env`): `PORT` (3001), `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`

Turborepo's `globalDependencies` includes `**/.env.*local` — changing env triggers rebuild.

## Architecture

**Client** (`apps/client/src/`):
- `core/ecs.ts` — ECSWorld with typed ComponentMap, entity queries by component
- `core/store.ts` — Zustand store: game state, ECS world, spawners, inventory, buffs, combat tick
- `core/game-loop.ts` — GameClock: rAF-based loop calling `store.tick(deltaTime)`
- `ui/GameClient.tsx` — main React component (Next.js "use client"), R3F canvas loaded via `dynamic(() => import(...), { ssr: false })`
- `ui/AuthGate.tsx` — Supabase auth wrapper
- `world/` — grid pathfinding, map loading, spawn/region/portal managers
- `network/` — WebSocketChannel with typed packet dispatch; `@epic-earth/shared` `PacketType` enum as message discriminator
- `data/*.json` — pure data catalogs (items, monsters, jobs, skills, npcs) — the primary source of truth for game content
- `lib/supabase.ts` — anon-key client for auth
- Tailwind 4: single `@import "tailwindcss"` in `globals.css`, PostCSS plugin `@tailwindcss/postcss`

**Server** (`apps/server/src/`):
- `index.ts` — HTTP server, WebSocket server, JSON-over-ws packet routing, `WorldRoom` for multiplayer broadcast
- `session/PlayerSession.ts` — per-connection state (auth, character, position)
- `auth/index.ts` — Supabase token verification via service client
- `db/` — Supabase service client + character CRUD
- `db/characters.ts` — account & character creation/selection
- `systems/WorldRoom.ts` — map-scoped player sets, `join`/`leave`/`broadcastIncludingSelf`

**Shared** (`packages/shared/src/`):
- Direct source import by both apps (no build step needed)
- Packets: discriminated union types (`ClientPacket`, `ServerPacket`) over `PacketType` enum
- Formulas: RO-derived stat calculations (ASPD, ATK, DEF, flee, hit, cast time)
- Map types: `MapDefinition` with scene/navigation/spawns/portals/regions layers

## Key conventions

- Data-driven: game content lives in `apps/client/src/data/*.json`, not hardcoded
- ECS: systems queried via `ecsWorld.queryEntities([...components])` in `store.tick()`
- Packet protocol: JSON with `{ type, seq, payload }` shaped by shared `ClientPacket`/`ServerPacket` union types
- `eslint.ignoreDuringBuilds: true` in Next config — lint won't block builds
- `typescript.ignoreBuildErrors: false` — type errors DO block builds
- Server `lint` script is a no-op placeholder — no linter configured for server yet
- Shared package has no tests
- `shamefully-hoist=true` in `.npmrc` — all deps are hoisted
- `strict-peer-dependencies=false`

## Testing

No test framework detected in any package. No test scripts exist.

## Gotchas

- Client README.md is AI Studio boilerplate, not project documentation. Ignore it.
- Supabase schema is in `supabase/migrations/00001_initial_schema.sql` (accounts, characters, inventory, equipment, storage, skills)
- The shared package is NOT compiled — `main`/`types` point directly to `./src/index.ts`. The `bundler` module resolution in tsconfig handles this.
- `.npmrc` sets `shamefully-hoist=true` — do NOT create that file or change it
