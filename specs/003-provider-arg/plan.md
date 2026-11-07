# Implementation Plan: Provider Argument Reader

**Branch**: `003-provider-arg` | **Date**: 2026-11-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-provider-arg/spec.md`

**Parent**: `specs/002-argument-readers/spec.md` (argument-processing loop mechanics; this plan builds only the provider reader).

## Summary

Rewrite `src/providerArg.ts` as a lazy first-token reader: inspect only the
leading token, consume at most one `--provider` occurrence per call, return
everything else unchanged. The argument-processing loop in `chat.ts` (002) drives repetition
and last-wins across passes. Detach = delete file + import + call block + help
spread.

## Technical Context

Same stack as 002 (TypeScript strict, ESM, Node 22+, `tsx --test`, `tsc --noEmit`). No new deps. One file: `src/providerArg.ts`.

## Constitution Check

- I. English-Only: PASS. II. Spec-Driven: spec 003 first, short path. PASS. III. Test-First: per-reader describes in `tests/cliArgs.test.ts` green. PASS (planned). IV. Simplicity: ~20 lines replacing ~20 lines. PASS. V. Secrets: plain strings only. PASS.

## Design (`src/providerArg.ts`)

```ts
export const providerHelp: string[] = [
  "  --provider P     Provider id (default: openrouter)",
];
export function readProviderArg(tokens: string[]): {
  provider?: string;
  rest: string[];
} {
  const [first, second, ...tail] = tokens;
  if (first === "--provider" || first === "-p") {
    if (second === undefined || second === "" || second.startsWith("-"))
      throw new Error('Missing value for --provider. Try "dchat ask --help".');
    return { provider: second, rest: tail };
  }
  if (first !== undefined && first.startsWith("--provider=")) {
    const v = first.slice("--provider=".length);
    if (!v)
      throw new Error('Missing value for --provider. Try "dchat ask --help".');
    return { provider: v, rest: [second, ...tail].filter((t) => t !== undefined) as string[] };
  }
  return { provider: undefined, rest: tokens };
}
```

Notes: never mutates input (`rest` reuses the tail slice or the input reference
when untouched — both are fresh enough since callers never mutate). Value
stored as-is; validity checked downstream. Help lines unchanged (owned here).

## Project Structure

```text
specs/003-provider-arg/
├── spec.md
├── plan.md               # This file
└── tasks.md              # Short task list (tests + rewrite)

src/providerArg.ts        # rewritten lazy (this plan)
tests/cliArgs.test.ts     # "provider reader" describe rewritten lazy (this plan)
```

## Complexity Tracking

> No constitution violations. No entries.
