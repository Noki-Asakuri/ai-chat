# AGENTS

1. Build/dev: `bun install`; dev: `bun run dev`; prod build: `bun run build`; start: `bun run start`; preview (build+serve): `bun run preview`.
2. Lint & format: `bun run lint` (Biome full check), auto-fix: `bun run lint:fix`; format diff: `bun run format:check`; write format: `bun run format:write`; type check: `bun run typecheck`; combined: `bun run check`.
3. Tests: (none configured). If adding vitest: add `test` script; single test suggestion: `bunx vitest path/to/file.test.ts -t "name"` (document when introduced).
4. Imports: use TypeScript ES Modules, absolute paths within `src/` only if tsconfig paths added (currently relative). Group: builtin, external, internal, styles/assets. No unused imports; prefer named over default when possible.
5. Convex: ALWAYS use new function syntax with validators (`args`, `returns` or `v.null()`); separate public (`query`,`mutation`,`action`) vs internal (`internalQuery`,`internalMutation`,`internalAction`); never expose sensitive logic publicly.
6. Convex calls: use `ctx.runQuery/Mutation/Action` with `api.*` or `internal.*` references; minimize cross-runtime actions; use indexes (`withIndex`) instead of `.filter`; paginate via `paginationOptsValidator`.
7. Validation & types: exhaustive validators; discriminate unions with string literals `as const`; prefer specific `Id<'table'>` not `string`; return `v.null()` instead of implicit undefined.
8. Error handling: throw `Error` with concise user-safe message; validate existence (e.g. channel/user) early; avoid swallowing errors; no console logs in production pathways unless analytics.
9. Naming: camelCase for functions/vars, PascalCase for components/types, UPPER_SNAKE for environment constants; file-based routing in `convex/` and Next `app/`—keep files small & cohesive.
10. React components: functional, typed props interfaces; avoid default export unless single obvious component; keep side-effects in hooks; prefer composition over inheritance.
11. State/data: use `zustand` store & React Query patterns already present; never mutate Convex docs directly—always through mutations.
12. Formatting: enforced by Biome; run `bun run lint:fix` before commits. No semicolons removal/reintroduction beyond Biome defaults; keep imports sorted (Biome handles).
13. CSS: Tailwind utility-first (see `globals.css`); co-locate component styles minimal; avoid inline style objects unless dynamic.
14. Security: validate request bodies (`lib/server/validate-request-body.ts` pattern); restrict internal-only logic to internal Convex functions; do not log secrets.
15. Files & storage: use `ctx.storage.getUrl` for file URLs; query `_storage` via system table for metadata, not deprecated methods.
16. Scheduling: only `crons.interval/cron` in `convex/crons.ts`; import `internal` even if same file.
17. Actions: add "use node" when using Node APIs; never access `ctx.db` inside actions; share logic via helpers.
18. Performance: avoid N+1 Convex queries inside loops—batch or restructure; use indexes for ordering/scans; limit message pagination sizes.
19. Adding tests later: prefer colocated `*.test.ts` under same directory; keep them pure, mock Convex boundary.
20. Always keep this file ~20 lines; update if scripts/rules (Convex guidelines in `.kilocode/rules/convex.md`) change.
