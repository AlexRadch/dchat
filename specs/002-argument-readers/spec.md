# Feature Specification: Argument Readers with Two-Phase Dispatch

**Feature Branch**: `002-argument-readers`

**Created**: 2026-11-07

**Status**: Rewritten 2026-11-08 — grammar is the contract; prose only covers what EBNF cannot (repetition errors, exit codes). Rewritten 2026-11-09 — help is a plain general entry (`helpFlag`), not a loop rule; no `general-help`/`command-help` arms.

**Input**: User description: "Parse the command line in small detachable pieces. Each piece reads its own options and returns the unread remainder. After all pieces run, anything unread that looks like an option is an error. Removing a piece removes its options from the accepted set."

## Grammar (EBNF sketch, ISO 14977)

```ebnf
argv    = { general }, [ command, { own-or-global | plain }, [ "--", { any-plain } ] ] ;
  (* no command word is a NORMAL outcome (Story 4), not an error:
     generals/plains still scan, the scan returns no-command with the facts,
     the entry point decides the meaning *)
  (* before the word only generals are visible; after the word the command's
     own defs are tried first, then generals with global: true — never the rest;
     a flag that skips the arity check is still a plain flag in the grammar,
     the skip is prose-only (FR-005d) *)
  (* after the command, plains and flags/options mix freely in any order;
     option takes its following plain as its value before it counts as a param;
     plains before and after "--" collect in order as raw param chunks —
     the scan never joins them, joining is the command's job *)

command = ? one plain token, not starting with "-" ? ;

general     = ? any general entry: flag or option, global or not ? ;

own-or-global = ? command's own entry, else a general entry with global: true ? ;

skip-flag = ? a flag whose entry carries skipArity: true ? ;

flag    = "--flag" | "--no-flag" | "-f" ;

option  = ("--option", plain ) | ("-o", plain ) | long-glued | short-glued ;

long-glued = ? "--option=" immediately followed by any-plain ? ;

short-glued = ? "-o" immediately followed by any-plain ? ;

plain   = ? one plain token, not starting with "-" ? ;

any-plain = ? one plain token ? ;
```

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Standard command line parses (Priority: P1)

A user runs `dchat ask --provider faux "Hi there"` or any free-order mix (`dchat ask "Hi" --provider faux`). Options take their single value first; leftover plains become the `params` chunks. All flag states and option values land in one map — `argValues`.

**Acceptance Scenarios**:

1. **Given** command `ask` referencing `providerOption`, **When** the user runs `dchat ask --provider faux "Hi"`, **Then** `argValues` holds the value and params is `["Hi"]`.
2. **Given** the same ownership, **When** the user runs `dchat ask "Hi" --provider faux`, **Then** the result is identical.

---

### User Story 2 - Repetition is rejected unless allowed (Priority: P1)

A user repeats a flag or a single-shot option and gets a loud error. A repeatable option accumulates.

**Acceptance Scenarios**:

1. **Given** flag `-f` already seen, **When** `-f` (or its `--flag` form) appears again, **Then** the parse fails as too-many.
2. **Given** option `--provider` (`repeatable: false`) already seen, **When** it appears again, **Then** the parse fails as too-many.
3. **Given** option `--tag` (`repeatable: true`) seen twice, **When** the scan finishes, **Then** both values are kept in order.

---

### User Story 3 - Help is an ordinary global flag (Priority: P1)

`--help` / `-h` is a plain flag entry (`helpFlag`, `global: true`, `skipArity: true`) — no loop rule, no hard-coded spelling in the scan. It scans like any flag: repeats fail, `=` fails, after `--` it is text, an error anywhere beats it (the scan returns `parse-error` before any flag meaning is read). The entry point gives it meaning: a set help flag means print the block (command's block if a word resolved, else general) to stdout, exit 0, handler never called.

**Acceptance Scenarios**:

1. **Given** no command word on the line, **When** `--help` appears, **Then** a `no-command` is returned with the flag set in `argValues`; entry point prints the general block to stdout, exit 0.
2. **Given** command `ask` already seen, **When** `--help` appears, **Then** a `run` for `ask` is returned with the flag set (arity skipped via `skipArity`); entry point prints its block to stdout, exit 0.
3. **Given** `-h ask` or `ask -h`, **When** scanned, **Then** both return the identical `run`/`no-command` for `ask` with the flag set — the flag does not stop the scan, the word still resolves.
4. **Given** `--help=x` or `--no-help`, **When** scanned, **Then** it fails as a flag error (unexpected value / unknown option) — like any flag, exit 2.
5. **Given** `--help` plus an erroneous token in either order, **When** scanned, **Then** a `parse-error` is returned (the error wins) — the flag never saves a bad line.
6. **Given** `--help` twice on one line, **When** scanned, **Then** it fails as `Too many occurrences` — a repeated single-shot flag like any other; multi-use needs an explicit opt-in on the entry.

---

### User Story 4 - No command word is a normal outcome, not a failure (Priority: P1)

A bare line (`dchat`, `dchat --provider faux`) scans fine: the scan reports facts (`argValues` map + `params` chunks) in a fifth arm `no-command` — no message, no exit code, nothing to fail. Meaning belongs to the entry point: facts present → misplaced content, error `No command.` + general block on stderr, exit 2; facts empty → plain general help on stdout, exit 0.

**Acceptance Scenarios**:

1. **Given** no command word and parsed facts present, **When** the scan finishes, **Then** a `no-command` arm is returned (facts `argValues` + `params`, no `exitCode`); the entry point prints `No command.` + general block on stderr, exit 2.
2. **Given** empty `argv` (no word, no facts), **When** scanned, **Then** a `no-command` with empty facts is returned; the entry point prints general help on stdout, exit 0 (the old pre-scan empty-`argv` shortcut is gone).
3. **Given** a valid command word, **When** scanned, **Then** the result is `run` (arity checked) — `no-command` never appears alongside a word.

---

### Edge Cases

- Detaching a definition (removing it from the command's `defs`) removes its spellings: former spellings fail as unknown-option.
- `dchat --help ask` and `dchat ask --help` return the same `run` for `ask` with the help flag set: no arm stops the scan, the word still resolves, an error still beats the flag.
- A general spelling before the word is checked against the general entry; once the word resolves, every collected token is re-checked against the command's rule for it (own entry, else the `global: true` general). Same object referenced twice is one rule; two different objects with one spelling is two rules — the scan acts dumb, never compares.

## Scope — what this spec does NOT cover

This spec is exhaustive for the scan and nothing else. The scan resolves
names, defs, argValues and text — that is all. The following live above the
scan (entry point, command modules, follow-up specs) and MUST NOT be pulled
in here:

- Help texts (`generalHelp`, per-command blocks): the scan returns the
  resolved word (`command?`), the entry point restores and prints the block.
  The scan never decides WHAT help means — a set help flag is just a flag.
- Exit codes: `parse-error` carries one (the scan kept failing); `no-command`
  carries none — no word is a normal outcome, the entry point owns the meaning.
- Execution (`run`, handler dispatch, `RunCommand`): the scan returns the
  `run` arm with finished data; what happens next is not its concern.
- Value interpretation (numbers, enums, key-spec forms, defaults): handlers
  own it (FR-006).
- Key resolution, provider catalogs, harness flow: later specs.

A change that adds any of the above to `args.ts` is out of scope and
rejected — extend the layers above, not the scan.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The entry point runs one left-to-right scan over `argv`. It is fed the general args (spec 008) plus the command table (`Command[]` — word + defs only, no help text, no execution); there is no other shared state. No parsing lives in handlers. Before any command word ONLY generals are accepted — their shape is known upfront, so `-f` before a command is decided by the generals table alone, never guessed. A command-owned spelling before its command word fails immediately (unknown or misplaced), it is never buffered for later. After the word the scan tries the command's own `defs` first, then generals with `global: true` — other generals are invisible there. Once the word resolves, every token collected before it is re-checked against the command's rule for it (own entry if present, else the `global: true` general): same referenced object is one rule, two different objects is two rules — the scan acts dumb, never compares shapes, never validates the configuration.
- **FR-002**: Each definition owns its spellings: one long form plus exactly one short alias (`--option` / `-o`). Commands have no aliases. Within one list (generals alone, or one command's `own + visible globals`) no two defs may claim the same spelling — except the same referenced object counted twice (a general referenced by the command is one rule, not a duplicate).
- **FR-003**: A `Flag` takes zero values. Any `=` on a flag (`--flag=x`, `-f=x`) is an error. A `Flag` MUST NOT repeat: the second occurrence fails as too-many. `--no-<name>` is a separate spelled flag that turns the feature off; short flags have no negated form.
- **FR-004**: An `Option` takes exactly one value, written either apart (`--option value`, `-o value`) or glued (`--option=value`, `-ovalue` in one argv element). A missing value (end of input, next token starts with `-`, empty `=` suffix) fails as missing-value. `-o=value` is NOT a glued form — it is an error. A set flag (any flag, help included) never fills an option's value slot.
- **FR-005**: An `Option` declares `repeatable: boolean`. A second occurrence with `repeatable: false` fails as too-many. With `repeatable: true` values accumulate in order.
- **FR-005b**: A command-owned spelling appearing BEFORE its command word fails immediately — it is never buffered and never re-checked later. The only tokens valid before a command word are generals (spec 008). So `dchat --provider faux ask` fails at `--provider` even if `ask` references it — command defs activate only after their word.
- **FR-005c**: Each command declares param arity: `{ minParams: number; maxParams: number }` — both required, integers, `0 <= min <= max`. `maxParams >= MAX_PARAMS` (1024) means unbounded (no upper check); no `Infinity` — the bound fits a plain integer in every language. The scan checks arity on the `run` path only (`command-help` is gone — see Story 3): fewer than `min` → `Too few params for <name>`, more than `max` (when bounded) → `Too many params for <name>`, both exit 2 with the resolved word. A bad shape (negative, non-integer, `min > max`) is a programmer bug and throws.
- **FR-005d**: A flag entry may carry `skipArity: true` — when any collected flag with this marker is set, the scan skips the arity check on the `run` path (the `run` still carries the real `params`). The marker is generic (any flag may carry it; `helpFlag` does); the scan never names help. `command-help` (which used to skip arity) no longer exists.
- **FR-006**: The scan hands each command's handler finished data only: flag states, option values (raw strings, exactly as typed), and the ordered `params` chunks. The command joins chunks as it needs (`ask` joins with one space); the handler converts types and reports its own type errors; the loop never interprets values.
- **FR-007**: No hard-coded spellings in the scan. `--help`, `-h`, `--no-help`, `--help=x` are ordinary tokens resolved through the visible defs like any other: a flag with `=` fails as unexpected-value, an unlisted spelling fails as unknown-option, after `--` any of them is plain text. `-h ask` and `ask -h` behave identically — both resolve `ask` and return the same arm — because the flag does not stop the scan and the word is still scanned in either order.
- **FR-008**: A bare `--` ends option processing: it is consumed, everything after it is `any-plain` text, even tokens starting with `-`.
- **FR-009**: Detaching a definition (removing it from the command's defs) removes its spellings: former spellings fail as unknown-option.
- **FR-010**: Expected scan failures are a failure arm, not exceptions (ADR-004): `parse-error` (`{ kind: "parse-error"; result: { message; exitCode; command? } }` — diagnosis, shell code, and the resolved word if any; no `helpBlock`, the entry point restores the block itself). The entry point prints `message + "\n\n" + block` on stderr, where block is general help (no command yet) or that command's block (kept above the scan). Unknown command exits 1; all other parse errors exit 2. A missing word is NOT a scan failure: it returns `no-command` (`{ kind: "no-command"; result: { argValues; params } }` — facts only, no message, no exit code); the entry point decides: facts present → `No command.` + general block on stderr, exit 2; facts empty → general block on stdout, exit 0. No pre-scan empty-`argv` shortcut: empty input scans to `no-command` with empty facts.

### Key Entities

- **Flag**: `{ name: "--flag"; alias: "-f" }` — zero values, never repeats, `=` always an error. The `--no-<name>` off-form is a second `Flag` entry, never automatic. A flag entry may carry `skipArity: true` (arity skipped when the flag is set — generic marker, `helpFlag` uses it).
- **Option**: `{ name: "--option"; alias: "-o"; repeatable: boolean }` — exactly one raw-string value per occurrence; `repeatable: true` accumulates, `false` rejects the second occurrence.
- **Command**: `{ name: string; defs: ArgDef[]; minParams: number; maxParams: number }` — the word, its own defs, and param arity (`0 <= min <= max`, integers; `max >= MAX_PARAMS` means unbounded). No `help`, no `run`: help texts and execution live above the scan (Scope).
- **Parse result**: a discriminated union of three shapes — `run` (`{ kind; command; argValues; params }`, command required — handler runs; with no word the scan returns `no-command` instead, never a command-less `run`), `no-command` (`{ kind; argValues; params }`, no word — facts only, normal outcome, NO message and NO exit code; the entry point owns the meaning: a set help flag means print the block, facts present without it mean error, facts empty without it mean plain help), or `parse-error` (`{ kind; message; exitCode; command? }`, expected input failure — diagnosis, shell code, resolved word if any; ADR-004). No arm carries help text: the entry point restores the block (`command ?` its block `: general`) and prints `message + "\n\n" + block` on stderr for errors, the block alone on stdout for helps and for the help flag. `params` is always an array (possibly empty) — the scan never joins chunks. `ArgDef = { kind: "flag"; def: Flag; global: boolean; skipArity?: boolean } | { kind: "option"; def: Option; global: boolean }` — `kind`, `global` and `skipArity` live only in the wrapper; the types themselves stay clean.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every `argv` accepted by the grammar parses; every `argv` rejected by the grammar returns the `parse-error` arm with the named message (entry point appends its block at print time). A set help flag is not a rejection — the scan returns the normal arm with the flag set, the entry point prints the block.
- **SC-002**: Repeating a flag or a non-repeatable option always fails; repeating a repeatable option keeps all values in order. Param counts outside `[min, max]` fail as `Too few/many params`; `max >= MAX_PARAMS` never fails the upper check. A set `skipArity` flag skips the arity check.
- **SC-004**: No command word returns `no-command` with facts only (no message, no exit code); `run` requires the word. Entry point: help flag set → block exit 0; else facts present → error exit 2; facts empty → help exit 0.
- **SC-003**: A set help flag prints the right block to stdout, exit 0, handler never called; `--help=x` and unlisted `--no-help` always fail.

## Assumptions

- `interface` vs `class`/`record`: three plain shapes are enough — the scan builds a value and the entry point reads it once, no behaviour or identity travels with it. So the result is declared with TypeScript `interface`s (structural object shapes, erased at runtime), not classes: there is nothing to construct, extend, or `instanceof`-check — the `kind` string field already tells the cases apart. A C# `record` maps to this, not to a TS `class`.

- One command = one handler function; file layout is an implementation detail.
- `ask` and its `--provider` / `--key` / `--model` defs arrive with the ask-command spec, not here; until then the command table may be empty.
- Value interpretation (numbers, enums, key-spec forms) belongs to handlers and follow-up specs, never to this scan.
