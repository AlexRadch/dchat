# Feature Specification: Model Argument Reader

**Feature Branch**: `005-model-arg`

**Created**: 2026-11-07

**Status**: Draft

**Input**: User description: "Lazy first-token reader for the model option: owns --model spellings and help lines, consumes at most one occurrence per pass of the argument-processing loop. Detachable by deleting its file, import, call line, and help spread."

**Parent**: `specs/002-argument-readers/spec.md` (argument-processing loop mechanics: FR-003 lazy strategy allowed, FR-004 argument-processing loop; this spec fixes one reader's spellings and strategy).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Model flag is read lazily (Priority: P1)

A user passes `--model` anywhere in the command line and the reader consumes it, returning the model id and the remainder. Any token list not starting with the model flag passes through unchanged.

**Why this priority**: This is the reader's only job. Without it the model cannot be set from the command line.

**Independent Test**: Call `readModelArg(["--model", "gpt-5-mini", "Hi"])` and check `{ model: "gpt-5-mini", rest: ["Hi"] }`; call `readModelArg(["--provider", "faux", "Hi"])` and check the input comes back unchanged with `model: undefined`.

**Acceptance Scenarios**:

1. **Given** tokens `["--model", "gpt-5-mini", "Hi"]`, **When** the reader processes them, **Then** it returns `model: "gpt-5-mini"` and `rest: ["Hi"]`.
2. **Given** tokens `["-m", "gpt-5-mini", "Hi"]`, **When** the reader processes them, **Then** it returns `model: "gpt-5-mini"` and `rest: ["Hi"]` (short alias works).
3. **Given** tokens `["--model=gpt-5-mini", "Hi"]`, **When** the reader processes them, **Then** it returns `model: "gpt-5-mini"` and `rest: ["Hi"]` (`=` form works).
4. **Given** tokens `["--provider", "faux", "Hi"]`, **When** the reader processes them, **Then** it returns `model: undefined` and the tokens unchanged (not its flag).

---

### User Story 2 - Missing value fails loudly (Priority: P2)

A user writes the flag without a value and gets a clear error naming the option instead of a silent empty model.

**Why this priority**: A silent empty model id would fail later with a confusing model error. Failing at the flag names the real mistake.

**Independent Test**: Call the reader on `["--model"]`, `["--model", "--key", "x"]`, and `["--model="]`; each throws `Missing value for --model`.

**Acceptance Scenarios**:

1. **Given** tokens `["--model"]`, **When** the reader processes them, **Then** it throws `Missing value for --model` (exit 2 at the entry point).
2. **Given** tokens `["--model", "--key", "x"]`, **When** the reader processes them, **Then** it throws `Missing value for --model` (an option is never a value).
3. **Given** tokens `["--model="]`, **When** the reader processes them, **Then** it throws `Missing value for --model` (empty value never accepted).

---

### Edge Cases

- The same flag repeated across passes: last occurrence wins (a later pass overwrites the stored value).
- The value as written IS the model id, used as-is. Whether it exists in the catalog is decided later, not by this reader.
- Detaching this reader (delete file + import + call line + help spread) makes `--model` / `-m` fall into the argument-processing loop's unknown-option error and removes its help lines.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The reader MUST own its option spellings exclusively: `--model`, `--model=<v>`, `-m`. No other reader may claim these spellings.
- **FR-002**: The reader MUST use the lazy strategy: inspect only the leading token. If the first token is `--model` or `-m`, consume it plus the next token as the value. If the first token starts with `--model=`, consume it and take the suffix as the value. Otherwise return the input unchanged with `model: undefined`.
- **FR-003**: A missing value (flag is the last token, next token starts with `-` or is empty, or `=` form has an empty suffix) MUST throw `Error("Missing value for --model. ...")` with the same hint suffix as the other readers. An empty value MUST never be accepted.
- **FR-004**: The reader MUST return a new remainder (input minus the consumed pair, order preserved) and MUST NOT mutate the input.
- **FR-005**: The reader MUST store the value as-is. Model validity is out of scope.
- **FR-006**: The reader MUST contribute its own help lines (`modelHelp`), so `ask --help` describes it exactly while attached and drops it when detached.
- **FR-007**: Per call the reader consumes at most one occurrence. Repetition across passes of the argument-processing loop resolves to last-wins.

### Key Entities

- **Model reader** (`src/modelArg.ts`): `readModelArg(tokens)` → `{ model?, rest }` plus `modelHelp: string[]`. Self-contained; imports nothing from other readers.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All four User Story 1 scenarios hold (long, short, `=`, foreign flag untouched).
- **SC-002**: All three User Story 2 scenarios throw the missing-value error.
- **SC-003**: Reader consumes at most one occurrence per call; repeated flags resolve last-wins across passes.

## Assumptions

- Argument-processing loop mechanics (pass order, shrink-to-continue, unknown-option error) live in `002-argument-readers` and are not repeated here.
- The value may be any non-empty string; catalog membership is checked downstream.
