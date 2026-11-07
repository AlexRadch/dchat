# Feature Specification: Provider Components

**Feature Branch**: `001-provider-components`

**Created**: 2026-11-07

**Status**: Draft

**Input**: User description: "Split provider assembly out of the entry point into components: one function returning the standard providers, one adding the faux test provider. The entry point only calls both; provider imports leave the entry point."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ask via a standard provider (Priority: P1)

A user asks one question through a standard provider (e.g. openrouter) with a valid key and gets the answer on stdout, exit code 0.

**Why this priority**: This is the product. If the standard path breaks, nothing works.

**Independent Test**: Run `dchat ask --key <valid-key> "Hi"` and check stdout holds the answer and exit code is 0.

**Acceptance Scenarios**:

1. **Given** a valid key for a standard provider, **When** the user runs `dchat ask "Hi"`, **Then** stdout holds the model answer and exit code is 0.
2. **Given** an unknown provider id, **When** the user runs `dchat ask --provider nope "Hi"`, **Then** stderr names the unknown provider with known ids and exit code is 2.

---

### User Story 2 - Ask via the faux test provider (Priority: P2)

A developer smoke-tests without a key or network via the faux provider and gets the echoed question back.

**Why this priority**: Keyless local verification; keeps tests and demos independent of providers and network.

**Independent Test**: Run `dchat ask --provider faux "Hi"` and check stdout echoes the question, exit code 0.

**Acceptance Scenarios**:

1. **Given** no key and no network, **When** the user runs `dchat ask --provider faux "Hi"`, **Then** stdout echoes the question and exit code is 0.

---

### Edge Cases

- No question text (neither argument nor stdin): stderr explains, exit code 2.
- Unknown provider: stderr lists known ids, exit code 2. Known ids still include faux plus the standard set.
- Provider with no models in catalog and no explicit `--model`: stderr explains, exit code 2.
- Missing required key for a real provider: existing key-resolution error, exit code 2.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The entry point MUST NOT import provider implementations directly; it MUST obtain provider arrays through component calls only.
- **FR-002**: Every provider component MUST share one shape: it takes `credentials` and `authContext` as two plain arguments and returns only its own provider array. No component may assume another component's needs — a test component takes the same inputs as a real one, even if it ignores them today. No wrapper objects for a handful of args.
- **FR-003**: No component may register itself into the shared models object. Each component only returns its own array; the entry point adds every returned array to the models object itself, the same way for all components.
- **FR-004**: The faux test component teaches its provider to echo at creation (via a response factory over the transcript), so no caller ever prepares answers. The entry point MUST NOT touch provider handles, messages, or model ids directly.
- **FR-005**: The standard-providers component MUST live in its own file and MUST be the only place importing the standard provider implementations.
- **FR-006**: The faux-provider component MUST live in its own file and MUST be the only place (besides its tests) importing the faux provider implementation.
- **FR-007**: All existing CLI behavior MUST stay unchanged: commands, flags, help text, stdout/stderr contract, and exit codes (0 answer, 2 usage/config, 1 unanswered).
- **FR-008**: The known-provider list in the unknown-provider error MUST still include faux plus every standard provider.

### Key Entities

- **Provider component**: takes `credentials` and `authContext` as two plain arguments, returns its own provider array. Never touches the shared models object. Both components share this shape.
- **Standard providers component**: returns the standard array; owns standard imports.
- **Faux provider component**: returns the test array (one entry today, may grow); owns faux imports and the echo response factory.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user asking via a standard provider gets an answer on stdout with exit code 0, exactly as before the split.
- **SC-002**: A developer smoke-tests keyless via faux and gets the echo with exit code 0, exactly as before the split.
- **SC-003**: The entry point holds zero provider-implementation imports (verified by inspection).
- **SC-004**: `npm test` and `npm run typecheck` are both green after the split.

## Assumptions

- The standard provider set is whatever `builtinModels` provides today; the split moves it, not changes it.
- No new providers, flags, or config are added by this feature.
- ADR-001 (pi-durable + TypeScript) and ADR-002 (dependencies via function arguments) still hold; this feature composes under them.
