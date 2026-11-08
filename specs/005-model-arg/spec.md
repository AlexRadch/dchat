# Feature Specification: Model Option Definition

**Feature Branch**: `005-model-arg`

**Created**: 2026-11-07

**Status**: Draft (rewritten 2026-11-08 — lazy-reader model replaced by a single-scan `Option` definition; no reader function remains)

**Input**: User description: "Model option as one shared `Option` definition: owns `--model` spellings and help lines, referenced (never copied) by every command that accepts it. The loop in 002 owns all scanning; this spec fixes the definition only."

**Parent**: `specs/002-argument-readers/spec.md` (single-scan loop, `Option`/`Command` types, fixed arity, occurrence bounds, loop-owned help; this spec fixes one option's definition).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Model flag is collected by the loop (Priority: P1)

A user passes `--model` anywhere among a command's options and the loop collects it as raw strings under the `--model` tag. The definition itself parses nothing.

**Why this priority**: This is the definition's only job. Without it no command can accept a model from the command line.

**Independent Test**: `scanArgv(["ask", "--model", "gpt-5-mini", "Hi"], [], [askCmd()], GENERAL)` collects `options["--model"] == ["gpt-5-mini"]`; the `-m` and `--model=gpt-5-mini` forms collect the same.

**Acceptance Scenarios**:

1. **Given** the model option registered on the command, **When** the user writes `--model gpt-5-mini`, **Then** the loop stores `["gpt-5-mini"]` under `--model`.
2. **Given** the same registration, **When** the user writes `-m gpt-5-mini`, **Then** the same value is stored under the long name `--model` (short alias works).
3. **Given** the same registration, **When** the user writes `--model=gpt-5-mini`, **Then** the same value is stored (`=` form works).
4. **Given** the model option NOT registered on a command, **When** the user writes `--model x` after that command's word, **Then** the loop fails with `Unknown option: --model` (plus that command's help, exit 2).

---

### User Story 2 - Missing value fails loudly (Priority: P2)

A user writes the flag without a value and gets a clear error naming the option instead of a silent empty model.

**Why this priority**: A silent empty model id would fail later with a confusing model error. Failing at the flag names the real mistake.

**Independent Test**: `scanArgv(["ask", "--model"], ...)`, `scanArgv(["ask", "--model", "--key", "x"], ...)`, and `scanArgv(["ask", "--model="], ...)` each throw `Missing value for --model` with the command's help block, exit 2.

**Acceptance Scenarios**:

1. **Given** `--model` as the last token, **When** the scan runs, **Then** it throws `Missing value for --model` (exit 2 at the entry point).
2. **Given** `--model` followed by another option, **When** the scan runs, **Then** it throws `Missing value for --model` (an option is never a value).
3. **Given** `--model=` with an empty suffix, **When** the scan runs, **Then** it throws `Missing value for --model` (empty value never accepted).

---

### User Story 3 - Repetition fails, never last-wins (Priority: P2)

A user writes `--model` twice and gets `Too many occurrences of --model` — the loop never silently keeps the last one.

**Why this priority**: `max 1` is a typo catcher. Silent last-wins would hide a duplicated flag.

**Independent Test**: `scanArgv(["ask", "--model", "a", "--model", "b", "Hi"], ...)` throws `Too many occurrences of --model` with the command's help block, exit 2.

**Acceptance Scenarios**:

1. **Given** `min 0, max 1`, **When** the user repeats `--model`, **Then** the second occurrence throws immediately, exit 2.

---

### Edge Cases

- The value as written IS the model id, used as-is. Whether it exists in the catalog is decided later, not by this definition.
- Detaching this option (remove the reference from the command's `options` list plus its lines from that command's verbatim `help` block) makes `--model` / `-m` fall into the loop's unknown-option error and removes its help lines.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The definition MUST be exactly: `{ name: "--model", alias: "-m", arity: 1, min: 0, max: 1 }`. No other option may claim these spellings.
- **FR-002**: There is NO reader function. All spelling forms (`--model v`, `--model=v`, `-m v`) and all value errors are owned by the loop per 002 (fixed arity, `=` without spaces, missing/empty value rules). This spec adds no scanning behavior.
- **FR-003**: A missing value (flag is the last token, next token starts with `-` or is empty, or `=` form has an empty suffix) MUST surface as `Missing value for --model` with the FR-017 help block, exit 2. An empty value MUST never be accepted.
- **FR-004**: Repetition MUST surface as `Too many occurrences of --model` with the FR-017 help block, exit 2 (loop FR-009). Silent last-wins is FORBIDDEN for this option.
- **FR-005**: The value MUST be stored as-is. Model validity is out of scope.
- **FR-006**: The definition MUST be accompanied by its help fragment (`modelHelp`), which the owning command's verbatim `help` block includes exactly while the option is attached and drops when detached.
- **FR-007**: Commands MUST reference this definition, never copy it. If a second command needs a different shape (different arity or bounds), that is a different definition, not this one.

### Key Entities

- **Model option** (`src/modelArg.ts`): `modelOption: Option` (`--model` / `-m` / arity 1 / `min 0, max 1`) plus `modelHelp: string[]`. Self-contained; imports only the `Option` type.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All four User Story 1 scenarios hold (long, short, `=`, unregistered command rejects).
- **SC-002**: All three User Story 2 scenarios throw the missing-value error naming `--model`.
- **SC-003**: Repeated `--model` throws the too-many error; last-wins never happens.

## Assumptions

- Loop mechanics (single scan, activation, arity, occurrence bounds, unknown-option error, help-with-error) live in `002-argument-readers` and are not repeated here.
- The value may be any non-empty string; catalog membership is checked downstream.
