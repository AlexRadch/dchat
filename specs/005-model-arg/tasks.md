# Tasks: Model Option Definition

**Input**: Design documents from `/specs/005-model-arg/` (`spec.md`, `plan.md`)

**Prerequisites**: plan.md (required), spec.md (required)

**Tests**: Constitution III — single-scan loop describes in `tests/cliArgs.test.ts` (002) cover this definition: long/short/`=` collection, missing-value errors, too-many error. `npm test` + `npm run typecheck` green before review.

## Phase 1: `model` option definition

- [ ] T001 Replace `src/modelArg.ts` with the `modelOption` definition + `modelHelp` from plan.md (no reader function).
- [ ] T002 Verify: `npm test` + `npm run typecheck` green; no other file touched.
