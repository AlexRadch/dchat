# Specs registry

Groups of feature specs in this repo. Numbers are birth order only (never reused; deleted specs leave gaps). New spec: add a row here.

## Providers

| Spec | What | Builds |
|------|------|--------|
| [001-provider-components](./001-provider-components/spec.md) | Provider assembly split out of the entry point into components | `src/standardProviders.ts`, `src/fauxProvider.ts` |

## Arguments

Mechanics in 002; one spec per reader. A new flag family = a new spec + a new reader file. Global help is 006 (inline in the loop, not a reader file).

| Spec | What | Builds |
|------|------|--------|
| [002-argument-readers](./002-argument-readers/spec.md) | Single scan loop fed by global options + command table; Option/Command types; fixed arity; one-token text; help owned by loop | `src/chat.ts` (loop), `src/args.ts` (types) |
| [003-provider-arg](./003-provider-arg/spec.md) | Option definition: `--provider` / `-p` / arity 1 / min 0, max 1, plus help fragment | `src/providerArg.ts` |
| [004-key-arg](./004-key-arg/spec.md) | Option definition: `--key` / `-k` / arity 1 / min 0, max 1, plus help fragment | `src/keyArg.ts` |
| [005-model-arg](./005-model-arg/spec.md) | Option definition: `--model` / `-m` / arity 1 / min 0, max 1, plus help fragment | `src/modelArg.ts` |
| [006-global-help](./006-global-help/spec.md) | Global `--help` / `-h` owned by the loop: general help before any command, verbatim command block after; stops the scan, handler never called | `src/chat.ts` (inline help handling) |

## Keys

| Spec | What | Builds |
|------|------|--------|
| [007-key-spec](./007-key-spec/spec.md) | Key-spec handoff: raw `--key` string → `resolveKey` unchanged; absent → `undefined`; explicit-miss → named error; form parsing out of scope | `src/chat.ts` (handoff), `src/keys.ts` (input boundary) |
