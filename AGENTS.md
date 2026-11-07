# dchat — AGENTS.md

One-shot terminal chat for language models on Pi Durable. Run a command — get an answer — exit.

## Commands

- `npm test` — tests (`tsx --test tests/*.test.ts`)
- `npm run typecheck` — type checking (`tsc --noEmit`)
- `npm start` — run (`tsx src/chat.ts`)

Stack: TypeScript strict, ESM (`type: module`, NodeNext), Node 22+. Run `.ts` without compiling via `tsx`.

## How we build — spec-driven (Spec Kit)

This project is developed from specifications via GitHub Spec Kit (SDD).

- Specs are the source of truth. Code is fitted to the spec, never the reverse.
- Specs live in the repo: `.specify/` (templates, scripts, constitution) and `specs/<feature>/` (`spec.md`, `plan.md`, `tasks.md`). Delete the code — the spec stays, and the feature can be rebuilt from it via implement + converge.
- Keep the repo agent-neutral (integration `none`). Agent files never land in commits.

### What to install (once per user, not per project)

Spec Kit is not installed via `package.json` — it is installed next to the project, once per user. For install and upgrade instructions read the official docs:

- Install: https://github.github.com/spec-kit/installation.html
- First run: https://github.github.com/spec-kit/quickstart.html
- Adopting in an existing project: https://github.github.com/spec-kit/how-to/existing-projects.html
- Mixed-agent teams: https://github.github.com/spec-kit/integrations/index.html#working-in-a-team

`specify-cli` is a Python tool installed via `uv`, not an npm package, so it does not belong in `dependencies`. Each developer installs their own integration locally and switches back to `none` before committing, so no agent-specific files leak into the repo.

### Per-feature cycle

One step at a time, human reviews the result before the next:

1. `/speckit-constitution` — once per project, the rules (how to code, how to test, what is forbidden).
2. `/speckit-specify` — what we build and why, no tech stack.
3. `/speckit-clarify` — questions on vague spots, tighten the spec.
4. `/speckit-plan` — how we build it, the plan.
5. `/speckit-checklist` — is the spec complete and clear?
6. `/speckit-tasks` — ordered tasks.
7. `/speckit-analyze` — spec, plan and tasks agree with each other (read-only, fix at the source).
8. `/speckit-implement` — code by tasks.
9. `/speckit-converge` — verify code against the spec until it reports Converged.

For small changes — the short path: specify → plan → tasks → implement → converge.

Start with the next small change, never with "describe the whole system".
