# Implementation Plan: Provider Option Definition

**Branch**: `003-provider-arg` | **Date**: 2026-11-07 (rewritten 2026-11-08) | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-provider-arg/spec.md`

**Parent**: `specs/002-argument-readers/spec.md` (single-scan loop; this plan builds only the provider option definition).

## Summary

Replace `src/providerArg.ts` contents with one shared `Option` definition plus its help fragment. No scanning lives here — the loop in `args.ts` (002) owns all parsing. Detach = remove the reference from the command's `options` list plus its lines from that command's verbatim help block.

## Technical Context

Same stack as 002 (TypeScript strict, ESM, Node 22+, `tsx --test`, `tsc --noEmit`). No new deps. One file: `src/providerArg.ts`.

## Constitution Check

- I. English-Only: PASS. II. Spec-Driven: spec 003 first, short path. PASS. III. Test-First: single-scan describes in `tests/cliArgs.test.ts` cover the definition via the loop. PASS (planned). IV. Simplicity: ~15 lines replacing ~27 lines. PASS. V. Secrets: plain strings only. PASS.

## Design (`src/providerArg.ts`)

```ts
import type { Option } from "./args.js";
export const providerOption: Option = {
  name: "--provider",
  alias: "-p",
  arity: 1,
  min: 0,
  max: 1,
};
export const providerHelp: string[] = [
  "  --provider P     Provider id (default: openrouter)",
];
```

Notes: value stored as-is; validity checked downstream. Help fragment unchanged (owned here).

## Project Structure

```text
specs/003-provider-arg/
├── spec.md
├── plan.md               # This file
└── tasks.md              # Short task list (tests + rewrite)

src/providerArg.ts        # option definition (this plan)
tests/cliArgs.test.ts     # single-scan loop describes (002, shared)
```

## Complexity Tracking

> No constitution violations. No entries.
