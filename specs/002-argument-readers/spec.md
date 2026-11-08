# Feature Specification: Argument Readers with Two-Phase Dispatch

**Feature Branch**: `002-argument-readers`

**Created**: 2026-11-07

**Status**: Rewritten 2026-11-08 — grammar is the contract; prose only covers what EBNF cannot (help interception, repetition errors, exit codes).

**Input**: User description: "Parse the command line in small detachable pieces. Each piece reads its own options and returns the unread remainder. After all pieces run, anything unread that looks like an option is an error. Removing a piece removes its options from the accepted set."

## Grammar (EBNF sketch, ISO 14977)

```ebnf
argv    = { flag-or-option }, [ command, { flag-or-option | plain }, [ "--", { any-plain } ] ] ;
  (* after the command, plains and flags/options mix freely in any order;
     option takes its following plain as its value before it counts as text;
     plains before and after "--" collect in order and join into one text *)

command = ? one plain token, not starting with "-" ? ;

flag-or-option = flag | option ;

flag    = "--flag" | "--no-flag" | "-f" ;

option  = ("--option", plain ) | ("-o", plain ) | long-glued | short-glued ;

long-glued = ? "--option=" immediately followed by any-plain ? ;

short-glued = ? "-o" immediately followed by any-plain ? ;

plain   = ? one plain token, not starting with "-" ? ;

any-plain = ? one plain token ? ;
```

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Standard command line parses (Priority: P1)

A user runs `dchat ask --provider faux "Hi there"` or any free-order mix (`dchat ask "Hi" --provider faux`). Options take their single value first; leftover plains become the text.

**Acceptance Scenarios**:

1. **Given** command `ask` owns `--provider`, **When** the user runs `dchat ask --provider faux "Hi"`, **Then** options hold the value and text is `Hi`.
2. **Given** the same ownership, **When** the user runs `dchat ask "Hi" --provider faux`, **Then** the result is identical.

---

### User Story 2 - Repetition is rejected unless allowed (Priority: P1)

A user repeats a flag or a single-shot option and gets a loud error. A repeatable option accumulates.

**Acceptance Scenarios**:

1. **Given** flag `-f` already seen, **When** `-f` (or its `--flag` form) appears again, **Then** the parse fails as too-many.
2. **Given** option `--provider` (`repeatable: false`) already seen, **When** it appears again, **Then** the parse fails as too-many.
3. **Given** option `--tag` (`repeatable: true`) seen twice, **When** the scan finishes, **Then** both values are kept in order.

---

### User Story 3 - Help works without being declared (Priority: P1)

`--help` / `-h` is never listed in a command's defs, yet works everywhere: before any command it prints general help, after a command word it prints that command's block. The handler is never called.

**Acceptance Scenarios**:

1. **Given** no command word yet, **When** `--help` appears, **Then** general help prints to stdout, exit 0.
2. **Given** command `ask` already seen, **When** `--help` appears, **Then** the `ask` block prints verbatim to stdout, exit 0.
3. **Given** `--help=x` or `--no-help`, **When** scanned, **Then** it fails as an option error (help takes no value, `--no-help` is unknown).

---

### Edge Cases

- Detaching a definition (removing it from the command's `defs`) removes its spellings: former spellings fail as unknown-option, its help lines vanish from that command's verbatim block.
- `dchat --help ask` (help flag followed by a word) is NOT a supported form: `--help` stops the scan and prints immediately, `ask` is never read.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The entry point runs one left-to-right scan over `argv`. It is fed the global args (spec 008) plus the command table (`Command[]`); there is no other shared state. No parsing lives in handlers. Before any command word ONLY globals are accepted — their shape is known upfront, so `-f` before a command is decided by the global table alone, never guessed. A command-owned spelling before its command word fails immediately (unknown or misplaced), it is never buffered for later.
- **FR-002**: Each definition owns its spellings: one long form plus exactly one short alias (`--option` / `-o`). Commands have no aliases. Within one command, no two defs may claim the same spelling.
- **FR-003**: A `Flag` takes zero values. Any `=` on a flag (`--flag=x`, `-f=x`) is an error. A `Flag` MUST NOT repeat: the second occurrence fails as too-many. `--no-<name>` is a separate spelled flag that turns the feature off; short flags have no negated form.
- **FR-004**: An `Option` takes exactly one value, written either apart (`--option value`, `-o value`) or glued (`--option=value`, `-ovalue` in one argv element). A missing value (end of input, next token starts with `-`, empty `=` suffix) fails as missing-value. `-o=value` is NOT a glued form — it is an error.
- **FR-005**: An `Option` declares `repeatable: boolean`. A second occurrence with `repeatable: false` fails as too-many. With `repeatable: true` values accumulate in order.
- **FR-005b**: A command-owned spelling appearing BEFORE its command word fails immediately — it is never buffered and never re-checked later. The only tokens valid before a command word are globals (spec 008) and the `--help` loop rule. So `dchat --provider faux ask` fails at `--provider` even if `ask` owns it — command defs activate only after their word.
- **FR-006**: The scan hands each command's handler finished data only: flag states, option values (raw strings, exactly as typed), and the joined `text`. The handler converts types and reports its own type errors; the loop never interprets values.
- **FR-007**: `--help` / `-h` is a loop rule, not a definition. It is valid before any command and after a command word, stops the scan immediately, prints to stdout, exit 0, handler never called. `--help=x` fails as unexpected-value; `--no-help` fails as unknown-option. After a bare `--`, `--help` is plain text and does NOT trigger help.
- **FR-008**: A bare `--` ends option processing: it is consumed, everything after it is `any-plain` text, even tokens starting with `-`.
- **FR-009**: Detaching a definition (removing it from the command's defs) removes its spellings: former spellings fail as unknown-option and its lines vanish from that command's verbatim help block.
- **FR-010**: Every parse error prints the relevant help block after the error line on stderr (general help if no command word known yet, that command's verbatim block otherwise). Unknown command exits 1; all other parse errors exit 2. Empty `argv` prints general help on stderr, exit 2, without scanning.

### Key Entities

- **Flag**: `{ name: "--flag"; alias: "-f" }` — zero values, never repeats, `=` always an error. The `--no-<name>` off-form is a second `Flag` entry, never automatic.
- **Option**: `{ name: "--option"; alias: "-o"; repeatable: boolean }` — exactly one raw-string value per occurrence; `repeatable: true` accumulates, `false` rejects the second occurrence.
- **Command**: `{ name: string; defs: Def[]; help: string }` — the word, its own defs (references to shared definitions where shapes match), and its complete ready-to-print help block. `Def = { kind: "flag"; def: Flag } | { kind: "option"; def: Option }` — `kind` lives only where the two are mixed, the types themselves stay clean.
- **Parse result**: one map `options: Record<string, boolean | string[]>` — a flag stores `boolean` (`true` set, `false` via its `--no-` form), an option stores `string[]` (single-shot holds one element, `repeatable: true` accumulates in order) — plus the joined `text`, or `help` on short-circuit. The loop never interprets values beyond this shape.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every `argv` accepted by the grammar parses; every `argv` rejected by the grammar fails with the named error plus the relevant help block.
- **SC-002**: Repeating a flag or a non-repeatable option always fails; repeating a repeatable option keeps all values in order.
- **SC-003**: `--help` / `-h` works for zero and for every command without being declared in any `defs`; `--help=x` and `--no-help` always fail.

## Assumptions

- One command = one handler function; file layout is an implementation detail.
- `ask` and its `--provider` / `--key` / `--model` defs arrive with the ask-command spec, not here; until then the command table may be empty.
- Value interpretation (numbers, enums, key-spec forms) belongs to handlers and follow-up specs, never to this scan.
