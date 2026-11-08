# Implementation Plan: Argument Readers — Single Loop, Types, Parked Ask

**Branch**: `002-argument-readers` | **Date**: 2026-11-07 | **Spec**: [spec.md](./spec.md) + [006-global-help](../006-global-help/spec.md)

**Input**: Feature specification from `/specs/002-argument-readers/spec.md` (amended: single loop, Option/Command types, help owned by loop)

## Summary

Build the single argument-processing loop in `src/chat.ts` fed by two registration lists: global options (`Option[]`) and commands (`Command[]`). Introduce shared `Option`/`Command`/parse-state types in a new `src/args.ts`. Global help (`--help`/`-h`, spec 006) is implemented inline in the loop. The existing `ask` execution path is parked — commented out in place under a marker, NOT deleted — until the `ask` command spec re-enables it. Until then the utility accepts no commands; only global help works.

## Technical Context

**Language/Version**: TypeScript strict, ESM (`type: module`, NodeNext), Node 22+; run via `tsx`

**Primary Dependencies**: No new dependencies. Existing `pi-*` packages and `keytar` untouched.

**Storage**: N/A (no storage involved; pure argv transformation)

**Testing**: `tsx --test tests/*.test.ts`, `tsc --noEmit`

**Target Platform**: CLI, one-shot (ask → print answer → exit)

**Project Type**: cli

**Performance Goals**: N/A (one linear scan over a short argv).

**Constraints**: ADR-002 — no IoC container; composition via plain function calls in the entry point. Exit codes stay 0/1/2. Constitution V — no key-handling changes; `keys.ts` untouched. Parked code is commented, never deleted.

**Scale/Scope**: `src/chat.ts` loop rewrite + new `src/args.ts` (this plan) + inline global help (spec 006). Reader files owned by their own specs: `src/providerArg.ts` (003), `src/keyArg.ts` (004), `src/modelArg.ts` (005) — stay on disk, registration commented out with the parked ask block. No new deps, no config files.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- I. English-Only: all new code, comments, tests, spec artifacts in English. PASS.
- II. Spec-Driven: spec `002-argument-readers` written first, then amended (single loop, Option/Command types, one-token text, verbatim help); global help split into spec 006; plan + tasks before code; short path (clarify/checklist/analyze skipped — mechanics agreed directly, no open questions). PASS.
- III. Test-First: `tests/cliArgs.test.ts` single-scan describes cover activation order, last-wins, unknown/extra-text errors, `--`, and help short-circuit; `npm test` + `npm run typecheck` green before review. PASS (planned).
- IV. Simplicity/CLI: one scan loop + one types file, no new deps/config/processes; ask parked (commented, not deleted); stdout/stderr/exit contract for help unchanged. PASS.
- V. Secrets: key resolution untouched (`keys.ts` as-is); tests use plain strings, never real keys. PASS.

## Design

### Types (`src/args.ts` — new file, this plan)

- `Option = { name: string; alias: string; arity: number }` — one shared shape for global and command options.
- `Command = { name: string; options: Option[]; help: string; run: (args: { options: Record<string, string[]>; text?: string }) => ... }` — help is a complete verbatim block, printed as-is.
- `ParseState = { args: string[]; options: Record<string, string[]>; command?: string }`.
- Command registrations reference shared `Option` definitions, never copy them.

### Entry point loop (`src/chat.ts` — this plan)

- The loop is fed two lists: global `Option[]` and `Command[]`. No option or command string remains in loop logic.
- The existing `ask` execution path is parked: commented out in place under a `PARKED (ask)` marker, NOT deleted, until the `ask` command spec re-enables it. Until then the command table holds no enabled commands.
- Single left-to-right scan (the two registration lists ARE the loop's data):
  ```ts
  const state: ParseState = { args: argv, options: {}, command: undefined };
  // active options = GLOBAL_OPTIONS; after a command word, command.options
  for each token in order:
    if token is --help/-h → print general or command help (spec 006), exit 0
    else if token matches an active option → consume exactly arity values
      (missing/empty/option-like next → Missing value error, exit 2;
      arity 0 with =value → error, exit 2), append raw strings to options[tag]
    else if token is a known command word and none seen → command = token,
      switch the active set to its options
    else if token is `--` → every token after it is text
    else if token starts with `-` → Unknown option error, exit 2
    else → text candidate (a second one → extra-text error naming it, exit 2)
  ```
  Repetition resolves to last-wins: a later occurrence overwrites `options[tag]`. One scan, no repeat passes.
- Unknown option: the first leftover `-x` token → stderr `Unknown option: <token>` with a hint toward general or `dchat <command> --help`, exit 2. Text rule: exactly one leftover non-option token becomes text; a second one → extra-text error naming it with a quote hint, exit 2.
- Help (spec 006) is inline in the loop, never in handlers or reader files; `--help` stops the scan immediately.
- Detaching = removing a line from a registration list (a global option, a command, or one command's option reference) — nothing else. The parked `ask` block stays commented until the ask spec re-enables it.
- No defaults in the loop: missing values are filled by the handler after dispatch (`ask` will default the provider; another command may fail).

### What stays parked (commented, not deleted)

The whole `ask` execution path: ask routing, the provider/key/model registration lines, defaulting, key resolution, harness flow. Parked code stays in `chat.ts` under a `PARKED (ask)` marker so the ask spec can re-enable it without rewriting. `keys.ts`, `standardProviders.ts`, `fauxProvider.ts` untouched. Reader files (`providerArg.ts`, `keyArg.ts`, `modelArg.ts`) stay on disk untouched; only their registration is commented out.

## Project Structure

### Documentation (this feature)

```text
specs/002-argument-readers/
├── spec.md               # Single-loop mechanics, Option/Command types (source of truth)
├── plan.md               # This file
└── tasks.md              # Ordered implementation steps
specs/006-global-help/
└── spec.md               # Global --help/-h owned by the loop (implemented here)
```

### Source Code (repository root)

```text
src/
├── chat.ts               # entry point: single scan loop + inline help, zero option/command names in logic
├── args.ts               # NEW: Option / Command / ParseState types + the two registration lists
├── providerArg.ts        # owned by 003-provider-arg — on disk, registration parked with ask
├── keyArg.ts             # owned by 004-key-arg — on disk, registration parked with ask
├── modelArg.ts           # owned by 005-model-arg — on disk, registration parked with ask
├── keys.ts               # unchanged
├── standardProviders.ts  # unchanged
└── fauxProvider.ts       # unchanged

tests/
├── cliArgs.test.ts       # single-scan describes here; per-reader describes in 003/004/005
├── keys.test.ts          # unchanged
└── providers.test.ts     # unchanged
```

**Structure Decision**: Single-project CLI layout, unchanged. The entry point's
two registration lists ARE the loop's data; reader files stay self-contained
so each detaches by removing one reference line. One shared types module
(`args.ts`) — no other shared parsing module.

## Complexity Tracking

> No constitution violations. No entries.
