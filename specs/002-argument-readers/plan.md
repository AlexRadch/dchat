# Implementation Plan: Argument Readers — Grammar Contract, Types, Real Scan

**Branch**: `002-argument-readers` | **Date**: 2026-11-08 | **Spec**: [spec.md](./spec.md) + [008-general-args](../008-general-args/spec.md)

**Input**: Feature specification from `/specs/002-argument-readers/spec.md` (rewritten: grammar is the contract; Flag/Option/ArgDef/Command types; globals + command table; help is a loop rule)

## Summary

Build the shared Flag/Option/ArgDef/Command types in `src/args.ts`, the general args list in `src/generalArgs.ts` (spec 008), and the real single-pass `scanArgv` loop per the 002 grammar — testable standalone on fake defs, independent of any command. No hard-coded spellings: help is an ordinary general entry.

## Technical Context

**Language/Version**: TypeScript strict, ESM (`type: module`, NodeNext), Node 22+; run via `tsx`

**Primary Dependencies**: No new dependencies. Existing `pi-*` packages and `keytar` untouched.

**Storage**: N/A (no storage involved; pure argv transformation)

**Testing**: `tsx --test tests/*.test.ts`, `tsc --noEmit`

**Target Platform**: CLI, one-shot (ask → print answer → exit)

**Project Type**: cli

**Performance Goals**: N/A (one linear scan over a short argv).

**Constraints**: ADR-002 — no IoC container; composition via plain function calls in the entry point. Exit codes stay 0/1/2. Constitution V — no key-handling changes; `keys.ts` untouched. Parked code is commented, never deleted.

**Scale/Scope**: `src/args.ts` types + real `scanArgv` (this plan) + `src/generalArgs.ts` generals (spec 008) + `tests/scanArgv.test.ts` on fake defs. No new deps, no config files.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- I. English-Only: all new code, comments, tests, spec artifacts in English. PASS.
- **II. Spec-Driven**: spec `002-argument-readers` rewritten (grammar is the contract; Flag/Option/ArgDef/Command types); generals in spec 008; plan + tasks before code; short path (clarify/checklist/analyze skipped — mechanics agreed directly, no open questions). PASS.
- **III. Test-First**: `tests/scanArgv.test.ts` drives the real loop on fake defs (flags/options, aliases, repeatable, `--no-`, `=`/glued forms, `--`, help as ordinary global flag, three arms, help-flag-vs-error either order as `parse-error`, direct arm asserts, no help text anywhere); `npm test` + `npm run typecheck` green before review. PASS (planned).
- IV. Simplicity/CLI: one types file + one globals file + one loop, no new deps/config/processes; ask execution parked (commented, not deleted); stdout/stderr/exit contract for help unchanged. PASS.
- V. Secrets: key resolution untouched (`keys.ts` as-is); tests use plain strings, never real keys. PASS.

## Design

### Types (`src/args.ts` — this plan)

- `Flag = { name: string; alias: string }` — zero values, never repeats.
- `Option = { name: string; alias: string; repeatable: boolean }` — exactly one value per occurrence.
- `ArgDef = { kind: "flag"; def: Flag } | { kind: "option"; def: Option }` — plain command-side defs, `kind` lives only in the wrapper; types stay clean. General side extends the members: `GeneralFlag extends Flag { global: boolean }`, `GeneralOption extends Option { global: boolean }`, `GeneralArgDef = { kind: "flag"; def: GeneralFlag } | { kind: "option"; def: GeneralOption }` — `global` exists ONLY on general entries, a command entry cannot carry them even by accident. `global: true` stays visible after a command word; after the word the command's own `defs` are tried first, then `global: true` generals. On word resolve, collected tokens re-check against the command's rule (dumb algorithm: same object is one rule, two objects is two rules, never compared).
- `Command = { name: string; defs: ArgDef[]; minParams: number; maxParams: number }` — word + own defs + param arity (`0 <= min <= max`, integers; `max >= MAX_PARAMS` means unbounded). Scan-scoped: no `help`, no `run` (Scope).
- Scan payloads carry `params: string[]` — always an array, possibly empty; the scan never joins chunks, joining is the command's job.
- Parse result: discriminated union `ScanResult = Run | NoCommand | ParseFailure` — `run` (`{ kind; command; argValues; params }`, command required — with no word the scan returns `no-command` instead, never a command-less `run`), `no-command` (`{ kind; argValues; params }`, facts only, normal outcome, NO message or exit code — the entry point owns the meaning: set help flag → print block exit 0; else facts present → error, empty → help), `parse-error` (`{ kind; message; exitCode; command? }` — expected input failure, no help text; ADR-004, entry point restores the block). `scanArgv(argv, generals: GeneralArgDef[], commands: Command[])` — the marker fields are unreachable on command entries by construction. No help arms: help is a plain general flag (`helpFlag`, `global: true`) carried in `argValues`; the entry point reads the flag first. Each arm carries only what it needs. Declared with `interface`s (plain structural shapes, erased at runtime — the C# `record` equivalent, not `class`: no behaviour or identity travels, the `kind` string already discriminates).
- Generals: `GENERAL_ARGS: GeneralArgDef[]` in `src/generalArgs.ts` (spec 008) — fed to the scan before any command word; `global: true` entries additionally visible after.
- Command registrations reference shared definitions, never copy them.

### Generals (`src/generalArgs.ts`, spec 008 — this plan)

- `GENERAL_ARGS` holds the general command-line arguments (`GeneralArgDef[]`): `--provider` / `-p`, `--key` / `-k`, `--model` / `-m` (all options, `repeatable: false`, `global: false`) + `--help` / `-h` (flag, `global: true`).
- The entry point passes `GENERAL_ARGS` as the scan's generals. No hard-coded spellings anywhere in 002: the scan resolves every token through the visible defs.

### Entry point loop (`src/args.ts` — real scan, this plan)

- One left-to-right pass over `argv`, fed `generals: ArgDef[]` + `commands: Command[]`. Before any command word ONLY generals are valid; after the word, that command's `defs` first, then `global: true` generals, plus plains. On word resolve, collected tokens re-check against the command's rule (dumb, never compared).
- No hard-coded spellings: every dash-token resolves through the visible defs; `--help` is a plain flag entry. A set flag never fills an option's value slot. After bare `--` everything is text. `-h ask` ≡ `ask -h` → same arm (flag carries through either order).
- Flag: zero values, `=` always error, second occurrence → too-many. `--no-<name>` is a separate spelled flag writing `false` to the same key.
- Option: exactly one value (apart / `--o=v` / `-ovalue`); `-o=value` is an error; missing/empty/`-`-next → missing-value; a set flag never fills its value slot. `repeatable: false` second occurrence → too-many; `true` accumulates in order.
- Result arms: `run` / `no-command` / `parse-error` as above (no help text in any arm, no help arms at all); the entry point switches on `kind` — `run`/`no-command` first check the help flag (set → block stdout exit 0, handler never called), else `run` dispatches to the handler, `no-command` decides by facts (present → `No command.` + block stderr exit 2; empty → block stdout exit 0), `parse-error` prints `message + "\n\n" + block` on stderr with its exit code. Arity checked on the `run` path, always — a set flag changes nothing (dumb). No `try/catch` for the normal path (ADR-004); exceptions stay for the unexpected only.
- Errors carry the resolved word (`command?`) + exit code (unknown command → 1, rest → 2), never help text; arity checked on the `run` path only (`Too few/many params`, always — no flag skips it); no-word → `no-command` facts (entry point decides: help flag → block 0; else present → 2, empty → 0); no pre-scan empty-`argv` shortcut (empty scans to `no-command`).

### What stays parked (commented, not deleted)

The whole `ask` execution path: ask routing, defaulting, key resolution, harness flow. Parked code stays in `chat.ts` under a `PARKED (ask)` marker so the ask spec can re-enable it without rewriting. `keys.ts`, `standardProviders.ts`, `fauxProvider.ts` untouched.

## Project Structure

### Documentation (this feature)

```text
specs/002-argument-readers/
├── spec.md               # Grammar contract, Flag/Option/ArgDef/Command types (source of truth)
├── plan.md               # This file
└── tasks.md              # Ordered implementation steps
specs/008-general-args/
└── spec.md               # General command-line arguments for commands (this plan fills GENERAL_ARGS)
```

### Source Code (repository root)

```text
src/
├── chat.ts               # entry point: real scan + inline help, zero option/command names in logic
├── args.ts               # Flag / Option / ArgDef / Command types + real scanArgv
├── generalArgs.ts        # NEW (spec 008): GENERAL_ARGS — generals incl. the global help flag
├── keys.ts               # unchanged
├── standardProviders.ts  # unchanged
└── fauxProvider.ts       # unchanged

tests/
├── scanArgv.test.ts      # NEW: real loop on fake defs incl. union arms (-h before/after word, help-vs-error)
├── keys.test.ts          # unchanged
└── providers.test.ts     # unchanged
```

**Structure Decision**: Single-project CLI layout, unchanged. The entry point's
two registration lists ARE the loop's data; reader files stay self-contained
so each detaches by removing one reference line. One shared types module
(`args.ts`) — no other shared parsing module.

## Complexity Tracking

> No constitution violations. No entries.
