# ADR-004: Expected failures are values, not exceptions

**Status**: accepted
**Date**: 2026-11-09
**Deciders**: project owner + agent

## Context

The scan (`scanArgv`, spec 002) currently reports input mistakes
(`unknown option`, `missing value`, `too-many`, `unknown command`)
by throwing `ParseError`. Callers must `try/catch` a normal outcome:
a user typo is not an accident, it is the expected result of reading
untrusted input. Mixing it with real accidents (out of memory, file
read failure, programmer bug such as `Duplicate spelling`) forces every
caller to guess which `catch` branch is "normal" and which is "the
program broke". Tests suffer most: instead of asserting a returned arm
they wrap a throwing closure in a helper.

## Decision

- An **expected failure** — wrong user input, violated grammar,
  failed validation — is a **return value**: one named arm of the
  discriminated union (ADR-003) per failure type, carrying the
  diagnosis and the exact facts of that failure
  (`unknown-command { word }`, `missing-value { option; command? }`, … —
  each arm declares precisely which fields it has and which it lacks).
  The compiler forces handling: an unhandled arm is a type error,
  not a silent fall-through. The scan carries NO exit codes —
  every failure arm is a usage error by construction; the entry
  point maps all of them to exit 2 in one place.
- An **exception** is reserved for the **unexpected**: resource
  failures (memory, I/O), violated programmer invariants
  (duplicate registration), bugs. These abort the normal flow
  because there is no meaningful value to return.
- Rule of thumb: if the caller can name the failure in advance
  and must react to it (print + exit code + continue), it is a value.
  If the caller cannot proceed at all, it is an exception.

Applied first to the scan: `ScanResult` gains one named failure arm
per failure type (`unknown-command { word }`, `missing-value
{ option; command? }`, `too-few-params { command; got }`, …)
instead of `throw ParseError`. `chat.ts` becomes one `switch` over nine
arms (two successes → help-or-dispatch, seven failures → stderr exit 2
via the single mapping). `ParseError` either disappears or remains
only for registration bugs.

## Consequences

- Callers handle input errors by `switch`, exhaustively checked;
  no `try/catch` for the normal path.
- Tests assert returned arms directly instead of catching closures.
- Exceptions keep their alarm value: a `catch` now always means
  something really broke.
- Discipline cost: each new fallible function must declare in its spec
  which failures are arms and which are exceptions before code;
  an expected failure thrown as an exception is a review rejection.
