# Specs registry

Groups of feature specs in this repo. Numbers are birth order only (never reused; deleted specs leave gaps). New spec: add a row here.

## Providers

| Spec | What | Builds |
|------|------|--------|
| [001-provider-components](./001-provider-components/spec.md) | Provider assembly split out of the entry point into components | `src/standardProviders.ts`, `src/fauxProvider.ts` |

## Arguments

Mechanics in 002; one spec per reader. A new flag family = a new spec + a new reader file.

| Spec | What | Builds |
|------|------|--------|
| [002-argument-readers](./002-argument-readers/spec.md) | Argument-processing loop mechanics: readers get "process", return remainder; loop repeats while the remainder shrinks; leftover `-x` is an unknown-option error. Fixes no spellings — those live in reader specs | `src/chat.ts` (argument-processing loop + remainder check) |
| [003-provider-arg](./003-provider-arg/spec.md) | Lazy first-token read of `--provider` / `--provider=<v>` / `-p` | `src/providerArg.ts` |
| [004-key-arg](./004-key-arg/spec.md) | Lazy first-token read of `--key` / `--key=<v>` / `-k` | `src/keyArg.ts` |
| [005-model-arg](./005-model-arg/spec.md) | Lazy first-token read of `--model` / `--model=<v>` / `-m` | `src/modelArg.ts` |
