# Tasks: Argument Readers — ScanResult Union

**Input**: `spec.md` Union FR (general-help / command-help / run), `plan.md` union design. Follow-up to closed round T001–T004 + T006–T007.

**Prerequisites**: plan.md union section, spec.md FR-003/005/007 + Key Entities union.

**Tests**: Union arms on fake defs; old short-circuit asserts replaced by arm asserts.

## Phase 3: ScanResult union (help remembered, not terminal)

- [x] T008 `src/args.ts`: `ScanResult = GeneralHelp | CommandHelp | Run` (three `interface`s + union); scan remembers help and continues; `-h` repeat exempt from too-many (no `counts` entry); entry point `chat.ts` switches on `kind`.
- [x] T009 `tests/scanArgv.test.ts`: general-help carries parsed globals (`--provider faux --help` → block + `options`); `-h fake` ≡ `fake -h` identical arm; help-vs-error either order (error wins; if clean, `command-help` carries parsed `options`+`text`); `run` arm carries `command?`/`options`/`text?`, never `help`.
- [x] T010 Verify: `npm test` + `npm run typecheck` green; live `--help`, `ask -h` (no commands: unknown-command path), empty `argv`.

## Phase 1: Types + globals + real loop

- [x] T001 `src/args.ts`: `Flag` (`{ name, alias }`), `Option` (`{ name, alias, repeatable }`), `Def` wrapper with `kind`, `Command` (`{ name, defs, help }`). Scan result `options: Record<string, boolean | string[]>`.
- [x] T002 `src/globalArgs.ts`: `GLOBAL_ARGS` — `--provider` / `-p`, `--key` / `-k`, `--model` / `-m` (all options, `repeatable: false`). Entry point passes it as the scan's globals; `--help` never listed (loop rule).
- [x] T003 Real `scanArgv` in `src/args.ts` per the 002 grammar: globals-only before command; flags/options/plains freely after; `=`/glued forms; `--`; help short-circuit; repeats; joined text; errors with help blocks + exit codes.
- [x] T004 `tests/scanArgv.test.ts` on fake defs (no real commands): flag with/without alias, `--no-` on/off, option with/without alias, `repeatable` accumulate vs too-many, `=`/glued/missing/empty/`-`-next, `-o=value` error, `--` text incl. `-x`, help before/after/after-`--`/`--help=x`/`--no-help`, unknown global vs unknown command-option vs unknown command, empty `argv`.
- [ ] T005 Verify: `npm test` + `npm run typecheck` green; live `dchat --help` → general help exit 0.

## Phase 2: Consistency

- [ ] T006 `grep` loop logic in `src/chat.ts`: zero option/command spellings outside the registration lists and verbatim help text.
- [ ] T007 Update `specs/README.md` (002 row: real scan + test file).
