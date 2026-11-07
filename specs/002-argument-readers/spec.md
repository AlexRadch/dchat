# Feature Specification: Argument Readers with Remainder Chain

**Feature Branch**: `002-argument-readers`

**Created**: 2026-11-07

**Status**: Amended 2026-11-07 — argument-processing loop + free strategies (see FR-003–FR-004).

**Input**: User description: "Parse the command line in small detachable pieces. Each piece reads its own options and returns the unread remainder. After all pieces run, anything unread that looks like an option is an error. Removing a piece removes its options from the accepted set."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ask with known options still works (Priority: P1)

A user runs `dchat ask` with the usual options (`--provider`, `--key`, `--model`) and gets the same behavior as before: the question is answered, help is unchanged, exit codes are unchanged.

**Why this priority**: This is the existing product surface. The parsing refactor must not change what the user sees.

**Independent Test**: Run `dchat ask --provider faux "Hi"`, `dchat ask --key <k> "Hi"`, and `dchat ask --help`; compare stdout/stderr/exit codes with the previous behavior.

**Acceptance Scenarios**:

1. **Given** the standard readers are registered, **When** the user runs `dchat ask --provider faux "Hi"`, **Then** the question is answered exactly as before.
2. **Given** the standard readers are registered, **When** the user runs `dchat ask --help`, **Then** the help lists exactly the options of the registered readers, no more and no less.

---

### User Story 2 - Detaching a reader removes its options (Priority: P1)

A builder of the application removes one argument reader (e.g. the one reading `--provider` from the command line) from the registration list, and from then on that option is no longer accepted: passing it fails as an unknown option.

**Why this priority**: This is the whole point of the feature — optional pieces that can be compiled out by commenting out one registration line.

**Independent Test**: Remove the provider reader from the registration list, rebuild, run `dchat ask --provider faux "Hi"` and check it fails as an unknown option; run `dchat ask --help` and check the provider option is gone from the help.

**Acceptance Scenarios**:

1. **Given** the provider reader is removed from the registration list, **When** the user runs `dchat ask --provider faux "Hi"`, **Then** the program reports an unknown option naming `--provider` and exits with a usage error.
2. **Given** the provider reader is removed from the registration list, **When** the user runs `dchat ask --help`, **Then** the help no longer mentions the provider option.

---

### User Story 3 - Unknown options are rejected, never silently ignored (Priority: P2)

A user mistypes an option (`--porvider`) and gets a clear error naming the offending token instead of the program silently falling back to defaults.

**Why this priority**: Silent ignores turn typos into mystery behavior (wrong provider, wrong key source). A loud error is the accepted terminal-tool convention.

**Independent Test**: Run `dchat ask --porvider faux "Hi"` with the standard readers registered and check stderr names `--porvider` with a usage-error exit code.

**Acceptance Scenarios**:

1. **Given** the standard readers are registered, **When** the user passes an option no reader claims (`--porvider`), **Then** the program reports `Unknown option: --porvider` with a hint toward `ask --help` and exits with a usage error.

---

### Edge Cases

- An option that needs a value is given none (`--provider` at the end, or followed by another option, or `--provider=` with an empty value): usage error naming the option (`Missing value for --provider`), not an empty value silently accepted.
- The same option repeated: the last occurrence wins.
- `--help` / `-h` after `ask` short-circuits to help; option parsing does not run.
- A detached reader's short alias goes away together with its long form (e.g. removing the provider reader removes both `--provider` and `-p`).
- Positional words (the question text) are never claimed by option readers and never reported as unknown options.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The command line after `ask` MUST be parsed only by registered argument readers. The entry point names no option itself; it holds the registration list and runs the argument-processing loop.
- **FR-002**: Each argument reader owns its option spellings. This spec fixes no spellings — each reader's spec (003, 004, 005, ...) owns its long form, `=` form, and short alias. No two readers may claim the same spelling.
- **FR-003**: Each argument reader is a pure step over a token list: the entry point hands it the current token list with a single command — "process". The reader consumes only its own options (flag together with value) and returns the unconsumed remainder plus its parsed value. Readers MUST NOT mutate shared state. The reader never reports whether the tokens are its own — it simply returns everything it did not consume, unchanged. Each reader's own spec fixes its strategy (lazy first-token check, greedy full scan, linked-group consumption). The entry point MUST NOT know or assume which strategy a reader uses.
- **FR-004**: The entry point MUST run a argument-processing loop: one pass hands the current token list to every registered reader in order, each receiving the previous reader's remainder. The entry point MUST NOT ask readers which options they know and MUST NOT name any option itself. After each full pass the entry point compares sizes: if the list shrank, at least one reader consumed something and the loop runs another pass; if the list is unchanged, nobody claimed anything and the loop stops. An empty remainder stops the loop. After the loop, the entry point MUST inspect the final remainder (FR-005).
- **FR-005**: Any token left in the final remainder that looks like an option (starts with `-`) MUST be reported as `Unknown option: <token>` with a hint toward `dchat ask --help`, exit code 2. Leftover non-option tokens are the question text, never an error.
- **FR-006**: Detaching a reader (removing it from the registration list) MUST remove its options from the accepted set: its former spellings fall into the FR-005 unknown-option error, and its help lines disappear from `ask --help`.
- **FR-007**: Each argument reader MUST contribute its own help fragment, so `ask --help` always describes exactly the registered readers.
- **FR-008**: An option requiring a value with no value present (end of tokens, next token is another option, or empty `=` value) MUST fail as `Missing value for <option>`, exit code 2. An empty value MUST never be accepted as a real value. Each reader's own spec names its option in the message.
- **FR-009**: All existing CLI behavior MUST stay unchanged while the standard readers are registered: commands, flags, help text, stdout/stderr contract, and exit codes (0 answer, 2 usage/config, 1 unanswered).

### Key Entities

- **Argument reader**: an optional parsing piece that owns one option family (its spellings, its value shape, its help lines). On the single command "process" it takes tokens, returns parsed value plus the unread remainder. Free to use any strategy (lazy first-token check, greedy full scan, linked-group consumption). Detachable by removing it from the registration list.
- **Registration list**: the single place in the entry point naming which readers participate and in which order. The only edit needed to add or remove command-line capability.
- **Remainder**: the tokens no reader has claimed yet. Flows from reader to reader inside one pass; the argument-processing loop repeats passes while the remainder shrinks. Whatever still looks like an option after the loop stops is an unknown-option error.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With all standard readers registered, asking via every existing option works exactly as before (same stdout, same stderr, same exit codes).
- **SC-002**: Removing one reader from the registration list makes its option spellings fail as unknown options and removes its help lines, with no other code touched.
- **SC-003**: A mistyped option is named in the error output and exits with a usage error; it never silently falls back to a default.
- **SC-004**: An option with a missing value fails with a missing-value error naming the option; an empty value is never accepted.

## Assumptions

- The standard set today is three readers: provider (003), key (004), model (005). Environment- and config-file-based provider sources are future features with their own specs, not part of this spec; this spec only fixes the argument-processing-loop mechanics they will plug into.
- Help short-circuit (`dchat ask --help`) and command routing (`dchat` / `ask` / unknown command) are unchanged and out of scope.
- The existing unknown-provider check (known ids listed, exit code 2) stays where it is; this spec covers only option parsing, not provider-id validation.
