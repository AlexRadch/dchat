# Architecture Decision Records

Short index. Read this file always; read a single ADR only when its row says it covers your task.

| ADR | Title | Status | Covers |
|-----|-------|--------|--------|
| [001-pi-durable-typescript](./001-pi-durable-typescript.md) | Pi-Durable as the framework, TypeScript as the language | accepted | Framework choice, local+cloud run, why specs stay technology-free |
| [002-lightweight-di](./002-lightweight-di.md) | Dependencies via function arguments, no IoC container | accepted | Composition in the entry point, wiring checked by the compiler |
| [003-tagged-unions](./003-tagged-unions.md) | Type unions carry an explicit string tag on the union, not on the members | accepted | How to mix types (`ArgDef`, `ScanResult`): `kind` lives on the union arms, members stay clean |
| [004-expected-errors-as-values](./004-expected-errors-as-values.md) | Expected failures are values, not exceptions | accepted | Input/grammar errors are union arms (ADR-003); exceptions are only for the unexpected (I/O, resources, programmer bugs) |
