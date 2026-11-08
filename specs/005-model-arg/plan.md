# Implementation Plan: Model Option Definition

**Branch**: `005-model-arg` | **Date**: 2026-11-07 (rewritten 2026-11-08) | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-model-arg/spec.md`

**Parent**: `specs/002-argument-readers/spec.md` (single-scan loop; this plan builds only the model option definition).

## Summary

Replace `src/modelArg.ts` contents with one shared `Option` definition plus its help fragment, mirroring 003 with model spellings. No scanning lives here — the loop in `args.ts` (002) owns all parsing. Detach = remove the reference from the command's `options` list plus its lines from that command's verbatim help block.

## Technical Context

Same stack as 002. No new deps. One file: `src/modelArg.ts`.

## Constitution Check

- I. English-Only: PASS. II. Spec-Driven: spec 005 first, short path. PASS. III. Test-First: single-scan describes in `tests/cliArgs.test.ts` cover the definition via the loop. PASS (planned). IV. Simplicity: ~15 lines replacing ~27 lines. PASS. V. Secrets: plain strings only. PASS.

## Design (`src/modelArg.ts`)

Same shape as the provider definition (003), with `--model` / `-m` / arity 1 / `min 0, max 1` spellings and `Missing value for --model` errors owned by the loop. `modelHelp` lines unchanged (owned here). Value stored as-is; catalog membership checked downstream.

## Project Structure

```text
specs/005-model-arg/
├── spec.md
├── plan.md               # This file
└── tasks.md              # Short task list (tests + rewrite)

src/modelArg.ts           # option definition (this plan)
tests/cliArgs.test.ts     # single-scan loop describes (002, shared)
```

## Complexity Tracking

> No constitution violations. No entries.
