# AGENTS.md (ai-chat)

Agentic coding guide for this repository (commands + conventions).

## Project Overview

- Frontend: Vite + TanStack Start (SSR) React + TypeScript (`src/`).
- Backend data: Convex (`convex/`).
- AI streaming API: standalone Hono server (`scripts/server/`).
- Styling: Tailwind CSS v4 + `cn()` helper (`src/lib/utils.ts`).

## Repository Layout

- `src/`: TanStack Start app code.
- `src/_components/`: app + UI components.
- `src/app/`: route files (TanStack Router).
- `convex/`: schema + queries/mutations/actions.
- `scripts/server/`: Hono API server (streaming endpoints).
- `scripts/`: one-off scripts (icon generation, caching, etc.).

## Common Commands (Bun-first)

Install:

- `bun install`

Dev:

- `bun dev` (web on `http://localhost:3000`)
- `bun dev:server` (AI API server on `http://localhost:3001`, watch mode)
- Convex dev (functions/db): `bunx convex dev` (or `npx convex dev`)

Build / Run:

- `bun build` (SSR build)
- `bun preview` (build + preview)
- `bun start` (runs Nitro output: `node --env-file=.env .output/server/index.mjs`)
- `bun start:server` (runs Hono server: `bun run scripts/server.ts`)

## Lint / Format / Typecheck

- `bun lint` (oxlint, type-aware; config: `.oxlintrc.json`)
- `bun lint:fix` (autofix what oxlint can)
- `bun typecheck` (`tsgo --noEmit`)
- `bun check` (lint + typecheck)
- `bun format:check` / `bun format:write` (Prettier)

## Tests (Bun)

No `*.test.*`/`*.spec.*` files were found during scan, but if/when tests are added:

- Run all tests: `bun test`
- Run a single test file: `bun test path/to/file.test.ts`
- Run tests by file-path substring/glob: `bun test chat` (matches paths)
- Run a single test by name (regex): `bun test --test-name-pattern "should do X"`
- Single test within a file: `bun test path/to/file.test.ts --test-name-pattern "^My suite"`

Preferred test conventions:

- Filenames: `*.test.ts` / `*.test.tsx`
- Location: colocated next to source, or `src/**/__tests__/`.

## Formatting

- Prettier is the source of truth: `.prettierrc`.
- Key settings: 2 spaces, `printWidth: 100`, double quotes, trailing commas.
- Tailwind class sorting is enabled via `prettier-plugin-tailwindcss`.

## Imports

- ESM only (`package.json` has `"type": "module"`).
- Use `import type { ... }` for type-only imports.
- Keep imports grouped (pattern in repo):
  1. External packages
  2. Internal aliases (`@/...`)
  3. Relative (`./`, `../`)
- Prefer relative imports within the same folder; use aliases across folders.

Path aliases (`tsconfig.json`):

- `@/*` -> `src/*`
- `@/components/*` -> `src/_components/*`
- `@/convex/*` -> `convex/*`

## TypeScript / Validation

- Strict TS is enabled (`strict: true`, `noUncheckedIndexedAccess: true`).
- Avoid `any`; use `unknown` + narrowing.
- Use Zod v4 consistently: `import { z } from "zod/v4"`.

Convex IDs:

- Convex uses branded IDs (`Id<"threads">`, etc.).
- For untrusted input (requests, params), validate/normalize IDs via Zod helpers
  in `src/lib/server/validate-request-body.ts`.

## Naming

- Files: kebab-case (common in `src/` and `scripts/`).
- React components: PascalCase exports (`export function UserNavbar() { ... }`).
- Functions/vars: camelCase.
- Constants/regex: `UPPER_SNAKE_CASE`.

## React / UI

- Prefer function components and hooks.
- Use Tailwind classes + `cn()` (`src/lib/utils.ts`) over manual string concat.
- Use `React.memo` for expensive/pure subtrees (pattern: `src/_components/ui/code-block.tsx`).
- Avoid `dangerouslySetInnerHTML` unless necessary and scoped.
- Be SSR-safe: guard `window`/DOM access (`typeof window === "undefined"`).

## Error Handling & Logging

Hono server (`scripts/server/`):

- Validate request bodies with Zod and return JSON errors with HTTP status.
- Prefer `Response.json({ error: { message } }, { status })` for API errors.
- Use best-effort persistence when appropriate: wrap non-critical calls in `tryCatch()`
  (`src/lib/utils.ts`) so the request can still succeed.

Convex (`convex/`):

- Prefer `authenticatedQuery` / `authenticatedMutation` (`convex/components.ts`).
- Access the authed user via `ctx.user`.
- Throw canonical auth errors (strings are relied on by client retry logic in `src/router.tsx`):
  - `new Error("Not authenticated")`
  - `new Error("Not authorized")`
- Keep side-effects best-effort; don’t block core DB writes on stats updates.

Logging:

- Prefer `logger` from `src/lib/axiom/logger.ts` for structured logs.
- Avoid adding noisy `console.log` in frontend code.

## Environment Variables / Secrets

- Env validation lives in `src/env.js` (`@t3-oss/env-core`).
- `.gitignore` ignores `.env`, `.env*.local`, `.env*.prod`.
- Do not commit secrets; if needed, add a `.env.example` (no real keys).

## Generated / Do Not Edit

- `src/routeTree.gen.ts` (TanStack router generation)
- `convex/_generated/*` (Convex codegen)
- `.output/` (build artifacts)
