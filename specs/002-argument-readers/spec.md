# Feature Specification: Argument Readers with Two-Phase Dispatch

**Feature Branch**: `002-argument-readers`

**Created**: 2026-11-07

**Status**: Rewritten 2026-11-08 — grammar is the contract; prose only covers what EBNF cannot (repetition errors, exit codes). Rewritten 2026-11-09 — help is a plain general entry (`helpFlag`), not a loop rule; no `general-help`/`command-help` arms.

**Input**: User description: "Parse the command line in small detachable pieces. Each piece reads its own options and returns the unread remainder. After all pieces run, anything unread that looks like an option is an error. Removing a piece removes its options from the accepted set."

## Grammar (EBNF sketch, ISO 14977)

```ebnf
argv    = { general }, [ command, { own-or-global | plain }, [ "--", { any-plain } ] ] ;
  (* no command word is a NORMAL outcome (Story 4), not an error:
     generals still scan, the scan returns no-command with the facts,
     the entry point decides the meaning *)
  (* before the word only generals are visible; after the word the command's
     own defs are tried first, then generals with global: true — never the rest *)
  (* after the command, plains and flags/options mix freely in any order;
     option takes its following plain as its value before it counts as a param;
     plains before and after "--" collect in order as raw param chunks —
     the scan never joins them, joining is the command's job *)

command = ? one plain token, not starting with "-" ? ;

general       = flag | option ;
  (* any general entry, global or not — visibility is prose-only (FR-001):
     before the word all generals are visible, after it only global: true *)

own-or-global = flag | option ;
  (* the command's own entry, else a general entry with global: true —
     lookup order is prose-only (FR-001): own defs first, then globals *)

flag    = "--flag" | "--no-flag" | "-f" ;

option  = ("--option", plain ) | ("-o", plain ) | long-glued | short-glued ;

long-glued = ? "--option=" immediately followed by any-plain ? ;

short-glued = ? "-o" immediately followed by any-plain ? ;

plain   = ? one plain token, not starting with "-" ? ;

any-plain = ? one plain token ? ;
```

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Standard command line parses (Priority: P1)

A user runs `dchat ask --provider faux "Hi there"` or any free-order mix (`dchat ask "Hi" --provider faux`). Options take their single value first; leftover plains become the param chunks. All flag states and option values land in one values map.

**Acceptance Scenarios**:

1. **Given** command `ask` referencing `providerOption`, **When** the user runs `dchat ask --provider faux "Hi"`, **Then** values hold the single value and chunks are `["Hi"]`.
2. **Given** the same command, **When** the user runs `dchat ask "Hi" --provider faux`, **Then** the result is identical.

---

### User Story 2 - Repetition is rejected unless allowed (Priority: P1)

A user repeats a flag or a single-shot option and gets a loud too-many. A repeatable option accumulates.

**Acceptance Scenarios**:

1. **Given** flag `-f` already seen, **When** `-f` appears again, **Then** the scan fails as too-many.
2. **Given** option `--provider` (single-shot) already seen, **When** it appears again, **Then** the scan fails as too-many.
3. **Given** option `--tag` (repeatable) seen twice, **When** the scan finishes, **Then** both values are kept in order.

---

### User Story 3 - Help is an ordinary global flag (Priority: P1)

`--help` / `-h` is a plain flag entry (global, visible after every word) — no loop rule, no hard-coded spelling in the scan. It scans like any flag: repeats fail, `=` fails, after `--` it is text, an error anywhere beats it (the scan returns the failure outcome before any flag meaning is read). The entry point gives it meaning: a set help flag means print the block (command's block if a word resolved, else general) to stdout, exit 0, handler never called.

**Acceptance Scenarios**:

1. **Given** no command word on the line, **When** `--help` appears, **Then** success-without-command is returned with the flag set in values; entry point prints the general block to stdout, exit 0.
2. **Given** command `ask` already seen, **When** `--help` appears, **Then** success-with-command for `ask` is returned with the flag set — arity is still checked dumb (a help flag on an arity-1 command fails as too-few-params); entry point prints the block for a clean success, exit 0.
3. **Given** `-h ask` or `ask -h`, **When** scanned, **Then** both return the identical outcome for `ask` with the flag set — the flag does not stop the scan, the word still resolves.
4. **Given** `--help=x` or `--no-help`, **When** scanned, **Then** it fails as unexpected-value / unknown-option — like any flag, exit 2.
5. **Given** `--help` plus an erroneous token in either order, **When** scanned, **Then** the failure outcome is returned (the error wins) — the flag never saves a bad line.
6. **Given** `--help` twice on one line, **When** scanned, **Then** it fails as too-many — a repeated single-shot flag like any other; multi-use needs an explicit opt-in on the entry.

---

### User Story 4 - No command word is a normal outcome, not a failure (Priority: P1)

A bare line (`dchat`, `dchat --provider faux`) scans fine: the scan reports facts (values map + param chunks) as success-without-command — no message, no exit code, nothing to fail. Meaning belongs to the entry point: facts present → misplaced content, error `No command.` + general block on stderr, exit 2; facts empty → plain general help on stdout, exit 0.

**Acceptance Scenarios**:

1. **Given** no command word and parsed facts present, **When** the scan finishes, **Then** success-without-command is returned (facts, no exit code); the entry point prints `No command.` + general block on stderr, exit 2.
2. **Given** empty `argv` (no word, no facts), **When** scanned, **Then** success-without-command with empty facts is returned; the entry point prints general help on stdout, exit 0 (the old pre-scan empty-`argv` shortcut is gone).
3. **Given** a valid command word, **When** scanned, **Then** the result is success-with-command (arity checked) — success-without-command never appears alongside a word.

---

### Edge Cases

- Detaching a definition (removing it from the command's `defs`) removes its spellings: former spellings fail as unknown-option.
- `dchat --help ask` and `dchat ask --help` return the same `run` for `ask` with the help flag set: no arm stops the scan, the word still resolves, an error still beats the flag.
- A general spelling before the word is checked against the general entry; once the word resolves, every collected token is re-checked against the command's rule for it (own entry, else the `global: true` general). Same object referenced twice is one rule; two different objects with one spelling is two rules — the scan acts dumb, never compares.
- The scan outcomes table (Key Entities) is the full list of what the scan can return: two success shapes plus one named failure shape per failure type. No other failure shape exists.

## Scope — what this spec does NOT cover

This spec is exhaustive for the scan and nothing else. The scan resolves
names, defs, argValues and text — that is all. The following live above the
scan (entry point, command modules, follow-up specs) and MUST NOT be pulled
in here:

- Help texts (`generalHelp`, per-command blocks): the scan returns the
  resolved word (the command, when one resolved), the entry point restores
  and prints the block. The scan never decides WHAT help means — a set help
  flag is just a flag.
- Exit codes: the scan carries none — every failure outcome is a usage error
  by construction. The entry point maps all of them to exit 2 in one place;
  `no-command` semantics stay as described. Exit 1 is reserved for runtime
  failures and programmer bugs above the scan.
- Execution (`run`, handler dispatch, `RunCommand`): the scan returns the
  `run` arm with finished data; what happens next is not its concern.
- Value interpretation (numbers, enums, key-spec forms, defaults): handlers
  own it (FR-006).
- Key resolution, provider catalogs, harness flow: later specs.

A change that adds any of the above to `args.ts` is out of scope and
rejected — extend the layers above, not the scan.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The entry point runs one left-to-right scan over the tokens. It is fed the general args (the 008 table) plus the command table; there is no other shared state. No parsing lives in handlers. Before any command word ONLY generals are accepted. A command-owned spelling before its command word fails immediately as unknown-option, it is never buffered for later. After the word the scan tries the command's own defs first, then generals marked visible-after-word — other generals are invisible there. Once the word resolves, every token collected before it is re-checked against the command's rule for it: same referenced object is one rule, two different objects is two rules — the scan acts dumb, never compares shapes, never validates the configuration. Marker placement is type-level: only general entries carry the visibility marker — command defs are plain and cannot carry it.
- **FR-002**: Each definition owns its spellings: one long form plus exactly one short alias. Commands have no aliases. Within one list no two defs may claim the same spelling — except the same referenced object counted twice (a general referenced by the command is one rule, not a duplicate).
- **FR-003**: A flag takes zero values. Any `=` on a flag is an error (unexpected-value). A repeated flag fails as too-many. A separate `--no-` spelled flag turns the feature off; short flags have no negated form.
- **FR-004**: An option takes exactly one value, written apart or glued with `=` / short form. A missing value (end of input, next token starts with `-`, empty `=` suffix) fails as missing-value. A glued `-o=value` form fails as unexpected-value. A set flag never fills an option's value slot.
- **FR-005**: A repeated single-shot option fails as too-many. A repeatable option accumulates values in order.
- **FR-005b**: A command-owned spelling appearing BEFORE its command word fails immediately as unknown-option — it is never buffered and never re-checked later. The only tokens valid before a command word are generals.
- **FR-005c**: Each command declares param arity (minimum and bounded maximum chunk counts; the maximum has an unbounded marker value). The scan checks arity on the success-with-command path only: fewer than minimum fails as too-few-params, more than a bounded maximum fails as too-many-params, both with the resolved command. A bad shape is a programmer bug and throws.
- **FR-006**: The scan hands each command's handler finished data only: flag states, option values (raw strings, exactly as typed), and the ordered param chunks. The command joins chunks as it needs; the handler converts types and reports its own type errors; the loop never interprets values.
- **FR-007**: No hard-coded spellings in the scan. Help spellings are ordinary tokens resolved through the visible defs like any other: a flag with `=` fails as unexpected-value, an unlisted spelling fails as unknown-option, after `--` any of them is plain text. Both orders behave identically — the flag does not stop the scan and the word is still scanned in either order.
- **FR-008**: A bare `--` ends option processing: it is consumed, everything after it is `any-plain` text, even tokens starting with `-`.
- **FR-009**: Detaching a definition (removing it from the command's defs) removes its spellings: former spellings fail as unknown-option.
- **FR-010**: Expected scan failures are named failure outcomes, not exceptions (ADR-004) and carry no exit code: one outcome shape per failure type — the scan says WHAT happened (by shape), the entry point decides the shell meaning (all scan failures are usage errors → exit 2, one mapping in one place). A missing word is NOT a scan failure: it returns success-without-command (facts only, no message, no exit code); the entry point decides by the no-command rule. No pre-scan empty-input shortcut: empty input scans to success-without-command with empty facts.

### Key Entities

Outcomes table — the full list of what the scan can return, in plain words (no code types here; the TS union lives in the plan). Adding a new failure shape means adding a row here first.

| outcome | when | carries |
|---|---|---|
| success with command | word found, everything fits | the command, parsed values, param chunks |
| success without command | no word, clean scan | parsed values, param chunks |
| unknown word | plain token where a word fits matches no command | the word itself |
| unknown option | dash-token matches no visible entry | the token; the command, when one already resolved |
| missing value | option left without its single value | the option's name; the command, when resolved |
| unexpected value | `=` glued onto a flag | the flag's name; the command, when resolved |
| too many | repeated single-shot option, or any repeated flag | the entry's name; the command, when resolved |
| too few params | fewer chunks than the command's minimum | the command; how many chunks arrived |
| too many params | more chunks than the command's bounded maximum | the command; how many chunks arrived |

Every row except the two successes shares one extra fact: a human-readable diagnosis line, built by the scan. No row carries an exit code — all failure rows are usage errors by construction (entry point → exit 2).

- **Flag**: a flag takes zero values, never repeats, `=` always an error. The `--no-` off-form is a second flag entry, never automatic. Only the general heir carries visibility; a command-side flag has no such field.
- **Option**: exactly one raw-string value per occurrence; `repeatable: true` accumulates, `false` rejects the second occurrence.
- **Command**: the word, its own plain defs (never the general kind: no visibility marker on command entries), and param arity (minimum and bounded maximum counts). No help text, no execution: help texts and execution live above the scan (Scope).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every `argv` accepted by the grammar parses; every `argv` rejected by the grammar returns the named failure outcome from the outcomes table with its diagnosis (entry point appends its block at print time, exit 2). A set help flag is not a rejection — the scan returns the normal arm with the flag set, the entry point prints the block.
- **SC-002**: Repeating a flag or a non-repeatable option always fails as too-many; repeating a repeatable option keeps all values in order. Param counts outside the command's range fail as too-few/too-many params; an unbounded maximum never fails the upper check.
- **SC-004**: No command word returns success-without-command with facts only (no message, no exit code). Entry point: help flag set → block exit 0; else facts present → error exit 2; facts empty → help exit 0.
- **SC-003**: A set help flag prints the right block to stdout, exit 0, handler never called; `--help=x` and unlisted `--no-help` always fail as unexpected-value / unknown-option.

## Assumptions

- `interface` vs `class`/`record`: three plain shapes are enough — the scan builds a value and the entry point reads it once, no behaviour or identity travels with it. So the result is declared with TypeScript `interface`s (structural object shapes, erased at runtime), not classes: there is nothing to construct, extend, or `instanceof`-check — the `kind` string field already tells the cases apart. A C# `record` maps to this, not to a TS `class`.

- One command = one handler function; file layout is an implementation detail.
- `ask` and its `--provider` / `--key` / `--model` defs arrive with the ask-command spec, not here; until then the command table may be empty.
- Value interpretation (numbers, enums, key-spec forms) belongs to handlers and follow-up specs, never to this scan.
