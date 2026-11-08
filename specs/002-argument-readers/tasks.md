# Tasks: Argument Readers — Grammar Contract, Types, Stub Scan

**Input**: Design documents from `/specs/002-argument-readers/` (`spec.md`, `plan.md`) + `/specs/008-global-args/spec.md`

**Prerequisites**: plan.md (required), spec.md (required), 008 spec (required for T002)

**Tests**: Constitution III — full scan loop arrives with the ask-command spec; `tests/cliArgs.test.ts` removed with the stub. `npm test` + `npm run typecheck` green before review.

## Phase 1: Types + globals + stub, ask parked

- [x] T001 `src/args.ts`: `Flag` (`{ name, alias }`), `Option` (`{ name, alias, repeatable }`), `Def` wrapper with `kind`, `Command` (`{ name, defs, help }`). Scan result `options: Record<string, boolean | string[]>`.
- [x] T002 `src/globalArgs.ts`: `GLOBAL_ARGS` — `--provider` / `-p`, `--key` / `-k`, `--model` / `-m` (all options, `repeatable: false`). Entry point passes it as the scan's globals; `--help` never listed (loop rule).
- [ ] T003 Full scan loop arrives with the ask-command spec (grammar → code). Until then `scanArgv` stays a stub returning general help.
- [ ] T004 Verify: `npm test` + `npm run typecheck` green; live `dchat --help` → general help exit 0; `dchat ask "Hi"` → general help exit 2 (no commands registered yet).

## Phase 2: Consistency

- [ ] T005 `grep` loop logic in `src/chat.ts`: zero option/command spellings outside the registration lists and verbatim help text.
- [ ] T006 Update `specs/README.md` (002 row rewritten, 008 row added).
