# dchat — AGENTS.md

One-shot terminal chat for language models on Pi Durable. Run a command — get an answer — exit.

## Personal rules (mandatory)

If `AGENTS.local.md` exists next to this file, read it right after this file on every turn. A precise rule there supersedes only the rule it names; everything else here stays in force.

## Language

Repository language is English: code, comments, docs, specs, tests, commit messages.
A developer may talk to the agent in any language; the agent must write all repo artifacts in English by default, without asking. Exception: dedicated i18n tests may use other languages for the strings under test. User-facing strings default to English; other locales arrive only via i18n, never as hardcoded non-English text.

## Commands

- `npm test` — tests (`tsx --test tests/*.test.ts`)
- `npm run typecheck` — type checking (`tsc --noEmit`)
- `npm start` — run (`tsx src/chat.ts`)

Stack: TypeScript strict, ESM (`type: module`, NodeNext), Node 22+. Run `.ts` without compiling via `tsx`.

## How we build — spec-driven (Spec Kit)

This project is developed from specifications via GitHub Spec Kit (SDD). To set up, see `docs/setup-spec-kit.md`.

- Specs are the source of truth. Code is fitted to the spec, never the reverse.
- No code changes without a spec: new behavior or a behavior change starts from `spec.md`, then `plan.md` + `tasks.md`, then code. Exception: typo or an obvious bug where the specified behavior already covers the fix — fix directly, no spec update. If the fix changes behavior, update the spec first.
- Specs live in the repo: `.specify/` (templates, scripts, constitution) and `specs/<feature>/` (`spec.md`, `plan.md`, `tasks.md`). Delete the code — the spec stays, and the feature can be rebuilt from it via implement + converge.
- Spec registry: `specs/README.md` groups every spec by area (providers, arguments, ...). Read it first to find which spec covers what; add a row for every new spec.
- ADR registry: `docs/adr/README.md` indexes every architecture decision. Read both registries always; read a single spec or ADR only when its row says it covers your task.
- Keep the repo agent-neutral (integration `none`). Agent files never land in commits.

### Per-feature cycle

Follow the installed speckit skills step by step (constitution once, then specify → clarify → plan → checklist → tasks → analyze → implement → converge; short path for small changes skips clarify/checklist/analyze). One step at a time, human reviews before the next. Start with the next small change, never with "describe the whole system".
