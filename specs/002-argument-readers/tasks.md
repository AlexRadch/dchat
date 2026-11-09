# Tasks: Argument Readers — ScanResult Union

**Input**: `spec.md` Union FR (general-help / command-help / run), `plan.md` union design. Follow-up to closed round T001–T004 + T006–T007.

**Prerequisites**: plan.md union section, spec.md FR-003/005/007 + Key Entities union.

**Tests**: Union arms on fake defs; old short-circuit asserts replaced by arm asserts.

## Phase 9: argValues rename

- [x] T029 `src/args.ts`: one named map type `ArgValues = Record<string, boolean | string[]>` declared once; every `options: Record<...>` field renamed to `argValues: ArgValues` (all four fact arms + `RunCommand.run` + scan locals); `chat.ts` + `tests/scanArgv.test.ts` updated to the new field.
- [x] T030 Verify: `npm test` + `npm run typecheck` green.

## Phase 8: no-command arm (missing word is a normal outcome)

- [x] T025 `src/args.ts`: fifth arm `no-command` (`{ kind; result: { argValues; params } }` — facts only, NO message or exit code); `!command` returns it instead of `parse-error`; `NoCommandPayload` added to `ScanResult`.
- [x] T026 `src/chat.ts`: `no-command` case (facts present → `No command.` + general block stderr exit 2; facts empty → general block stdout exit 0); pre-scan empty-`argv` shortcut removed — empty input scans to `no-command`.
- [x] T027 `tests/scanArgv.test.ts`: `describe("scan: no-command")` — facts carried, no exitCode, empty-argv → empty facts; `run` never appears without a word.
- [x] T028 Verify: `npm test` + `npm run typecheck` green.

## Phase 7: command arity

- [x] T021 `src/args.ts`: `Command` gains `{ minParams; maxParams }` + `MAX_PARAMS = 1024` (unbounded marker: `max >= MAX_PARAMS` skips the upper check, no `Infinity`); `assertArityShape` throws on bad shape (programmer bug); scan returns `Too few/many params for <name>` (exit 2) on the `run` path; `command-help` skips the check.
- [x] T022 `tests/scanArgv.test.ts`: `describe("scan: arity")` — inside/below/above bounds, unbounded with 2000 chunks, min-0 empty ok, help skips check, bad shape throws.
- [x] T023 Verify: `npm test` + `npm run typecheck` green.
- [x] T024 `src/askArgs.ts` + spec 009: `ask` arity `{ minParams: 1, maxParams: MAX_PARAMS }`.

## Phase 6: params instead of joined text

- [x] T018 `src/args.ts`: `text?: string` → `params: string[]` (always an array, possibly empty) in `RunPayload`/`CommandHelpPayload`; scan hands over raw chunks, no `join`. `RunCommand.run` takes `params: string[]`; `commandHelp`/help logic untouched.
- [x] T019 `tests/scanArgv.test.ts`: chunk asserts (`["hello", "world"]`, `[]` when none); joining covered by command specs, not here.
- [x] T020 Verify: `npm test` + `npm run typecheck` green.

## Phase 5: abstract scan (no help text, no execution in args.ts)

- [x] T014 `src/args.ts`: `Command` loses `help`; `RunCommand` moved to the entry point; help payloads lose `help`; `scanArgv` loses the `generalHelp` parameter. Spec Scope section states the scan is exhaustive and lists what MUST NOT be pulled in.
- [x] T015 `src/chat.ts` (undocumented for now, specs land with the ask spec): `RunCommand` with `help` + `run`, `GENERAL_HELP`, `commandHelp()` restoring blocks; `askArgs.ts` imports `RunCommand` from the entry point.
- [x] T016 `tests/scanArgv.test.ts`: no help constants, no `help:` in fake commands, no help-text asserts — facts only (names/defs/options/text/message/exitCode/command?).
- [x] T017 Verify: `npm test` + `npm run typecheck` green; live `--bogus`/`--help` paths unchanged in behavior.

## Phase 4: parse-error arm (ADR-004, no helpBlock in scan)

- [x] T011 `src/args.ts`: fourth arm `parse-error` (`{ kind; result: { message; exitCode; command? } }`); scan returns it instead of `throw ParseError`; `chat.ts` becomes one `switch` (helps → stdout 0, `run` → dispatch, `parse-error` → restore block + stderr); `ParseError` class removed (registration `Duplicate spelling` stays a plain `Error` — programmer bug, truly exceptional).
- [x] T012 `tests/scanArgv.test.ts`: `expectParseError` helper deleted; every error case asserts the returned arm directly (`kind`, `message`, `exitCode`, `command?`) instead of catching a closure.
- [x] T013 Verify: `npm test` + `npm run typecheck` green; live error paths (`--bogus`, `ask --bogus` with commands, `--help=x`) print `message + block` on stderr with exit 1/2.

## Phase 3: ScanResult union (help remembered, not terminal)

- [x] T008 `src/args.ts`: `ScanResult = GeneralHelp | CommandHelp | Run` (three `interface`s + union); scan remembers help and continues; `-h` repeat exempt from too-many (no `counts` entry); entry point `chat.ts` switches on `kind`.
- [x] T009 `tests/scanArgv.test.ts`: general-help carries parsed globals (`--provider faux --help` → `argValues`); `-h fake` ≡ `fake -h` identical arm; help-vs-error either order (error wins; if clean, `command-help` carries parsed `argValues`+`params`); `run` arm carries required `command` + `argValues`/`params`, never `help`.
- [x] T010 Verify: `npm test` + `npm run typecheck` green; live `--help`, `ask -h` (no commands: unknown-command path), empty `argv`.

## Phase 1: Types + globals + real loop

- [x] T001 `src/args.ts`: `Flag` (`{ name, alias }`), `Option` (`{ name, alias, repeatable }`), `ArgDef` wrapper with `kind`, `Command` (`{ name, defs, help }`). Scan result `argValues: ArgValues`.
- [x] T002 `src/globalArgs.ts`: `GLOBAL_ARGS` — `--provider` / `-p`, `--key` / `-k`, `--model` / `-m` (all options, `repeatable: false`). Entry point passes it as the scan's globals; `--help` never listed (loop rule).
- [x] T003 Real `scanArgv` in `src/args.ts` per the 002 grammar: globals-only before command; flags/options/plains freely after; `=`/glued forms; `--`; help short-circuit; repeats; joined text; errors with help blocks + exit codes.
- [x] T004 `tests/scanArgv.test.ts` on fake defs (no real commands): flag with/without alias, `--no-` on/off, option with/without alias, `repeatable` accumulate vs too-many, `=`/glued/missing/empty/`-`-next, `-o=value` error, `--` text incl. `-x`, help before/after/after-`--`/`--help=x`/`--no-help`, unknown global vs unknown command-option vs unknown command, empty `argv`.
- [ ] T005 Verify: `npm test` + `npm run typecheck` green; live `dchat --help` → general help exit 0.

## Phase 2: Consistency

- [ ] T006 `grep` loop logic in `src/chat.ts`: zero option/command spellings outside the registration lists and verbatim help text.
- [ ] T007 Update `specs/README.md` (002 row: real scan + test file).
