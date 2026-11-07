# Tasks: Key Argument Reader

**Input**: Design documents from `/specs/004-key-arg/` (`spec.md`, `plan.md`)

**Prerequisites**: plan.md (required), spec.md (required)

**Tests**: Constitution III — per-reader describes in `tests/cliArgs.test.ts` first (must FAIL on the current greedy code where lazy differs), then rewrite. `npm test` + `npm run typecheck` green before review.

## Phase 1: Lazy `key` reader

- [ ] T001 Rewrite the "key reader" describe in `tests/cliArgs.test.ts` for the lazy strategy (spec 004 FR-002): leading `--key v` / `-k v` / `--key=v` consume one occurrence and return the tail; any other leading token returns the input unchanged with `key: undefined`; missing-value cases throw `Missing value for --key`.
- [ ] T002 Rewrite `src/keyArg.ts` as the lazy first-token reader from plan.md (help lines unchanged). T001 goes green.
- [ ] T003 Verify: `npm test` + `npm run typecheck` green; no other file touched.
