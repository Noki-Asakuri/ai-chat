# AGENTS.md

<!-- intent-skills:start -->

# Skill mappings - when working in these areas, load the linked skill file into context.

skills:

- task: "working on React Start app setup, document shell, or route generation"
  load: "/home/asakuri/code/ai-chat/apps/web/node_modules/@tanstack/react-start/skills/react-start/SKILL.md"
- task: "working on auth redirects and protected chat layouts"
  load: "/home/asakuri/code/ai-chat/node_modules/.bun/@tanstack+router-core@1.167.4/node_modules/@tanstack/router-core/skills/router-core/auth-and-guards/SKILL.md"
- task: "working on route loaders, preloading, or query-backed navigation"
  load: "/home/asakuri/code/ai-chat/node_modules/.bun/@tanstack+router-core@1.167.4/node_modules/@tanstack/router-core/skills/router-core/data-loading/SKILL.md"
- task: "working on TanStack Start server functions, cookies, or request handling"
  load: "/home/asakuri/code/ai-chat/node_modules/.bun/@tanstack+start-client-core@1.166.12/node_modules/@tanstack/start-client-core/skills/start-core/server-functions/SKILL.md"
- task: "working on Vite devtools setup in apps/web"
  load: "/home/asakuri/code/ai-chat/apps/web/node_modules/@tanstack/devtools-vite/skills/devtools-vite-plugin/SKILL.md"

<!-- intent-skills:end -->

## General

This part is for agents to know what is the most important thing to do.

- Follow the user's instructions exactly. If you are not sure or the user is ambiguous, ask for clarification, NEVER guess or make assumptions.
- Never use git unless the user explicitly asks. Focus on the task at hand, and leave the version control to the user.
- Always use Conventional Commits with scope when committing.
- If there is a change that are not from you, it could coming from other agent or the user. Do not modify or revert those changes, stop and ask for clarification if you are not sure about the change. Always assume good intent and communicate clearly with the user or other agents to resolve any conflicts or confusion.

### Docs lookup

Use up-to-date docs and avoid using your training data knowledge, which may be outdated. Always look up the latest docs for any library or framework you're working with. This is crucial for ensuring that your code is using the most current best practices and APIs, and for avoiding bugs that may arise from using deprecated or changed features.

### Shadcn UI

The current codebase uses shadcn UI. So when adding a new component, ensure to use the Shadcn UI MCP.
It allow you to look up the current components registry, list all the components, get their example usage, and etc.
Then after you can use the shadcn cli to add it to the codebase. `bunx shadcn add <component-name>`

Do not make any changes to the `components.json` file.

## Scripts

This repo uses Bun for install and run scripts. But only use scripts that you're allowed to run or asked to run.
Any other scripts are forbidden to run by the agent. Same as manually run with `bunx`.

These scripts are needed to be run everytime you finished the task.
This is not required if the task contain no file changes.

- `bun check`: Run lint, format and typecheck.

## TypeScript conventions

TypeScript are meant to be strict, predictable and type-safe.
It's forbidden to use `any` or casting `as`, instead use type narrowing.

If the type checking failing due to unrelated change not related to the task, ignore and do not fix it. Only fix the type checking if it's related to the task.
Avoid create a single line function wrapper or checker function that only used once, instead inline the logic and use type narrowing.

### React

This project have React Compiler enabled. So avoid manually adding memoization or optimization for React components, unless it's a clear performance bottleneck. Focus on following the rules of react and let the compiler handle the optimizations. Docs: https://react.dev/reference/rules

<!-- convex-ai-start -->

## Convex

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `packages/backend/convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `bunx convex ai-files install`.

<!-- convex-ai-end -->
