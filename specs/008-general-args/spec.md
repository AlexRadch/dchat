# Feature Specification: General Command-Line Arguments

**Feature Branch**: `008-general-args`

**Created**: 2026-11-08

**Status**: Draft (rewritten 2026-11-09: help is a plain general entry, not a loop rule)

**Parent**: `specs/002-argument-readers/spec.md` (FR-001: scan is fed generals + command table; only generals valid before a command word).

## Input

Enumerate the general command-line arguments — flags and options valid before any command word, with one uniform shape across all commands. Each entry carries a `global` marker: `global: true` stays visible after a command word, `global: false` is valid only before it. `--help` / `-h` IS listed here: a plain `helpFlag` entry (`global: true`), no loop rule owns it.

## Generals Table

| Spelling | Kind | Export | Repeatable | Global | Meaning |
|----------|------|--------|------------|--------|---------|
| `--provider` / `-p` | option | `providerOption` | `false` | `false` | Provider id (default: openrouter) |
| `--key` / `-k` | option | `keyOption` | `false` | `false` | Key, or its source: literal, `env:NAME`, `env`, `file:PATH`, `dotenv:PATH[?VAR=NAME]`, `keychain[:SERVICE[:ACCOUNT]]`. Absent → implicit chain (`{PROVIDER}_API_KEY` from env, `./.env`, `~/.env`, OS keychain). |
| `--model` / `-m` | option | `modelOption` | `false` | `false` | Model id (default: first in provider catalog) |
| `--help` / `-h` | flag | `helpFlag` | `false` | `true` | Help request (meaning owned by the entry point, not the scan) |

## User Scenarios & Testing

### User Story 1 - Generals work before a command; globals also after (Priority: P1)

`--provider`, `--key`, `--model` are valid before any command word; a command that needs them references them (otherwise unknown after the word). `--help` (`global: true`) is valid before any word and after every word. No command redeclares spellings it references.

**Acceptance Scenarios**:

1. **Given** the generals table above, **When** the user runs `dchat --provider faux ask "Hi"` (with `ask` referencing `providerOption`), **Then** it parses; `dchat --provider faux` (no word) also scans fine as `no-command` facts.
2. **Given** `helpFlag` (`global: true`), **When** the user runs `dchat --help` or `dchat ask --help`, **Then** the scan carries the flag through (`general-help` no — the `run`/`no-command` arm carries `argValues` with the flag set); the entry point prints the block, exit 0.
3. **Given** `--provider` (`global: false`), **When** the user runs `dchat ask --provider faux "Hi"` and `ask` does NOT reference it, **Then** it fails as unknown option, exit 2 — even though the spelling exists in generals.

### User Story 2 - Adding a general keeps one shape everywhere (Priority: P2)

A future general (e.g. a `--verbose` flag) is added once to this table; `global: true` makes it valid after every word, `global: false` keeps it valid only before any word. A command that needs a non-global general references the exported entry. Contradictory shapes (same spelling, different rules before/after) are the caller's business: the scan acts dumb per 002.

**Acceptance Scenarios**:

1. **Given** a general flag `--verbose` / `-V` in this table with `global: true`, **When** the user runs `dchat --verbose ask "Hi"` or `dchat ask --verbose "Hi"`, **Then** both parse identically.
2. **Given** a general in this table, **When** a command lists the same spelling in its own `defs` as a different object, **Then** the command's entry wins after its word (fallback order per 002); before the word the general entry applies.

## Requirements

- **FR-001**: The general list is `GENERAL_ARGS: ArgDef[]` in `src/generalArgs.ts` using the 002 `ArgDef` type (`{ kind: "flag"; def: Flag; global: boolean } | { kind: "option"; def: Option; global: boolean }`). `Flag` and `Option` stay clean; `kind` and `global` live only in the wrapper. Today: three options (`providerOption`: `--provider` / `-p`, `keyOption`: `--key` / `-k`, `modelOption`: `--model` / `-m`, all `repeatable: false`, `global: false`) plus one flag (`helpFlag`: `--help` / `-h`, `global: true`). Each entry is exported individually; `GENERAL_ARGS` is the array of the four entries. Commands reference entries, never copy spellings.
- **FR-002**: `helpFlag` is a plain general entry (`kind: "flag"`, `global: true`), owned by NOBODY special. The scan treats it like any flag (repeat rules, `=` error, after `--` is text); the entry point gives it meaning (block + exit 0). No loop rule, no hard-coded `--help` spelling in 002.
- **FR-003**: Before any command word ONLY this list is accepted. A command-owned spelling before its word fails immediately, never buffered.
- **FR-004**: After a command word the scan looks up the command's own `defs` first, then the generals filtered to `global: true`. A command that needs a non-global general references the exported entry; the same entry object referenced in both places is one rule, not a contradiction. A DIFFERENT object with the same spelling in a command's `defs` wins after its word (fallback order); before the word the general entry applies. The scan never compares the two shapes — dumb algorithm per 002.
- **FR-005**: `repeatable: false` (options) and any flag repeated → `Too many occurrences` error, exit 2. Same for `helpFlag`: `--help --help` fails like any repeated flag. `repeatable: true` accumulates values in order into the single `argValues` map (`ArgValues` per 002).
- **FR-006**: Adding or removing a row here is the only edit needed to change what is valid before a command word. Detaching a general removes its spellings at once (before the word always; after the word wherever it was visible).

## Success Criteria

- **SC-001**: Each general is valid before every command; each `global: true` entry is additionally valid after every word. Non-global generals need a reference in the command's `defs` to work after its word.
- **SC-002**: Any future row added here is valid before every word without touching command defs; `global: true` extends it after every word.

## Assumptions

- The three non-global generals are options, all `repeatable: false`: a second occurrence fails as too-many (002 FR-005). `helpFlag` is a single-shot flag like any other.
- Value-form parsing (`--key` spec forms) and interpretation belong to handlers and follow-up specs, never to the scan.
