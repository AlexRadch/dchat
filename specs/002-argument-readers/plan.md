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
- **III. Test-First**: `tests/scanArgv.test.ts` drives the real loop on fake defs (flags/options, aliases, repeatable, `--no-`, `=`/glued forms, `--`, help as ordinary global flag, nine arms, help-flag-vs-error either order as named arms, direct arm asserts, no help text anywhere); `npm test` + `npm run typecheck` green before review. PASS (planned).
- IV. Simplicity/CLI: one types file + one globals file + one loop, no new deps/config/processes; ask execution parked (commented, not deleted); stdout/stderr/exit contract for help unchanged. PASS.
- V. Secrets: key resolution untouched (`keys.ts` as-is); tests use plain strings, never real keys. PASS.

## Design

### Types (`src/args.ts` — this plan, TS only)

Language shapes live HERE, not in the spec. The spec's outcomes table maps to arms as follows; `kind` is the arm tag (ADR-003), payloads stay clean.

- Base members (command side, marker-free): `Flag = { name; alias }`, `Option = { name; alias; repeatable }`; `ArgDef = { kind: "flag"; def: Flag } | { kind: "option"; def: Option }`.
- General heirs (marker side): `GeneralFlag extends Flag { global: boolean }`, `GeneralOption extends Option { global: boolean }`; `GeneralArgDef = { kind: "flag"; def: GeneralFlag } | { kind: "option"; def: GeneralOption }`. `global: true` stays visible after a command word.
- Values map (declared once, used by every success arm): `ArgValues = Record<string, boolean | string[]>` — flags store booleans under their long name, options store string arrays.
- Arity marker (plain integer, no `Infinity`): `MAX_PARAMS = 1024`; `max >= MAX_PARAMS` means unbounded on the upper side.
- Command: `{ name; defs: ArgDef[]; minParams; maxParams }` (`0 <= min <= max`, integers; scan-scoped: no help text, no execution).
- Success shapes: `WithCommand { command; argValues: ArgValues; params: string[] }` (word required, chunks live here only), `WithoutCommand { argValues: ArgValues }` (values only — chunks cannot exist without a word: the first plain token either becomes the word or fails as unknown-word). One shared base is pointless here — the two shapes share no field except meaning, and forcing one would lie.
- One failure arm per outcomes-table row, each with its own `kind` and exact fields (message on every failure arm; `command?` only where the word may already exist — never on unknown-word, always on arity arms):

| `kind` | fields |
|---|---|
| `unknown-command` (`UnknownCommand`) | `message; word` |
| `unknown-option` (`UnknownOption`) | `message; token; command?` |
| `missing-value` (`MissingValue`) | `message; option; command?` |
| `unexpected-value` (`UnexpectedValue`) | `message; flag; command?` |
| `too-many` (`TooMany`) | `message; name; command?` |
| `too-few-params` (`TooFewParams`) | `message; command; got` |
| `too-many-params` (`TooManyParams`) | `message; command; got` |

- Failure base (the iron rule): `interface FailureOutcome { message: string }` — every one of the seven failure shapes `extends` it. A new failure shape without a diagnosis does not compile. Success shapes stay independent — they share no field.
- Family aliases (for the reader, not the compiler): `ScanSuccess = WithCommand | WithoutCommand`, `ScanFailure = the seven`. They document intent — dispatch still switches on `kind`.
- `ScanResult = ScanSuccess | ScanFailure` (nine arms, tag on each).
- Entry: `scanArgv(argv: string[], generals: GeneralArgDef[], commands: Command[])`. Registration clashes (same spelling, two different objects outside the command's own spellings) and bad arity shapes throw plain `Error`s (programmer bugs, ADR-004).
- Command registrations reference shared general entries, never copy them.

### Generals (`src/generalArgs.ts`, spec 008 — this plan)

- `GENERAL_ARGS` holds the general command-line arguments (`GeneralArgDef[]`): `--provider` / `-p`, `--key` / `-k`, `--model` / `-m` (all options, `repeatable: false`, `global: false`) + `--help` / `-h` (flag, `global: true`).
- The entry point passes the generals table as the scan's generals. No hard-coded spellings anywhere: the scan resolves every token through the visible defs.

### Entry point loop (`src/args.ts` — real scan, this plan)

- One left-to-right pass over the tokens, fed the generals table + the command table. Before any command word ONLY generals are valid; after the word, that command's defs first, then visible-after-word generals, plus plains. On word resolve, collected tokens re-check against the command's rule (dumb, never compared).
- No hard-coded spellings: every dash-token resolves through the visible defs; `--help` is a plain flag entry. A set flag never fills an option's value slot. After bare `--` everything is text. `-h ask` ≡ `ask -h` → same arm (flag carries through either order).
- Flag: zero values, `=` always error, second occurrence → too-many. `--no-<name>` is a separate spelled flag writing `false` to the same key.
- Option: exactly one value (apart / `--o=v` / `-ovalue`); `-o=value` is an error; missing/empty/`-`-next → missing-value; a set flag never fills its value slot. `repeatable: false` second occurrence → too-many; `true` accumulates in order.
- Result arms: two successes + seven named failures as above (no help text in any arm, no exit codes in the scan at all); the entry point switches on `kind` — success arms first check the help flag (set → block stdout exit 0, handler never called), else `with-command` dispatches to the handler, `without-command` decides by values (present → `No command.` + block stderr exit 2; empty → block stdout exit 0), every failure arm prints `message + "\n\n" + block` on stderr with exit 2 (one mapping, block restored from the resolved command or the general block). Arity checked on the success-with-command path, always — no flag skips it. No `try/catch` for the normal path (ADR-004); exceptions stay for the unexpected only.
- All failure arms carry the diagnosis line; `command?` travels only where the word may already exist; exit codes live in exactly one place — the entry point.

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
