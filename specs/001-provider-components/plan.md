# Implementation Plan: Provider Components

**Branch**: `001-provider-components` | **Date**: 2026-11-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-provider-components/spec.md`

## Summary

Split provider assembly out of `src/chat.ts` into two files: `src/standardProviders.ts` (returns the models object with standard providers; owns their imports) and `src/fauxProvider.ts` (attaches the faux echo provider to a given models object; owns its import). The entry point only calls both. Behavior, flags, help, exit codes unchanged.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript strict, ESM (`type: module`, NodeNext), Node 22+; run via `tsx`

**Primary Dependencies**: `@earendil-works/pi-durable` (Harness.open + root + submit + wait), `@earendil-works/pi-ai` (`builtinModels`, `fauxProvider`), `keytar` (unchanged)

**Storage**: N/A (MemoryStorage, unchanged)

**Testing**: `tsx --test tests/*.test.ts`, `tsc --noEmit`

**Target Platform**: CLI, one-shot (ask → print answer → exit)

**Project Type**: cli

**Performance Goals**: N/A (no perf change; same startup path, two extra function calls)

**Constraints**: ADR-002 — no IoC container; composition via function arguments in entry point. Exit codes stay 0/1/2.

**Scale/Scope**: 2 new files, entry point minus provider imports, no new deps, no config files.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- I. English-Only: all new code, comments, tests in English. PASS.
- II. Spec-Driven: spec `001-provider-components` approved and committed; plan + tasks before code. PASS.
- III. Test-First: `npm test` + `npm run typecheck` green before review; existing tests must pass unchanged; new unit tests for the two components. PASS.
- IV. Simplicity/CLI: smallest split, no new deps/config/processes; stdout/stderr/exit contract unchanged. PASS.
- V. Secrets: no key handling changes; no keys in code/logs. PASS.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── chat.ts               # entry point: calls standardProviders() + addFauxProvider(), no provider imports
├── standardProviders.ts  # NEW: builds models with standard providers (owns builtinModels import)
├── fauxProvider.ts       # NEW: attaches faux echo provider, selects default model, prepares echo answer (owns faux imports; no re-exports)
└── keys.ts               # unchanged

tests/
├── keys.test.ts          # unchanged
└── providers.test.ts     # NEW: component assembly (standard set present, faux attachable/detachable)
```

**Structure Decision**: Single-project CLI layout, unchanged. Two new modules beside `chat.ts`/`keys.ts`; one new test file beside existing tests.

## Complexity Tracking

> No constitution violations. No entries.
