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
| [002-argument-readers](./002-argument-readers/spec.md) | Grammar is the contract; Flag/Option/ArgDef/Command types; real single-pass scan returning a discriminated union (`run` / `no-command` / `parse-error`); help is an ordinary general flag, not a loop rule | `src/args.ts` (types + scan), `src/generalArgs.ts` (GENERAL_ARGS), `tests/scanArgv.test.ts` |
| [008-general-args](./008-general-args/spec.md) | General command-line arguments (`GeneralArgDef[]`): `--provider` / `--key` / `--model` (all options, single-shot, `global: false`) + `--help` / `-h` (flag, `global: true`), each exported individually for reference | `src/generalArgs.ts` (`GENERAL_ARGS: GeneralArgDef[]` + per-entry exports) |
