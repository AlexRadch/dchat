# Tasks: Argument Readers — Single Loop, Types, Parked Ask

**Input**: Design documents from `/specs/002-argument-readers/` (`spec.md`, `plan.md`) + `/specs/006-global-help/spec.md`

**Prerequisites**: plan.md (required), spec.md (required), 006 spec (required for T003)

**Tests**: Constitution III — `tests/cliArgs.test.ts` covers the single scan; `npm test` + `npm run typecheck` green before review. Reader files 003/004/005 stay on disk but unregistered (their own describes keep passing untouched).

## Phase 1: Loop + types + help, ask parked

- [ ] T001 Add `src/args.ts`: `Option` (`{ name, alias, arity, min, max }`), `Command` (`{ name, options, help, run }`). Empty registrations: `GLOBAL_OPTIONS = []` (help per 006 is inline, not listed), `COMMANDS = []` (ask parked).
- [ ] T002 Park ask in `src/chat.ts`: comment out the ask routing block, the provider/key/model registration + loop, and the ask execution path under one `PARKED (ask — re-enable with the ask command spec)` marker. Do NOT delete. Bare `dchat` keeps today's general-help exit 2; any command word now falls into unknown-command (exit 1) until its spec lands.
- [ ] T003 Implement 006 inline in `src/chat.ts`: `--help`/`-h` at any scan position prints general help (no command yet) or the command's verbatim `help` block and exits 0 without calling any handler; `--help=<v>` is an error (exit 2).
- [ ] T004 Rewrite the loop describes in `tests/cliArgs.test.ts` for the single scan: global-then-command activation; options in any order around the one text token; min/max bounds (accumulate in order, too-many/missing-required errors — never last-wins); unknown `-x` named; second text token fails naming it with a quote hint; `--` passes text through; values collected as `string[]` (`[]` for arity 0); help short-circuit in both positions.
- [ ] T005 Verify: `npm test` + `npm run typecheck` green; live `dchat --help` → general help exit 0; `dchat ask "Hi"` → unknown-command exit 1 (parked, expected); `dchat --help=x` → error exit 2.

## Phase 2: Consistency

- [ ] T006 `grep` loop logic in `src/chat.ts`: zero option/command spellings outside the registration lists and verbatim help text.
- [ ] T007 Update `specs/README.md` (002 row rewritten, 006 row added).
