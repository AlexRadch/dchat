# Feature Specification: Key Spec Handoff

**Feature Branch**: `007-key-spec`

**Created**: 2026-11-08

**Status**: Draft

**Input**: User description: "Spec for keys.ts — only the command-line input side: how the raw --key string reaches key resolution. Value-form parsing (env:/file:/dotenv:/keychain:) is out of scope."

**Parent**: `specs/002-argument-readers/spec.md` (options arrive as `Record<string, string[]>`); `specs/004-key-arg/spec.md` (the `--key` option definition: arity 1, `min 0, max 1`).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Explicit --key reaches resolution unchanged (Priority: P1)

A user passes `--key <SPEC>` and the command handler forwards that exact string to key resolution. The handoff layer never trims, lowercases, splits, or interprets it.

**Why this priority**: This is the whole contract. Any mangling here turns a valid spec into a mystery miss downstream.

**Independent Test**: Handler receives `options = { "--key": ["env:MY_KEY"] }`, calls `resolveKey(src, { provider: "openrouter", keySpec: "env:MY_KEY" })` — the string arrives byte-for-byte.

**Acceptance Scenarios**:

1. **Given** `options["--key"] == ["sk-or-..."]`, **When** the handler builds the `resolveKey` input, **Then** `keySpec` is exactly `"sk-or-..."`.
2. **Given** `options["--key"] == ["  sk-123  "]` (leading/trailing spaces), **When** the handler builds the input, **Then** `keySpec` keeps the spaces as-is — no trimming at this layer.
3. **Given** any `SPEC` containing `:`, `=`, `/`, or `?` characters, **When** the handler builds the input, **Then** the string passes through untouched — prefix parsing lives downstream, not here.

---

### User Story 2 - Absent --key means undefined, not empty (Priority: P1)

A user passes no `--key` and the handler forwards `keySpec: undefined` — never `""`, never a default string. Absence selects the implicit chain inside resolution.

**Why this priority**: Empty-string-vs-absent confusion would send the implicit lookup down the explicit-missing path and error on users who set nothing.

**Independent Test**: Handler receives `options = {}`, calls `resolveKey(src, { provider: "openrouter", keySpec: undefined })`.

**Acceptance Scenarios**:

1. **Given** no `--key` in `options`, **When** the handler builds the `resolveKey` input, **Then** `keySpec` is `undefined`.
2. **Given** no `--key`, **When** resolution runs, **Then** it follows the implicit path (provider env var, dotenv files, OS keychain) — that path's internals are out of scope here.

---

### User Story 3 - Explicit source that yields nothing is an error naming the spec (Priority: P2)

A user passes `--key env:NOPE` where `NOPE` is unset, and gets `Key source yielded no key: env:NOPE` on stderr, exit 2 — not a silent unauthenticated request.

**Why this priority**: A silent fallthrough would burn a network call that fails far from its cause. Failing at the spec names the real mistake.

**Independent Test**: `resolveKey(src(), { provider: "o", keySpec: "env:NOPE" })` returns `{ key: undefined, missing: true }`; the handler prints `Key source yielded no key: env:NOPE` to stderr and exits 2.

**Acceptance Scenarios**:

1. **Given** `missing: true` from resolution, **When** the handler continues, **Then** it prints `Key source yielded no key: <SPEC>` (the exact spec echoed back) to stderr and exits 2.
2. **Given** `missing: false` with `key: undefined` (e.g. faux or no implicit key found), **When** the handler continues, **Then** it does NOT print the missing error — absence without an explicit spec is not a failure at this layer.

---

### Edge Cases

- Repetition cannot reach this layer: `--key` is `max 1`, so the loop throws before the handler on a second occurrence. The handler reads element `[0]` only and MUST NOT join the array.
- `keySpec` is opaque here: literal vs `env:` vs `file:` vs `dotenv:` vs `keychain:` distinctions are downstream internals, explicitly out of scope.
- Where the implicit chain looks (env name shape, dotenv paths, keychain service/account) is out of scope.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The handler MUST take the spec from exactly `options["--key"]?.[0]` — the first (and, per `max 1`, only) collected element. No other option tag, no other index.
- **FR-002**: The handler MUST forward the string byte-for-byte into `resolveKey(src, { provider, keySpec })`. No trimming, no case change, no splitting, no prefix inspection at this layer.
- **FR-003**: Absent `--key` MUST map to `keySpec: undefined` — never `""`, never a placeholder. The `undefined` selects the implicit path inside resolution.
- **FR-004**: The handler MUST NOT join or concatenate: with `max 1` there is at most one element, and `[0]` is the whole input.
- **FR-005**: On `missing: true` the handler MUST print `Key source yielded no key: <SPEC>` (exact spec echoed) to stderr and exit 2. On `missing: false` it MUST NOT print this error, even when `key` is `undefined`.
- **FR-006**: This spec defines ONLY the handoff. SPEC-form parsing (`env:` / `env` / `file:` / `dotenv:` / `keychain:` / literal), `KeySources` injection, dotenv-file lookup order, `stdEnvName`, and the implicit priority chain are explicitly OUT OF SCOPE — they live in `src/keys.ts` un-spec'd until a follow-up spec covers them.

### Key Entities

- **keySpec**: the opaque `string | undefined` flowing from `options["--key"]?.[0]` into `resolveKey(src, { provider, keySpec })`. Narrowest type at this layer: `string | undefined`. No parsing, no validation.
- **missing flag**: `resolveKey`'s verdict — `true` means "explicit spec given but yielded nothing" (handler errors per FR-005); `false` means "proceed, even keyless".

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `--key env:MY_KEY` arrives at `resolveKey` as exactly `"env:MY_KEY"`; `-k` and `--key=` forms arrive identically (loop-owned per 002/004).
- **SC-002**: No `--key` arrives as `undefined`, selecting the implicit path — never `""`.
- **SC-003**: `keySpec: "env:NOPE"` (unset) → stderr `Key source yielded no key: env:NOPE`, exit 2. No `--key` with no implicit key → no such error.

## Assumptions

- Loop mechanics (single scan, arity, `min 0, max 1`, missing-value and too-many errors, help-with-error) live in `002-argument-readers` and are not repeated here.
- The `--key` spelling triple and help fragment live in `004-key-arg` and are not repeated here.
- `src/keys.ts` internals (SPEC-form parsing, `KeySources`, dotenv order, keychain defaults, implicit priority) are intentionally un-spec'd; this spec pins only the input boundary so the `ask` command spec can re-enable the parked call.
