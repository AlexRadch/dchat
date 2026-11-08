# Implementation Plan: Argument Readers — Grammar Contract, Types, Stub Scan

**Branch**: `002-argument-readers` | **Date**: 2026-11-08 | **Spec**: [spec.md](./spec.md) + [008-global-args](../008-global-args/spec.md)

**Input**: Feature specification from `/specs/002-argument-readers/spec.md` (rewritten: grammar is the contract; Flag/Option/Def/Command types; globals + command table; help is a loop rule)

## Summary

Build the shared Flag/Option/Def/Command types in `src/args.ts` and the global args list in `src/globals.ts` (spec 008: `--provider` / `--key` / `--model`). Full scan loop arrives with the ask-command spec — until then `scanArgv` is a stub returning general help, and the entry point prints usage. `--help` / `-h` is a loop rule, never declared. No commands registered yet; only globals + help work.

## Technical Context

**Language/Version**: TypeScript strict, ESM (`type: module`, NodeNext), Node 22+; run via `tsx`

**Primary Dependencies**: No new dependencies. Existing `pi-*` packages and `keytar` untouched.

**Storage**: N/A (no storage involved; pure argv transformation)

**Testing**: `tsx --test tests/*.test.ts`, `tsc --noEmit`

**Target Platform**: CLI, one-shot (ask → print answer → exit)

**Project Type**: cli

**Performance Goals**: N/A (one linear scan over a short argv).

**Constraints**: ADR-002 — no IoC container; composition via plain function calls in the entry point. Exit codes stay 0/1/2. Constitution V — no key-handling changes; `keys.ts` untouched. Parked code is commented, never deleted.

**Scale/Scope**: `src/args.ts` types + stub `scanArgv` (this plan) + `src/globalArgs.ts` globals (spec 008). Full scan loop arrives with the ask-command spec. No new deps, no config files.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- I. English-Only: all new code, comments, tests, spec artifacts in English. PASS.
- II. Spec-Driven: spec `002-argument-readers` rewritten (grammar is the contract; Flag/Option/Def/Command types); globals in spec 008; plan + tasks before code; short path (clarify/checklist/analyze skipped — mechanics agreed directly, no open questions). PASS.
- III. Test-First: full scan loop arrives with the ask-command spec (no commands to debug against yet). `tests/cliArgs.test.ts` removed with the stub; `npm test` + `npm run typecheck` green before review. PASS (planned).
- IV. Simplicity/CLI: one types file + one globals file, stub scan, no new deps/config/processes; ask parked (commented, not deleted); stdout/stderr/exit contract for help unchanged. PASS.
- V. Secrets: key resolution untouched (`keys.ts` as-is); tests use plain strings, never real keys. PASS.

## Design

### Types (`src/args.ts` — this plan)

- `Flag = { name: string; alias: string }` — zero values, never repeats.
- `Option = { name: string; alias: string; repeatable: boolean }` — exactly one value per occurrence.
- `Def = { kind: "flag"; def: Flag } | { kind: "option"; def: Option }` — `kind` lives only in the wrapper; types stay clean.
- `Command = { name: string; defs: Def[]; help: string }` — word + own defs + verbatim help block.
- Parse result: `options: Record<string, boolean | string[]>` — flag → `boolean`, option → `string[]` (single-shot one element, repeatable accumulates).
- Globals: `GLOBAL_ARGS: Def[]` in `src/globalArgs.ts` (spec 008) — fed to the scan before any command word.
- Command registrations reference shared definitions, never copy them.

### Globals (`src/globalArgs.ts`, spec 008 — this plan)

- `GLOBAL_ARGS` holds the three global command-line arguments for commands: `--provider` / `-p`, `--key` / `-k`, `--model` / `-m` (all options, `repeatable: false`).
- The entry point passes `GLOBAL_ARGS` as the scan's globals; `--help` / `-h` is never listed (loop rule, 002 FR-007).

### Entry point loop (`src/chat.ts` — STUB until the ask-command spec)

- The loop is fed two lists: global args (`GLOBAL_ARGS`) and `Command[]`. No option or command string remains in loop logic.
- Full scan arrives with the ask-command spec (no commands to debug against yet). Until then `scanArgv` is a stub returning general help, and the entry point prints usage.
- `--help` / `-h` is a loop rule (002 FR-007), never declared in any defs list; the stub returns `{ help: generalHelp }`.
- No defaults in the loop: missing values are filled by the handler after dispatch.

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
├── chat.ts               # entry point: stub scan + inline help, zero option/command names in logic
├── args.ts               # Flag / Option / Def / Command types + stub scanArgv
├── globalArgs.ts         # NEW (spec 008): GLOBAL_ARGS — the three global options
├── keys.ts               # unchanged
├── standardProviders.ts  # unchanged
└── fauxProvider.ts       # unchanged

tests/
├── keys.test.ts          # unchanged
└── providers.test.ts     # unchanged
```

**Structure Decision**: Single-project CLI layout, unchanged. The entry point's
two registration lists ARE the loop's data; reader files stay self-contained
so each detaches by removing one reference line. One shared types module
(`args.ts`) — no other shared parsing module.

## Complexity Tracking

> No constitution violations. No entries.
