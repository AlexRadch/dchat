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

1. **Given** no command word on the line, **When** `--help` appears, **Then** a `general-help` is returned — the already-parsed global `options`; entry point prints the general block to stdout, exit 0.
2. **Given** command `ask` already seen, **When** `--help` appears, **Then** a `command-help` for `ask` is returned (that command + parsed `options`/`text`); entry point prints its block to stdout, exit 0.
3. **Given** `-h ask` or `ask -h`, **When** scanned, **Then** both return the identical `command-help` for `ask` — the help flag does not stop the scan, the word still resolves.
4. **Given** `--help=x` or `--no-help`, **When** scanned, **Then** it fails as an option error (help takes no value, `--no-help` is unknown).
5. **Given** `--help` plus an erroneous token in either order, **When** scanned, **Then** a `parse-error` is returned (the error wins) — the entry point restores the relevant block at print time.

---

### Edge Cases

- Detaching a definition (removing it from the command's `defs`) removes its spellings: former spellings fail as unknown-option.
- `dchat --help ask` and `dchat ask --help` return the same `command-help`: help is remembered, not terminal — the word still resolves, an error still beats help.

## Scope — what this spec does NOT cover

This spec is exhaustive for the scan and nothing else. The scan resolves
names, defs, options and text — that is all. The following live above the
scan (entry point, command modules, follow-up specs) and MUST NOT be pulled
in here:

- Help texts (`generalHelp`, per-command blocks): the scan returns the
  resolved word (`command?`), the entry point restores and prints the block.
- Execution (`run`, handler dispatch, `RunCommand`): the scan returns the
  `run` arm with finished data; what happens next is not its concern.
- Value interpretation (numbers, enums, key-spec forms, defaults): handlers
  own it (FR-006).
- Key resolution, provider catalogs, harness flow: later specs.

A change that adds any of the above to `args.ts` is out of scope and
rejected — extend the layers above, not the scan.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The entry point runs one left-to-right scan over `argv`. It is fed the global args (spec 008) plus the command table (`Command[]` — word + defs only, no help text, no execution); there is no other shared state. No parsing lives in handlers. Before any command word ONLY globals are accepted — their shape is known upfront, so `-f` before a command is decided by the global table alone, never guessed. A command-owned spelling before its command word fails immediately (unknown or misplaced), it is never buffered for later.
- **FR-002**: Each definition owns its spellings: one long form plus exactly one short alias (`--option` / `-o`). Commands have no aliases. Within one command, no two defs may claim the same spelling.
- **FR-003**: A `Flag` takes zero values. Any `=` on a flag (`--flag=x`, `-f=x`) is an error. A `Flag` MUST NOT repeat: the second occurrence fails as too-many. `--no-<name>` is a separate spelled flag that turns the feature off; short flags have no negated form. One exception: `-h` / `--help` repeat is harmless — help needs no `counts` entry because resolving the same word twice changes nothing.
- **FR-004**: An `Option` takes exactly one value, written either apart (`--option value`, `-o value`) or glued (`--option=value`, `-ovalue` in one argv element). A missing value (end of input, next token starts with `-`, empty `=` suffix) fails as missing-value. `-o=value` is NOT a glued form — it is an error.
- **FR-005**: An `Option` declares `repeatable: boolean`. A second occurrence with `repeatable: false` fails as too-many. With `repeatable: true` values accumulate in order. Help contributes no value — `-h` beside an option never fills or fools the value slot.
- **FR-005b**: A command-owned spelling appearing BEFORE its command word fails immediately — it is never buffered and never re-checked later. The only tokens valid before a command word are globals (spec 008) and the `--help` loop rule. So `dchat --provider faux ask` fails at `--provider` even if `ask` owns it — command defs activate only after their word.
- **FR-006**: The scan hands each command's handler finished data only: flag states, option values (raw strings, exactly as typed), and the joined `text`. The handler converts types and reports its own type errors; the loop never interprets values.
- **FR-007**: `--help` / `-h` is a loop rule, not a definition. It is valid before any command and after a command word: it is remembered (not returned yet), already-parsed `options`/`text` and any resolved command are kept, the scan keeps going — later tokens may still fail (an error always beats help). After `--`, `--help` is plain text. `--help=x` fails as unexpected-value; `--no-help` fails as unknown-option. `-h ask` and `ask -h` behave identically — both resolve `ask` and return the same `command-help` — because the word is still scanned in either order.
- **FR-008**: A bare `--` ends option processing: it is consumed, everything after it is `any-plain` text, even tokens starting with `-`.
- **FR-009**: Detaching a definition (removing it from the command's defs) removes its spellings: former spellings fail as unknown-option.
- **FR-010**: Expected scan failures are a fourth result arm, not exceptions (ADR-004): `parse-error` (`{ kind: "parse-error"; result: { message; exitCode; command? } }` — diagnosis, shell code, and the resolved word if any; no `helpBlock`, the entry point restores the block itself). The entry point prints `message + "\n\n" + block` on stderr, where block is general help (no command yet) or that command's block (kept above the scan). Unknown command exits 1; all other parse errors exit 2. Empty `argv` prints general help on stderr, exit 2, without scanning.

### Key Entities

- **Flag**: `{ name: "--flag"; alias: "-f" }` — zero values, never repeats, `=` always an error. The `--no-<name>` off-form is a second `Flag` entry, never automatic.
- **Option**: `{ name: "--option"; alias: "-o"; repeatable: boolean }` — exactly one raw-string value per occurrence; `repeatable: true` accumulates, `false` rejects the second occurrence.
- **Command**: `{ name: string; defs: Def[] }` — the word plus its own defs (references to shared definitions where shapes match). No `help`, no `run`: help texts and execution live above the scan (Scope).
- **Parse result**: a discriminated union of four shapes — `general-help` (`{ kind; options }`, seen before any command word), `command-help` (`{ kind; command; options; text? }`, command known), `run` (`{ kind; command?; options; text? }`, no help requested — handler runs), or `parse-error` (`{ kind; message; exitCode; command? }`, expected input failure — diagnosis, shell code, resolved word if any; ADR-004). No arm carries help text: the entry point restores the block (`command ?` its block `: general`) and prints `message + "\n\n" + block` on stderr for errors, the block alone on stdout for helps. `Def = { kind: "flag"; def: Flag } | { kind: "option"; def: Option }` — `kind` lives only where the two are mixed, the types themselves stay clean.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every `argv` accepted by the grammar parses; every `argv` rejected by the grammar returns the `parse-error` arm with the named message (entry point appends its block at print time).
- **SC-002**: Repeating a flag or a non-repeatable option always fails; repeating a repeatable option keeps all values in order.
- **SC-003**: `--help` / `-h` works for zero and for every command without being declared in any `defs`; `--help=x` and `--no-help` always fail.

## Assumptions

- `interface` vs `class`/`record`: three plain shapes are enough — the scan builds a value and the entry point reads it once, no behaviour or identity travels with it. So the result is declared with TypeScript `interface`s (structural object shapes, erased at runtime), not classes: there is nothing to construct, extend, or `instanceof`-check — the `kind` string field already tells the cases apart. A C# `record` maps to this, not to a TS `class`.

- One command = one handler function; file layout is an implementation detail.
- `ask` and its `--provider` / `--key` / `--model` defs arrive with the ask-command spec, not here; until then the command table may be empty.
- Value interpretation (numbers, enums, key-spec forms) belongs to handlers and follow-up specs, never to this scan.
