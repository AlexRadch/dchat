# Implementation Plan: Key Argument Reader

**Branch**: `004-key-arg` | **Date**: 2026-11-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-key-arg/spec.md`

**Parent**: `specs/002-argument-readers/spec.md` (argument-processing loop mechanics; this plan builds only the key reader).

## Summary

Rewrite `src/keyArg.ts` as a lazy first-token reader, mirroring 003 with key
spellings. Inspect only the leading token, consume at most one `--key`
occurrence per call, return everything else unchanged. Detach = delete file +
import + call block + help spread.

## Technical Context

Same stack as 002. No new deps. One file: `src/keyArg.ts`.

## Constitution Check

- I. English-Only: PASS. II. Spec-Driven: spec 004 first, short path. PASS. III. Test-First: per-reader describes in `tests/cliArgs.test.ts` green. PASS (planned). IV. Simplicity: ~20 lines replacing ~20 lines. PASS. V. Secrets: key SPEC strings only, never real keys; resolution untouched in `keys.ts`. PASS.

## Design (`src/keyArg.ts`)

Same shape as the provider reader (003), with `--key` / `--key=<v>` / `-k`
spellings and `Missing value for --key` errors. `keyHelp` lines unchanged
(owned here). Value stored as-is; interpretation stays in `keys.ts`.

## Project Structure

```text
specs/004-key-arg/
├── spec.md
├── plan.md               # This file
└── tasks.md              # Short task list (tests + rewrite)

src/keyArg.ts             # rewritten lazy (this plan)
tests/cliArgs.test.ts     # "key reader" describe rewritten lazy (this plan)
```

## Complexity Tracking

> No constitution violations. No entries.
