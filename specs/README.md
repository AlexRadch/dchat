# Specs registry

Groups of feature specs in this repo. Numbers are birth order only (never reused; deleted specs leave gaps). New spec: add a row here.

## Providers

| Spec | What | Builds |
|------|------|--------|
| [001-provider-components](./001-provider-components/spec.md) | Provider assembly split out of the entry point into components | `src/standardProviders.ts`, `src/fauxProvider.ts` |

## Arguments

Mechanics in 002 (grammar is the contract). Flags and options live in each command's `defs`; globals (003) are shared across commands. Help is a loop rule, never declared.

| Spec | What | Builds |
|------|------|--------|
| [002-argument-readers](./002-argument-readers/spec.md) | Grammar is the contract; Flag/Option/Def/Command types; globals + command table; help is a loop rule | `src/args.ts` (types + stub scan) |

## Keys

| Spec | What | Builds |
|------|------|--------|
| [007-key-spec](./007-key-spec/spec.md) | Key-spec handoff: raw `--key` string → `resolveKey` unchanged; absent → `undefined`; explicit-miss → named error; form parsing out of scope | `src/chat.ts` (handoff), `src/keys.ts` (input boundary) |
