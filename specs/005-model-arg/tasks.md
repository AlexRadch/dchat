# Tasks: Model Argument Reader

**Input**: Design documents from `/specs/005-model-arg/` (`spec.md`, `plan.md`)

**Prerequisites**: plan.md (required), spec.md (required)

**Tests**: Constitution III — per-reader describes in `tests/cliArgs.test.ts` first (must FAIL on the current greedy code where lazy differs), then rewrite. `npm test` + `npm run typecheck` green before review.

## Phase 1: Lazy `model` reader

- [ ] T001 Rewrite the "model reader" describe in `tests/cliArgs.test.ts` for the lazy strategy (spec 005 FR-002): leading `--model v` / `-m v` / `--model=v` consume one occurrence and return the tail; any other leading token returns the input unchanged with `model: undefined`; missing-value cases throw `Missing value for --model`.
- [ ] T002 Rewrite `src/modelArg.ts` as the lazy first-token reader from plan.md (help lines unchanged). T001 goes green.
- [ ] T003 Verify: `npm test` + `npm run typecheck` green; no other file touched.
