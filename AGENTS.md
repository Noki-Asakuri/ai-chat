# AGENTS.md

<!-- intent-skills:start -->

## Skill Loading

Before editing files for a substantial task:

- Run `bunx @tanstack/intent@latest list` from the workspace root to see available local skills.
- If a listed skill matches the task, run `bunx @tanstack/intent@latest load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.

<!-- intent-skills:end -->

## General

This part is for agents to know what is the most important thing to do.

- Follow the user's instructions exactly. If you are not sure or the user is ambiguous, ask for clarification, NEVER guess or make assumptions.
- If there is a change that are not from you, it could coming from other agent or the user. Do not modify or revert those changes, stop and ask for clarification if you are not sure about the change. Always assume good intent and communicate clearly with the user to resolve any conflicts or confusion.

### Docs lookup

Use up-to-date docs and avoid using your training data knowledge, which may be outdated. Always look up the latest docs for any library or framework you're working with.
This is crucial for ensuring that your code is using the most current best practices and APIs, and for avoiding bugs that may arise from using deprecated or changed features.

### Shadcn UI

The current codebase uses shadcn UI. So when adding a new component, ensure to use the Shadcn UI MCP.
It allow you to look up the current components registry, list all the components, get their example usage, and etc. Then after you can use the shadcn cli to add it to the codebase. `bunx shadcn add <component-name>`

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
