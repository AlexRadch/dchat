# dchat Constitution

## Core Principles

### I. English-Only Repository (NON-NEGOTIABLE)

Repository language is English: code, comments, docs, specs, tests, commit messages.
A developer may talk to the agent in any language; the agent MUST write all repo
artifacts in English by default, without asking. Exception: dedicated i18n tests
may use other languages for the strings under test. User-facing strings default
to English; other locales arrive only via i18n, never as hardcoded non-English text.

### II. Spec-Driven (NON-NEGOTIABLE)

Specs are the source of truth. Code is fitted to the spec, never the reverse.
Every feature starts from `.specify/memory/constitution.md` compliance, then
`spec.md` (what and why, no tech stack), `plan.md` (how), `tasks.md` (ordered steps).
Implementation MUST NOT begin with failing clarify/checklist/analyze gates unresolved.
Code deleted can be rebuilt from specs via implement + converge until Converged.

### III. Test-First

Tests are written before or alongside implementation and MUST pass before review:
`npm test` (tsx --test) and `npm run typecheck` (tsc --noEmit) are both green.
New behavior without a covering test is incomplete. Failing tests are never
removed or weakened to make the suite pass without explicit human approval.

### IV. Simplicity and CLI Contract

Prefer the smallest change that fully solves the task (YAGNI). The CLI is
one-shot: ask → print answer → exit. Human-readable stdout for answers, stderr
for errors, non-zero exit codes on failure (`2` usage error, `1` unanswered).
No new dependencies, config files, or processes without a spec justifying them.

### V. Secrets Safety (NON-NEGOTIABLE)

Never commit, log, or print API keys or tokens. Key resolution goes only through
`src/keys.ts` (`resolveKey`): explicit `--key` spec, else `{PROVIDER}_API_KEY`
from env, `./.env`, `~/.env`, OS keychain. Tests MUST use injected fakes, never
real env, disk, or keychain.

## Technology Constraints

Stack: TypeScript strict, ESM (`type: module`, NodeNext), Node 22+. Run `.ts`
without compiling via `tsx`. Core runtime is `@earendil-works/pi-durable`
(Harness.open + root + submit + wait). Keep `package.json` minimal: only what the
program needs to run; `specify-cli` (Python via `uv`) is per-user tooling and
MUST NOT appear in `dependencies`.

## Development Workflow

One step at a time; the human reviews each Spec Kit step before the next
(constitution once, then specify → clarify → plan → checklist → tasks →
analyze → implement → converge; short path for small changes skips
clarify/checklist/analyze). Start with the next small change, never with
"describe the whole system". Keep the repo agent-neutral (integration `none`);
agent files never land in commits. Commits follow Conventional Commits
(`feat`/`fix`/`docs`/`refactor`/`test`/`chore`).

## Governance

This constitution supersedes all other practices. Amendments require a documented
proposal, human approval, and a version bump. All specs, plans, and reviews MUST
verify constitution compliance; complexity MUST be justified. Use `AGENTS.md`
for always-loaded agent guidance and `docs/setup-spec-kit.md` for per-user setup.

**Version**: 1.0.0 | **Ratified**: 2026-11-07 | **Last Amended**: 2026-11-07
