# Implementation Plan: Key Option Definition

**Branch**: `004-key-arg` | **Date**: 2026-11-07 (rewritten 2026-11-08) | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-key-arg/spec.md`

**Parent**: `specs/002-argument-readers/spec.md` (single-scan loop; this plan builds only the key option definition).

## Summary

Replace `src/keyArg.ts` contents with one shared `Option` definition plus its help fragment, mirroring 003 with key spellings. No scanning lives here — the loop in `args.ts` (002) owns all parsing. Detach = remove the reference from the command's `options` list plus its lines from that command's verbatim help block.

## Technical Context

Same stack as 002. No new deps. One file: `src/keyArg.ts`.

## Constitution Check

- I. English-Only: PASS. II. Spec-Driven: spec 004 first, short path. PASS. III. Test-First: single-scan describes in `tests/cliArgs.test.ts` cover the definition via the loop. PASS (planned). IV. Simplicity: ~20 lines replacing ~31 lines. PASS. V. Secrets: key SPEC strings only, never real keys; resolution untouched in `keys.ts`. PASS.

## Design (`src/keyArg.ts`)

Same shape as the provider definition (003), with `--key` / `-k` / arity 1 / `min 0, max 1` spellings and `Missing value for --key` errors owned by the loop. `keyHelp` lines unchanged (owned here). Value stored as-is; interpretation stays in `keys.ts`.

## Project Structure

```text
specs/004-key-arg/
├── spec.md
├── plan.md               # This file
└── tasks.md              # Short task list (tests + rewrite)

src/keyArg.ts             # option definition (this plan)
tests/cliArgs.test.ts     # single-scan loop describes (002, shared)
```

## Complexity Tracking

> No constitution violations. No entries.
