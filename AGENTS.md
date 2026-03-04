# AGENTS.md

Agentic coding guide for this repository. This guide is for agents to know what is the most important thing to do.

## General

This part is for agents to know what is the most important thing to do.

1. Use bun (`bun` or `bunx`) for everything.
2. Always use sub-agents in planning or building, same apply to skills when working with code and docs.
3. Follow the user's instructions exactly. If you are not sure, ask the user for confirmation.
4. For any non-trivial work (3+ distinct steps), create a `todowrite` list before doing any work, then keep it updated.
5. Never use git unless the user explicitly asks. Focus on the task at hand, and leave the version control to the user. If you want to verify something, ask the user first before doing it.

### Docs lookup

Use up-to-date docs (don't rely on training cutoffs):

- For Bun/runtime features: use `bun_SearchBun` to confirm current behavior, flags, and APIs.
- For third-party packages/APIs: use Context7 (`context7_resolve-library-id`, then `context7_query-docs`) before implementing non-trivial usage.

### Shadcn UI

The current codebase uses shadcn UI. So when adding a new component, ensure to use the Shadcn UI MCP.
It allow you to look up the current components registry, list all the components, get their example usage, and etc.
Then after you can use the shadcn cli to add it to the codebase. `bunx shadcn add <component-name>`

Do not make any changes to the `components.json` file.

## Scripts

This repo uses Bun for install and run scripts. But only use scripts that you're allowed to run or asked to run.

These scripts are needed to be run everytime you finished the task.

- `bun check`: Run lint, format and typecheck.
  - Run this at the end of every task. Ensure no errors before finishing a task.

These scripts are not needed, prefer to not use them and use `bun check` instead.

- `bun typecheck`: Typecheck the codebase.
- `bun lint` and `bun lint:fix`: Lint the codebase.
- `bun format:check` and `bun format:write`: Format the codebase.

These scripts must not be run by the agent under any circumstances.

- `bun dev` and `bun dev:server`: Start up a development server for the web app and API with watch mode.
- `bun start` and `bun start:server`: Start up a production server for the web app and API.
- `bun preview`: Build and preview the codebase.
- `bun build`: Build the codebase.

## TypeScript conventions

TypeScript are meant to be strict, predictable and type-safe.
It's forbidden to use `any` or casting `as`, instead use type narrowing.

If the type checking failing due to unrelated change not related to the task, ignore and do not fix it. Only fix the type checking if it's related to the task.

## Comments

Comment are for clarifying complex logic or workarounds, not for describing what the code does.

- IMPORTANT: do not add useless comments.
- Prefer self-explanatory code via naming and structure over comments.
- Only add comments when they clarify a race condition (for example, `setTimeout`), a long-term TODO, or a confusing behavior that even a senior engineer won't immediately infer.
