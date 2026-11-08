# Feature Specification: Provider Option Definition

**Feature Branch**: `003-provider-arg`

**Created**: 2026-11-07

**Status**: Draft (rewritten 2026-11-08 — lazy-reader model replaced by a single-scan `Option` definition; no reader function remains)

**Input**: User description: "Provider option as one shared `Option` definition: owns `--provider` spellings and help lines, referenced (never copied) by every command that accepts it. The loop in 002 owns all scanning; this spec fixes the definition only."

**Parent**: `specs/002-argument-readers/spec.md` (single-scan loop, `Option`/`Command` types, fixed arity, occurrence bounds, loop-owned help; this spec fixes one option's definition).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Provider flag is collected by the loop (Priority: P1)

A user passes `--provider` anywhere among a command's options and the loop collects it as raw strings under the `--provider` tag. The definition itself parses nothing.

**Why this priority**: This is the definition's only job. Without it no command can accept a provider from the command line.

**Independent Test**: `scanArgv(["ask", "--provider", "faux", "Hi"], [], [askCmd()], GENERAL)` collects `options["--provider"] == ["faux"]`; the `-p` and `--provider=faux` forms collect the same.

**Acceptance Scenarios**:

1. **Given** the provider option registered on the command, **When** the user writes `--provider faux`, **Then** the loop stores `["faux"]` under `--provider`.
2. **Given** the same registration, **When** the user writes `-p faux`, **Then** the same value is stored under the long name `--provider` (short alias works).
3. **Given** the same registration, **When** the user writes `--provider=faux`, **Then** the same value is stored (`=` form works).
4. **Given** the provider option NOT registered on a command, **When** the user writes `--provider faux` after that command's word, **Then** the loop fails with `Unknown option: --provider` (plus that command's help, exit 2).

---

### User Story 2 - Missing value fails loudly (Priority: P2)

A user writes the flag without a value and gets a clear error naming the option instead of a silent empty provider.

**Why this priority**: A silent empty provider id would fail later with a confusing unknown-provider error. Failing at the flag names the real mistake.

**Independent Test**: `scanArgv(["ask", "--provider"], ...)`, `scanArgv(["ask", "--provider", "--key", "x"], ...)`, and `scanArgv(["ask", "--provider="], ...)` each throw `Missing value for --provider` with the command's help block, exit 2.

**Acceptance Scenarios**:

1. **Given** `--provider` as the last token, **When** the scan runs, **Then** it throws `Missing value for --provider` (exit 2 at the entry point).
2. **Given** `--provider` followed by another option, **When** the scan runs, **Then** it throws `Missing value for --provider` (an option is never a value).
3. **Given** `--provider=` with an empty suffix, **When** the scan runs, **Then** it throws `Missing value for --provider` (empty value never accepted).

---

### User Story 3 - Repetition fails, never last-wins (Priority: P2)

A user writes `--provider` twice and gets `Too many occurrences of --provider` — the loop never silently keeps the last one.

**Why this priority**: `max 1` is a typo catcher. Silent last-wins would hide a duplicated flag.

**Independent Test**: `scanArgv(["ask", "--provider", "a", "--provider", "b", "Hi"], ...)` throws `Too many occurrences of --provider` with the command's help block, exit 2.

**Acceptance Scenarios**:

1. **Given** `min 0, max 1`, **When** the user repeats `--provider`, **Then** the second occurrence throws immediately, exit 2.

---

### Edge Cases

- The value as written IS the provider id, used as-is. Whether it is known is decided later by the existing unknown-provider check, not by this definition.
- Detaching this option (remove the reference from the command's `options` list plus its lines from that command's verbatim `help` block) makes `--provider` / `-p` fall into the loop's unknown-option error and removes its help lines.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The definition MUST be exactly: `{ name: "--provider", alias: "-p", arity: 1, min: 0, max: 1 }`. No other option may claim these spellings.
- **FR-002**: There is NO reader function. All spelling forms (`--provider v`, `--provider=v`, `-p v`) and all value errors are owned by the loop per 002 (fixed arity, `=` without spaces, missing/empty value rules). This spec adds no scanning behavior.
- **FR-003**: A missing value (flag is the last token, next token starts with `-` or is empty, or `=` form has an empty suffix) MUST surface as `Missing value for --provider` with the FR-017 help block, exit 2. An empty value MUST never be accepted.
- **FR-004**: Repetition MUST surface as `Too many occurrences of --provider` with the FR-017 help block, exit 2 (loop FR-009). Silent last-wins is FORBIDDEN for this option.
- **FR-005**: The value MUST be stored as-is. Provider-id validity is out of scope (decided later by the existing unknown-provider check).
- **FR-006**: The definition MUST be accompanied by its help fragment (`providerHelp`), which the owning command's verbatim `help` block includes exactly while the option is attached and drops when detached.
- **FR-007**: Commands MUST reference this definition, never copy it. If a second command needs a different shape (different arity or bounds), that is a different definition, not this one.

### Key Entities

- **Provider option** (`src/providerArg.ts`): `providerOption: Option` (`--provider` / `-p` / arity 1 / `min 0, max 1`) plus `providerHelp: string[]`. Self-contained; imports only the `Option` type.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All four User Story 1 scenarios hold (long, short, `=`, unregistered command rejects).
- **SC-002**: All three User Story 2 scenarios throw the missing-value error naming `--provider`.
- **SC-003**: Repeated `--provider` throws the too-many error; last-wins never happens.

## Assumptions

- Loop mechanics (single scan, activation, arity, occurrence bounds, unknown-option error, help-with-error) live in `002-argument-readers` and are not repeated here.
- The value may be any non-empty string; catalog membership is checked downstream.
