# Implementation Plan: Argument Readers — Argument-Processing Loop

**Branch**: `002-argument-readers` | **Date**: 2026-11-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-argument-readers/spec.md`

## Summary

Replace the hand-rolled option loop in `src/chat.ts` with a argument-processing loop over
self-contained reader files. One pass hands the current token list to every
registered reader in order ("process"); each reader returns what it did not
consume. The loop runs another pass while the remainder shrinks and stops when
a full pass consumes nothing or the remainder is empty. Any leftover token that
looks like an option is an unknown-option error (exit 2). Reader spellings,
strategies, and help lines are NOT here — each reader's own spec (003, 004,
005, ...) fixes them. Detaching a reader = deleting its import, its call block,
and its help spread in `chat.ts`. Behavior with the three standard readers
attached is identical to today.

## Technical Context

**Language/Version**: TypeScript strict, ESM (`type: module`, NodeNext), Node 22+; run via `tsx`

**Primary Dependencies**: No new dependencies. Existing `pi-*` packages and `keytar` untouched.

**Storage**: N/A (no storage involved; pure argv transformation)

**Testing**: `tsx --test tests/*.test.ts`, `tsc --noEmit`

**Target Platform**: CLI, one-shot (ask → print answer → exit)

**Project Type**: cli

**Performance Goals**: N/A (a few linear passes over a short argv; passes are bounded by token count)

**Constraints**: ADR-002 — no IoC container; composition via plain function calls in the entry point. Exit codes stay 0/1/2. Constitution V — no key-handling changes; `keys.ts` untouched.

**Scale/Scope**: `src/chat.ts` argument-processing-loop rewrite (this plan). Reader files owned by their own specs: `src/providerArg.ts` (003), `src/keyArg.ts` (004), `src/modelArg.ts` (005). No new deps, no config files.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- I. English-Only: all new code, comments, tests, spec artifacts in English. PASS.
- II. Spec-Driven: spec `002-argument-readers` written first and amended to the argument-processing loop; plan + tasks before code; short path (clarify/checklist/analyze skipped — mechanics agreed directly, no open questions). PASS.
- III. Test-First: `tests/cliArgs.test.ts` "argument-processing loop" describes cover pass order, shrink-to-continue, stop-on-stall, and last-wins; `npm test` + `npm run typecheck` green before review. PASS (planned).
- IV. Simplicity/CLI: argument-processing loop is ~15 lines, no new deps/config/processes, no shared abstraction; stdout/stderr/exit contract unchanged with all readers attached. PASS.
- V. Secrets: key resolution untouched (`keys.ts` as-is); tests use plain strings, never real keys. PASS.

## Design

### Entry point argument-processing loop (`src/chat.ts` — this plan)

- Imports the three readers and their three help fragments. No option string
  remains in parsing logic (verified by grep in T021; fixed usage header,
  examples, and comments may still name options as text).
- `--help` / `-h` short-circuit stays before parsing (unchanged).
- Argument-processing loop (the registration list IS these call blocks, in order):
  ```ts
  let rest = argv.slice(1);
  let provider: string | undefined;
  let key: string | undefined;
  let model: string | undefined;
  try {
    for (;;) {
      const n = rest.length;
      if (n === 0) break;
      const p = readProviderArg(rest);
      if (p.provider !== undefined) provider = p.provider;
      const k = readKeyArg(p.rest);
      if (k.key !== undefined) key = k.key;
      const m = readModelArg(k.rest);
      if (m.model !== undefined) model = m.model;
      rest = m.rest;
      if (rest.length === n) break; // nobody consumed anything — stop
    }
    provider ??= DEFAULT_PROVIDER;
  } catch (e) {
    // Missing value throw from any reader → stderr + exit 2 (same text as today).
  }
  ```
  Termination is structural: every pass either shrinks the list or stops the
  loop, so passes are bounded by token count. Repetition resolves to
  last-wins: a later pass overwrites the stored value. `model !== undefined`
  replaces the old `modelGiven` flag (same meaning: explicit `--model` was
  passed).
- Remainder check, inline (one line, no helper):
  ```ts
  const unknown = rest.find((t) => t.startsWith("-"));
  ```
  If found → stderr `Unknown option: <token>. Try "dchat ask --help".`, exit 2.
  Remaining tokens joined with single spaces are the question text (unchanged).
- Provider default applies after parsing: `provider ?? DEFAULT_PROVIDER`
  (`DEFAULT_PROVIDER` stays in `chat.ts` — composition policy, not parsing).
- Help text = fixed header + `providerHelp` + `keyHelp` + `modelHelp` spreads +
  fixed examples/footer, so help always mirrors the attached readers (FR-007).
- A comment above the loop documents the detach procedure: delete the import,
  the call block, and the help spread — nothing else.

### What stays untouched

`keys.ts`, `standardProviders.ts`, `fauxProvider.ts`, command routing,
unknown-provider check, key resolution, harness flow, exit-code contract.
Reader files (`providerArg.ts`, `keyArg.ts`, `modelArg.ts`) are owned by specs
003/004/005 — this plan only calls them.

## Project Structure

### Documentation (this feature)

```text
specs/002-argument-readers/
├── spec.md               # Argument-processing loop mechanics (this plan's source of truth)
├── plan.md               # This file
└── tasks.md              # Ordered implementation steps
```

### Source Code (repository root)

```text
src/
├── chat.ts               # entry point: argument-processing loop + inline remainder check, zero option names in logic
├── providerArg.ts        # owned by 003-provider-arg (lazy first-token read)
├── keyArg.ts             # owned by 004-key-arg (lazy first-token read)
├── modelArg.ts           # owned by 005-model-arg (lazy first-token read)
├── keys.ts               # unchanged
├── standardProviders.ts  # unchanged
└── fauxProvider.ts       # unchanged

tests/
├── cliArgs.test.ts       # "argument-processing loop" describes here; per-reader describes in 003/004/005
├── keys.test.ts          # unchanged
└── providers.test.ts     # unchanged
```

**Structure Decision**: Single-project CLI layout, unchanged. The entry point's
loop IS the registration list; reader files stay self-contained and import-free
so each detaches by deleting it alone. No shared parsing module.

## Complexity Tracking

> No constitution violations. No entries.
