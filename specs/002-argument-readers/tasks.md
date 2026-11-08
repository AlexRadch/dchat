# Tasks: Argument Readers — Grammar Contract, Types, Real Scan

**Input**: Design documents from `/specs/002-argument-readers/` (`spec.md`, `plan.md`) + `/specs/008-global-args/spec.md`

**Prerequisites**: plan.md (required), spec.md (required), 008 spec (required for T002)

**Tests**: Constitution III — `tests/scanArgv.test.ts` drives the real loop on fake defs; `npm test` + `npm run typecheck` green before review.

## Phase 1: Types + globals + real loop

- [x] T001 `src/args.ts`: `Flag` (`{ name, alias }`), `Option` (`{ name, alias, repeatable }`), `Def` wrapper with `kind`, `Command` (`{ name, defs, help }`). Scan result `options: Record<string, boolean | string[]>`.
- [x] T002 `src/globalArgs.ts`: `GLOBAL_ARGS` — `--provider` / `-p`, `--key` / `-k`, `--model` / `-m` (all options, `repeatable: false`). Entry point passes it as the scan's globals; `--help` never listed (loop rule).
- [x] T003 Real `scanArgv` in `src/args.ts` per the 002 grammar: globals-only before command; flags/options/plains freely after; `=`/glued forms; `--`; help short-circuit; repeats; joined text; errors with help blocks + exit codes.
- [x] T004 `tests/scanArgv.test.ts` on fake defs (no real commands): flag with/without alias, `--no-` on/off, option with/without alias, `repeatable` accumulate vs too-many, `=`/glued/missing/empty/`-`-next, `-o=value` error, `--` text incl. `-x`, help before/after/after-`--`/`--help=x`/`--no-help`, unknown global vs unknown command-option vs unknown command, empty `argv`.
- [ ] T005 Verify: `npm test` + `npm run typecheck` green; live `dchat --help` → general help exit 0.

## Phase 2: Consistency

- [ ] T006 `grep` loop logic in `src/chat.ts`: zero option/command spellings outside the registration lists and verbatim help text.
- [ ] T007 Update `specs/README.md` (002 row: real scan + test file).
