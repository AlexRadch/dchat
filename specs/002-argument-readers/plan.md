# Implementation Plan: Argument Readers — Grammar Contract, Types, Real Scan

**Branch**: `002-argument-readers` | **Date**: 2026-11-08 | **Spec**: [spec.md](./spec.md) + [008-global-args](../008-global-args/spec.md)

**Input**: Feature specification from `/specs/002-argument-readers/spec.md` (rewritten: grammar is the contract; Flag/Option/Def/Command types; globals + command table; help is a loop rule)

## Summary

Build the shared Flag/Option/Def/Command types in `src/args.ts`, the global args list in `src/globalArgs.ts` (spec 008), and the real single-pass `scanArgv` loop per the 002 grammar — testable standalone on fake defs, independent of any command. `--help` / `-h` is a loop rule, never declared.

## Technical Context

**Language/Version**: TypeScript strict, ESM (`type: module`, NodeNext), Node 22+; run via `tsx`

**Primary Dependencies**: No new dependencies. Existing `pi-*` packages and `keytar` untouched.

**Storage**: N/A (no storage involved; pure argv transformation)

**Testing**: `tsx --test tests/*.test.ts`, `tsc --noEmit`

**Target Platform**: CLI, one-shot (ask → print answer → exit)

**Project Type**: cli

**Performance Goals**: N/A (one linear scan over a short argv).

**Constraints**: ADR-002 — no IoC container; composition via plain function calls in the entry point. Exit codes stay 0/1/2. Constitution V — no key-handling changes; `keys.ts` untouched. Parked code is commented, never deleted.

**Scale/Scope**: `src/args.ts` types + real `scanArgv` (this plan) + `src/globalArgs.ts` globals (spec 008) + `tests/scanArgv.test.ts` on fake defs. No new deps, no config files.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- I. English-Only: all new code, comments, tests, spec artifacts in English. PASS.
- II. Spec-Driven: spec `002-argument-readers` rewritten (grammar is the contract; Flag/Option/Def/Command types); globals in spec 008; plan + tasks before code; short path (clarify/checklist/analyze skipped — mechanics agreed directly, no open questions). PASS.
- III. Test-First: `tests/scanArgv.test.ts` drives the real loop on fake defs (flags/options, aliases, repeatable, `--no-`, `=`/glued forms, `--`, four arms incl. `-h` before/after word, help-vs-error either order as `parse-error`, direct arm asserts, no help text anywhere); `npm test` + `npm run typecheck` green before review. PASS (planned).
- IV. Simplicity/CLI: one types file + one globals file + one loop, no new deps/config/processes; ask execution parked (commented, not deleted); stdout/stderr/exit contract for help unchanged. PASS.
- V. Secrets: key resolution untouched (`keys.ts` as-is); tests use plain strings, never real keys. PASS.

## Design

### Types (`src/args.ts` — this plan)

- `Flag = { name: string; alias: string }` — zero values, never repeats.
- `Option = { name: string; alias: string; repeatable: boolean }` — exactly one value per occurrence.
- `Def = { kind: "flag"; def: Flag } | { kind: "option"; def: Option }` — `kind` lives only in the wrapper; types stay clean.
- `Command = { name: string; defs: Def[] }` — word + own defs. Scan-scoped: no `help`, no `run` (Scope).
- Scan payloads carry `params: string[]` — always an array, possibly empty; the scan never joins chunks, joining is the command's job.
- Parse result: discriminated union `ScanResult = GeneralHelp | CommandHelp | Run | ParseFailure` — `general-help` (`{ kind; options }`, seen before any word), `command-help` (`{ kind; command; options; params }`, command known), `run` (`{ kind; command?; options; params }`, no help requested — handler runs), `parse-error` (`{ kind; message; exitCode; command? }` — expected input failure, no help text; ADR-004, entry point restores the block). No arm carries help text: the entry point restores the block (`command ?` its block `: general`) and prints `message + "\n\n" + block` on stderr for errors, the block alone on stdout for helps. Each arm carries only what it needs (`options` everywhere except the error arm; `command` only where resolved). Declared with `interface`s (plain structural shapes, erased at runtime — the C# `record` equivalent, not `class`: no behaviour or identity travels, the `kind` string already discriminates).
- Globals: `GLOBAL_ARGS: Def[]` in `src/globalArgs.ts` (spec 008) — fed to the scan before any command word.
- Command registrations reference shared definitions, never copy them.

### Globals (`src/globalArgs.ts`, spec 008 — this plan)

- `GLOBAL_ARGS` holds the three global command-line arguments for commands: `--provider` / `-p`, `--key` / `-k`, `--model` / `-m` (all options, `repeatable: false`).
- The entry point passes `GLOBAL_ARGS` as the scan's globals; `--help` / `-h` is never listed (loop rule, 002 FR-007).

### Entry point loop (`src/args.ts` — real scan, this plan)

- One left-to-right pass over `argv`, fed `globals: Def[]` + `commands: Command[]`. Before any command word ONLY globals (+ help rule) are valid; after the word, that command's `defs` (+ globals) plus plains.
- `--help` / `-h` is remembered, not terminal: already-parsed `options`/`text` and any resolved command are kept, the scan continues — later tokens may still fail (an error always beats help). After bare `--` it is plain text. `--help=x` → unexpected-value; `--no-help` → unknown-option. `-h ask` ≡ `ask -h` → same `command-help`.
- Flag: zero values, `=` always error, second occurrence → too-many (`-h` repeat harmless — help needs no `counts` entry). `--no-<name>` is a separate spelled flag writing `false` to the same key.
- Option: exactly one value (apart / `--o=v` / `-ovalue`); `-o=value` is an error; missing/empty/`-`-next → missing-value; help beside an option never fills its value slot. `repeatable: false` second occurrence → too-many; `true` accumulates in order.
- Result arms: `general-help` / `command-help` / `run` / `parse-error` as above (no help text in any arm); the entry point switches on `kind` — help arms restore the block (`command ?` its block `: general`) and print it to stdout exit 0, `run` dispatches to the handler, `parse-error` prints `message + "\n\n" + block` to stderr with its exit code. No `try/catch` for the normal path (ADR-004); exceptions stay for the unexpected only.
- Errors carry the resolved word (`command?`) + exit code (unknown command → 1, rest → 2), never help text; empty `argv` → general help on stderr, exit 2 (entry point).

### What stays parked (commented, not deleted)

The whole `ask` execution path: ask routing, defaulting, key resolution, harness flow. Parked code stays in `chat.ts` under a `PARKED (ask)` marker so the ask spec can re-enable it without rewriting. `keys.ts`, `standardProviders.ts`, `fauxProvider.ts` untouched.

## Project Structure

### Documentation (this feature)

```text
specs/002-argument-readers/
├── spec.md               # Grammar contract, Flag/Option/Def/Command types (source of truth)
├── plan.md               # This file
└── tasks.md              # Ordered implementation steps
specs/008-global-args/
└── spec.md               # Global command-line arguments for commands (this plan fills GLOBAL_ARGS)
```

### Source Code (repository root)

```text
src/
├── chat.ts               # entry point: real scan + inline help, zero option/command names in logic
├── args.ts               # Flag / Option / Def / Command types + real scanArgv
├── globalArgs.ts         # NEW (spec 008): GLOBAL_ARGS — the three global options
├── keys.ts               # unchanged
├── standardProviders.ts  # unchanged
└── fauxProvider.ts       # unchanged

tests/
├── scanArgv.test.ts      # NEW: real loop on fake defs incl. union arms (-h before/after word, help-vs-error)
├── keys.test.ts          # unchanged
└── providers.test.ts     # unchanged
```

**Structure Decision**: Single-project CLI layout, unchanged. The entry point's
two registration lists ARE the loop's data; reader files stay self-contained
so each detaches by removing one reference line. One shared types module
(`args.ts`) — no other shared parsing module.

## Complexity Tracking

> No constitution violations. No entries.
