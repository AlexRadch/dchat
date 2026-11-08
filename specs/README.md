# Specs registry

Groups of feature specs in this repo. Numbers are birth order only (never reused; deleted specs leave gaps). New spec: add a row here.

## Providers

| Spec | What | Builds |
|------|------|--------|
| [001-provider-components](./001-provider-components/spec.md) | Provider assembly split out of the entry point into components | `src/standardProviders.ts`, `src/fauxProvider.ts` |

## Arguments

Mechanics in 002 (grammar is the contract). Flags and options live in each command's `defs`; globals (008) are shared across commands. Help is a loop rule, never declared.

| Spec | What | Builds |
|------|------|--------|
| [002-argument-readers](./002-argument-readers/spec.md) | Grammar is the contract; Flag/Option/Def/Command types; globals + command table; help is a loop rule | `src/args.ts` (types + stub scan), `src/globalArgs.ts` (GLOBAL_ARGS) |
| [008-global-args](./008-global-args/spec.md) | Global command-line arguments for commands: `--provider` / `--key` / `--model` (all options, single-shot); `--help` owned by loop, not listed | `src/globalArgs.ts` (`GLOBAL_ARGS: Def[]`) |
