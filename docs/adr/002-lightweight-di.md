# ADR-002: Dependencies via function arguments, no IoC container

**Status**: accepted
**Date**: 2026-11-07
**Deciders**: project owner + agent

## Context

Modules take swappable dependencies (key sources, storage, models, tools).
TypeScript offers heavy IoC containers (InversifyJS, TSyringe, NestJS modules)
with decorators, `reflect-metadata`, and runtime bindings.

## Decision

No IoC container. Dependencies travel as plain function arguments;
composition happens in one place (the entry point). Each swappable part is a
small function or object of one shape; the entry point decides which
implementation to pass. Swapping one implementation (e.g. a screen logger for
a composite screen+file logger) changes the entry point only — components
keep taking the same argument shape. No framework, no decorators,
no `reflect-metadata`.

## Consequences

- Zero new dependencies; the compiler checks wiring (a forgotten argument is a
  type error, not a runtime surprise).
- Each part stays independently testable by passing fakes as arguments.
- The project is small; manual composition fits and stays.
