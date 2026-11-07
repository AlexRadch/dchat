# Tasks: Argument Readers — Argument-Processing Loop

**Input**: Design documents from `/specs/002-argument-readers/` (`spec.md`, `plan.md`)

**Prerequisites**: plan.md (required), spec.md (required)

**Tests**: Constitution III requires covering tests for the argument-processing loop in `tests/cliArgs.test.ts`; `npm test` and `npm run typecheck` green before review. Per-reader describes are owned by 003/004/005 — this task list only covers the loop.

## Phase 1: Argument-processing loop in `src/chat.ts`

- [ ] T001 Rewrite the parsing section of `src/chat.ts` as the argument-processing loop from plan.md (passes over the three readers, shrink-to-continue, stop-on-stall, inline remainder check). Keep help short-circuit, defaults, harness flow. Add the detach comment above the loop.
- [ ] T002 "Argument-processing loop" describes in `tests/cliArgs.test.ts`: pass order threads the remainder (each reader gets the previous rest); a full pass with no consumption stops the loop; empty remainder stops; repetition across passes is last-wins; unknown `-x` leftover is named by the inline rule; pure positional text is untouched. (Per-reader lazy behavior is tested in 003/004/005, not here — stub the readers if needed to isolate the loop.)
- [ ] T003 Verify: `npm test` + `npm run typecheck` green; live `dchat ask --provider faux "Hi"` → `echo: Hi` exit 0; `--porvider` → `Unknown option` exit 2; bare `--provider` → `Missing value` exit 2; `dchat ask --help` unchanged.

## Phase 2: Consistency

- [ ] T004 `grep` option spellings in parsing logic of `src/chat.ts` — zero hits (fixed header/examples/comments may still name them as text, per plan).
- [ ] T005 Update `specs/README.md` if the loop surface changed (registration = call blocks, detach = delete block).
