# Implementation Plan: Model Argument Reader

**Branch**: `005-model-arg` | **Date**: 2026-11-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-model-arg/spec.md`

**Parent**: `specs/002-argument-readers/spec.md` (argument-processing loop mechanics; this plan builds only the model reader).

## Summary

Rewrite `src/modelArg.ts` as a lazy first-token reader, mirroring 003 with
model spellings. Inspect only the leading token, consume at most one `--model`
occurrence per call, return everything else unchanged. Detach = delete file +
import + call block + help spread.

## Technical Context

Same stack as 002. No new deps. One file: `src/modelArg.ts`.

## Constitution Check

- I. English-Only: PASS. II. Spec-Driven: spec 005 first, short path. PASS. III. Test-First: per-reader describes in `tests/cliArgs.test.ts` green. PASS (planned). IV. Simplicity: ~20 lines replacing ~20 lines. PASS. V. Secrets: plain strings only. PASS.

## Design (`src/modelArg.ts`)

Same shape as the provider reader (003), with `--model` / `--model=<v>` / `-m`
spellings and `Missing value for --model` errors. `modelHelp` lines unchanged
(owned here). Value stored as-is; catalog membership checked downstream.

## Project Structure

```text
specs/005-model-arg/
├── spec.md
├── plan.md               # This file
└── tasks.md              # Short task list (tests + rewrite)

src/modelArg.ts           # rewritten lazy (this plan)
tests/cliArgs.test.ts     # "model reader" describe rewritten lazy (this plan)
```

## Complexity Tracking

> No constitution violations. No entries.
