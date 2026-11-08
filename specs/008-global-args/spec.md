# Feature Specification: Global Command-Line Arguments

**Feature Branch**: `008-global-args`

**Created**: 2026-11-08

**Status**: Draft

**Parent**: `specs/002-argument-readers/spec.md` (FR-001: scan is fed global args + command table; only globals valid before a command word).

## Input

Enumerate the global command-line arguments — flags and options valid before any command word, with one uniform shape across all commands. `--help` / `-h` is NOT listed here: it is a loop rule in 002 (FR-007), never declared in any defs list.

## Globals Table

| Spelling | Kind | Repeatable | Meaning |
|----------|------|------------|---------|
| `--provider` / `-p` | option | `false` | Provider id (default: openrouter) |
| `--key` / `-k` | option | `false` | Key, or its source: literal, `env:NAME`, `env`, `file:PATH`, `dotenv:PATH[?VAR=NAME]`, `keychain[:SERVICE[:ACCOUNT]]`. Absent → implicit chain (`{PROVIDER}_API_KEY` from env, `./.env`, `~/.env`, OS keychain). |
| `--model` / `-m` | option | `false` | Model id (default: first in provider catalog) |

`--help` / `-h` works globally but is owned by the loop (002 FR-007), not by this table.

## User Scenarios & Testing

### User Story 1 - Globals work before and after a command (Priority: P1)

`--provider`, `--key`, `--model` are valid before any command word and after it, with identical shape everywhere. No command redeclares them.

**Acceptance Scenarios**:

1. **Given** the globals table above, **When** the user runs `dchat --provider faux ask "Hi"` or `dchat ask --provider faux "Hi"`, **Then** both parse identically.
2. **Given** `--help` (loop rule), **When** the user runs `dchat --help`, **Then** general help prints to stdout, exit 0.

### User Story 2 - Adding a global keeps one shape everywhere (Priority: P2)

A future global (e.g. a `--verbose` flag or a shared `--provider` option) is added once to this table and is then valid before any command and after every command word, with identical spellings and identical `repeatable` everywhere. No command may redeclare it with a different shape.

**Acceptance Scenarios**:

1. **Given** a global flag `--verbose` / `-V` in this table, **When** the user runs `dchat --verbose ask "Hi"` or `dchat ask --verbose "Hi"`, **Then** both parse identically.
2. **Given** a global in this table, **When** a command lists the same spelling in its own `defs` with a different shape, **Then** registration is rejected (duplicate spelling).

## Requirements

- **FR-001**: The global list is `globals: Def[]` using the 002 `Def` type (`{ kind: "flag"; def: Flag } | { kind: "option"; def: Option }`). `Flag` and `Option` stay clean; `kind` lives only in the wrapper.
- **FR-002**: `--help` / `-h` MUST NOT appear in this table. It is a loop rule (002 FR-007), always active, stops the scan, prints to stdout, exit 0.
- **FR-003**: Before any command word ONLY this list (plus the help rule) is accepted. A command-owned spelling before its word fails immediately, never buffered.
- **FR-004**: A global keeps one shape everywhere: same long form, same alias, same `repeatable` (for options). A command MUST NOT redeclare a global spelling with a different shape; within one command no two defs (own + global) may claim the same spelling.
- **FR-005**: `repeatable: false` (options) and any flag repeated → `Too many occurrences` error, exit 2. `repeatable: true` accumulates values in order into the single `options` map (`Record<string, boolean | string[]>` per 002).
- **FR-006**: Adding or removing a row here is the only edit needed to change what is valid before a command word. Detaching a global removes its spellings everywhere at once.

## Success Criteria

- **SC-001**: Each global is valid before and after every command with identical shape; `--help` / `-h` works without being listed.
- **SC-002**: Any future row added here is valid before and after every command without touching command defs.

## Assumptions

- The three globals are options, all `repeatable: false`: a second occurrence fails as too-many (002 FR-005).
- Value-form parsing (`--key` spec forms) and interpretation belong to handlers and follow-up specs, never to the scan.
