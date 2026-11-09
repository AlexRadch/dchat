# ADR-003: Type unions carry an explicit string tag on the union, not on the members

**Status**: accepted
**Date**: 2026-11-09
**Deciders**: project owner + agent

## Context

TypeScript erases types at compile time: after `tsc` runs, nothing at
runtime can answer "is this value a Flag or an Option?". A bare union
(`Flag | Option`) compiles, narrows in the editor, but leaves production
code with no runtime test — every consumer re-invents its own guessing
(`"repeatable" in x`, `typeof x`, field sniffing). C# nominal types answer
`is` at runtime; TS structural types do not. A wrong guess compiles and
fails silently in production.

## Decision

Every union that crosses a boundary (scan result, defs list, any shape two
modules must agree on) is a **tagged union with the tag declared once, on
the union arms** — never copied into the member types:

- Each arm is `{ kind: "<arm-name>"; ...fields specific to this arm }`.
- The member types (`Flag`, `Option`, result payloads) stay clean: they
  know nothing about the unions they participate in.
- The tag field (`kind`, or a domain name when one reads better) is added
  at the point of mixing — in the union declaration — so the same member
  can join several unions under different tags without conflict.
- `kind` values are string literals (`"run"`, `"general-help"`), never
  numbers or booleans: they read in logs, survive serialization, and
  the compiler exhaustiveness-checks them in `switch (x.kind)`.

Applied twice already: `ArgDef = { kind: "flag"; def: Flag } |
{ kind: "option"; def: Option }` (002 — Flag/Option stay clean, `kind`
lives only in the wrapper) and `ScanResult = GeneralHelp | CommandHelp |
Run` (002 — three result shapes, `command`/`text`/`help` only on the arms
that need them). Both unions are consumed by `switch` on `kind`, never by
field sniffing or `instanceof`.

## Consequences

- One place to change: adding an arm means adding one tagged shape and one
  `switch` case — the compiler lists every unhandled site.
- Members stay reusable: a `Flag` joins any union without carrying a stale
  tag from a previous one.
- Runtime cost is one string comparison per branch — negligible against a
  process spawn.
- Discipline cost: every new union must name its tag and its arms in its
  spec before code; an untagged union crossing a boundary is a review
  rejection.
