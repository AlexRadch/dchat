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

### Setup

Spec Kit is installed once per user, not via `package.json`. See `docs/setup-spec-kit.md`.

### Per-feature cycle

Follow the installed speckit skills step by step (constitution once, then specify → clarify → plan → checklist → tasks → analyze → implement → converge; short path for small changes skips clarify/checklist/analyze). One step at a time, human reviews before the next. Start with the next small change, never with "describe the whole system".
