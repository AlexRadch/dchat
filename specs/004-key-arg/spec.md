# Feature Specification: Key Argument Reader

**Feature Branch**: `004-key-arg`

**Created**: 2026-11-07

**Status**: Draft

**Input**: User description: "Lazy first-token reader for the key option: owns --key spellings and help lines, consumes at most one occurrence per pass of the argument-processing loop. Detachable by deleting its file, import, call line, and help spread."

**Parent**: `specs/002-argument-readers/spec.md` (argument-processing loop mechanics: FR-003 lazy strategy allowed, FR-004 argument-processing loop; this spec fixes one reader's spellings and strategy).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Key flag is read lazily (Priority: P1)

A user passes `--key` anywhere in the command line and the reader consumes it, returning the key spec and the remainder. Any token list not starting with the key flag passes through unchanged.

**Why this priority**: This is the reader's only job. Without it the key cannot be set from the command line.

**Independent Test**: Call `readKeyArg(["--key", "sk-or-...", "Hi"])` and check `{ key: "sk-or-...", rest: ["Hi"] }`; call `readKeyArg(["--provider", "faux", "Hi"])` and check the input comes back unchanged with `key: undefined`.

**Acceptance Scenarios**:

1. **Given** tokens `["--key", "sk-or-...", "Hi"]`, **When** the reader processes them, **Then** it returns `key: "sk-or-..."` and `rest: ["Hi"]`.
2. **Given** tokens `["-k", "env:MY_KEY", "Hi"]`, **When** the reader processes them, **Then** it returns `key: "env:MY_KEY"` and `rest: ["Hi"]` (short alias works).
3. **Given** tokens `["--key=env:MY_KEY", "Hi"]`, **When** the reader processes them, **Then** it returns `key: "env:MY_KEY"` and `rest: ["Hi"]` (`=` form works).
4. **Given** tokens `["--provider", "faux", "Hi"]`, **When** the reader processes them, **Then** it returns `key: undefined` and the tokens unchanged (not its flag).

---

### User Story 2 - Missing value fails loudly (Priority: P2)

A user writes the flag without a value and gets a clear error naming the option instead of a silent empty key.

**Why this priority**: A silent empty key would fail later with a confusing key-resolution error. Failing at the flag names the real mistake.

**Independent Test**: Call the reader on `["--key"]`, `["--key", "--model", "m"]`, and `["--key="]`; each throws `Missing value for --key`.

**Acceptance Scenarios**:

1. **Given** tokens `["--key"]`, **When** the reader processes them, **Then** it throws `Missing value for --key` (exit 2 at the entry point).
2. **Given** tokens `["--key", "--model", "m"]`, **When** the reader processes them, **Then** it throws `Missing value for --key` (an option is never a value).
3. **Given** tokens `["--key="]`, **When** the reader processes them, **Then** it throws `Missing value for --key` (empty value never accepted).

---

### Edge Cases

- The same flag repeated across passes: last occurrence wins (a later pass overwrites the stored value).
- The value as written IS the key spec (literal, `env:`, `file:`, `dotenv:`, `keychain:` forms), used as-is. How it resolves is decided later by the existing key resolution, not by this reader.
- Detaching this reader (delete file + import + call line + help spread) makes `--key` / `-k` fall into the argument-processing loop's unknown-option error and removes its help lines.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The reader MUST own its option spellings exclusively: `--key`, `--key=<v>`, `-k`. No other reader may claim these spellings.
- **FR-002**: The reader MUST use the lazy strategy: inspect only the leading token. If the first token is `--key` or `-k`, consume it plus the next token as the value. If the first token starts with `--key=`, consume it and take the suffix as the value. Otherwise return the input unchanged with `key: undefined`.
- **FR-003**: A missing value (flag is the last token, next token starts with `-` or is empty, or `=` form has an empty suffix) MUST throw `Error("Missing value for --key. ...")` with the same hint suffix as the other readers. An empty value MUST never be accepted.
- **FR-004**: The reader MUST return a new remainder (input minus the consumed pair, order preserved) and MUST NOT mutate the input.
- **FR-005**: The reader MUST store the value as-is. Key-spec interpretation is out of scope (decided later by the existing key resolution).
- **FR-006**: The reader MUST contribute its own help lines (`keyHelp`), so `ask --help` describes it exactly while attached and drops it when detached.
- **FR-007**: Per call the reader consumes at most one occurrence. Repetition across passes of the argument-processing loop resolves to last-wins.

### Key Entities

- **Key reader** (`src/keyArg.ts`): `readKeyArg(tokens)` → `{ key?, rest }` plus `keyHelp: string[]`. Self-contained; imports nothing from other readers.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All four User Story 1 scenarios hold (long, short, `=`, foreign flag untouched).
- **SC-002**: All three User Story 2 scenarios throw the missing-value error.
- **SC-003**: Reader consumes at most one occurrence per call; repeated flags resolve last-wins across passes.

## Assumptions

- Argument-processing loop mechanics (pass order, shrink-to-continue, unknown-option error) live in `002-argument-readers` and are not repeated here.
- The value may be any non-empty string; its meaning is resolved downstream.
