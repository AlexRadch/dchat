# Feature Specification: Argument Readers with Two-Phase Dispatch

**Feature Branch**: `002-argument-readers`

**Created**: 2026-11-07

**Status**: Amended 2026-11-07 — two-phase dispatch: global readers + command handlers, fixed arity, free option/text order (see FR-010–FR-016).

**Input**: User description: "Parse the command line in small detachable pieces. Each piece reads its own options and returns the unread remainder. After all pieces run, anything unread that looks like an option is an error. Removing a piece removes its options from the accepted set."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ask with known options still works (Priority: P1)

A user runs `dchat ask` with the usual options (`--provider`, `--key`, `--model`) and a single text token. The question is answered, help is unchanged, exit codes are unchanged.

**Why this priority**: This is the existing product surface. The parsing refactor must not change what the user sees.

**Independent Test**: Run `dchat ask --provider faux "Hi"`, `dchat ask --key <k> "Hi"`, and `dchat ask --help`; compare stdout/stderr/exit codes with the previous behavior.

**Acceptance Scenarios**:

1. **Given** the standard readers are registered, **When** the user runs `dchat ask --provider faux "Hi"`, **Then** the question is answered exactly as before.
2. **Given** the standard readers are registered, **When** the user runs `dchat ask --help`, **Then** the help lists exactly the options of the registered readers, no more and no less.

---

### User Story 2 - Detaching a reader removes its options (Priority: P1)

A builder of the application removes one argument reader (e.g. the one reading `--provider` from the command line) from the registration list, and from then on that option is no longer accepted: passing it fails as an unknown option.

**Why this priority**: This is the whole point of the feature — optional pieces that can be compiled out by commenting out one registration line.

**Independent Test**: Remove the provider reader from the registration list, rebuild, run `dchat ask --provider faux "Hi"` and check it fails as an unknown option; run `dchat ask --help` and check the provider option is gone from the help.

**Acceptance Scenarios**:

1. **Given** the provider reader is removed from the registration list, **When** the user runs `dchat ask --provider faux "Hi"`, **Then** the program reports an unknown option naming `--provider` and exits with a usage error.
2. **Given** the provider reader is removed from the registration list, **When** the user runs `dchat ask --help`, **Then** the help no longer mentions the provider option.

---

### User Story 3 - Unknown options are rejected, never silently ignored (Priority: P2)

A user mistypes an option (`--porvider`) and gets a clear error naming the offending token instead of the program silently falling back to defaults.

**Why this priority**: Silent ignores turn typos into mystery behavior (wrong provider, wrong key source). A loud error is the accepted terminal-tool convention.

**Independent Test**: Run `dchat ask --porvider faux "Hi"` with the standard readers registered and check stderr names `--porvider` with a usage-error exit code.

**Acceptance Scenarios**:

1. **Given** the standard readers are registered, **When** the user passes an option no reader claims (`--porvider`), **Then** the program reports `Unknown option: --porvider` with a hint toward `ask --help` and exits with a usage error.

---

### User Story 4 - Command owns its tail (Priority: P1)

A user runs a second command (e.g. `chat`) whose option set differs from `ask` (extra `--name`, no `--provider` for a `config`-like command). Each command accepts only its own options; a foreign option fails as unknown for that command.

**Why this priority**: This is why two-phase dispatch exists — one global parser cannot know per-command shapes.

**Independent Test**: Register `ask` (provider/key/model) and a stub `chat` (provider/key/model + name). `dchat chat --name c "Hi"` works; `dchat ask --name c "Hi"` fails as unknown option for `ask`.

**Acceptance Scenarios**:

1. **Given** command `ask` does not own `--name`, **When** the user runs `dchat ask --name c "Hi"`, **Then** the program reports `Unknown option: --name` with a hint toward `dchat ask --help`.
2. **Given** command `config` does not own `--provider`, **When** the user runs `dchat config --provider faux`, **Then** the program reports an unknown option even though `ask` accepts it.

---

### Edge Cases

- An option that needs a value is given none (`--provider` at the end, or followed by another option, or `--provider=` with an empty value): usage error naming the option (`Missing value for --provider`), not an empty value silently accepted.
- Repetition resolves per `min`/`max`: within bounds values append in order; beyond `max` the loop throws immediately (FR-009); below `min` the loop throws after the scan.
- `--help` / `-h` before any command shows general help (command list); `--help` / `-h` after a command short-circuits to that command's help; option parsing does not run in either case. `dchat --help ask` (help flag with a positional) is NOT a supported form.
- The option loop is gone from readers: per FR-002/FR-005 only the entry-point scan walks tokens. A detached option's short alias goes away together with its long form (e.g. removing the provider definition removes both `--provider` and `-p`). `options[tag]` accumulates raw `string[]` per FR-009 (no last-wins).
- Option words (the question text) are never claimed by options and never reported as unknown options. Command text is exactly one token — `ask "Hi there"` and `ask Hi` are valid; `ask Hi there` (two leftover tokens) MUST fail naming `there` with a quote hint.
- `dchat --provider faux ask "Hi"` (shared option before the command) is accepted only while that option keeps the same fixed arity in every command; otherwise it is valid only after the command.
- A lone `--` ends option processing: every token after it is text, even one starting with `-`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The command line MUST be parsed by a single argument-processing loop in the entry point. The loop is fed three lists at once: global options, command words, and each command's own options. No parsing lives inside command handlers — a handler receives the finished parse state (options + text) and only validates and executes.
- **FR-002**: Each option definition owns its spellings: one long form, its `=` form, and exactly one short alias (e.g. `--provider` / `--provider=<v>` / `-p`). A second short alias is NOT allowed for now. Commands have NO aliases for now (`ask` is only `ask`). Within the currently active set, no two options may claim the same spelling. This spec fixes no spellings — each option's spec (003, 004, 005, ...) owns its own definition. One option definition is written once and MAY be registered under several commands (e.g. the same provider option in both `ask` and `chat`); command registrations reference it, never copy its spellings, arity, or bounds.
- **FR-003**: Every option MUST declare a fixed arity: the exact number of values it consumes — 0 (flag, e.g. `--help`), 1 (e.g. `--provider P`), or N. Variable arity ("0 or 1", "1 or 2") is FORBIDDEN. An option with an optional value in the GNU sense is forbidden in dchat; the wanted behavior MUST be split into a zero-arity flag plus a separate fixed-arity option, or into a fixed-arity option with an explicit default word (e.g. `--color auto`). Every option MUST also declare occurrence bounds: `min` (0 or more) and `max` (a number or unbounded, written `Infinity` in code). `max` MUST be ≥ `min`. Examples: `--provider` is `min 0, max 1`; `--attach` is `min 0, max Infinity`; a required command flag is `min 1, max 1`.
- **FR-004**: Within one parse, one spelling MUST keep one arity everywhere it is accepted. An option name with different arities in different commands MUST NOT appear before the command word; it is valid only after the command, inside the handler that owns it.
- **FR-005**: The loop MUST NOT interpret values. On scan it takes each occurrence's flag plus exactly its arity count of values and appends the raw strings exactly as typed to `options[tag]` in order, always as an array: arity 0 → `[]` (presence only), arity 1 → `[string]`, arity N → `[string × N]` in order. No number/enum/path conversion, no validation. The loop MUST NOT mutate shared state and MUST NOT decide validity (unknown provider ids, bad numbers, missing required options are decided later per FR-009 and by the command handler, which converts strings to its own types and reports its own type errors).
- **FR-006**: Collected options are passed to the command handler as `options: Record<string, string[]>` — tag → raw `string[]` values only (arity 0 stores `[]`, arity 1 stores one element, arity N stores N elements). The command word itself consumes exactly one token and is always a plain string. The handler converts strings to its own types and reports its own type errors. (Internal loop bookkeeping — how the scan threads `arguments`/`command` through its own locals — is an implementation detail and is NOT part of this spec.)
- **FR-007**: The entry point loop makes a single left-to-right scan over the whole command line. Global options (`--help`/`-h`, arity 0, plus any shared option explicitly registered as global with a uniform shape) are active from the first token. Command words are recognized wherever they appear: the first non-option token that names a known command becomes the command word (`command`). There is exactly one command word. A second command word is an error (unknown command), not a second command. Options of a command become active only after its word; options of a command that was not named stay inactive and their spellings fall into the unknown-option error.
- **FR-008**: Once the loop finishes, the entry point MUST call exactly one command handler — a single function per command (`handleAsk`, `handleChat`, ...) — passing it the finished parse state (collected options plus the single text token). The handler does NO parsing and NEVER sees a help request: if `--help`/`-h` appeared anywhere, the loop already printed help and stopped before the call. File layout (one file per command vs. shared file) is an implementation detail; one command = one handler function is the contract.
- **FR-009**: Occurrence bounds are enforced by the loop, never by handlers. Each occurrence appends its `string[]` values to `options[tag]` in order. Exceeding `max` MUST fail immediately as `Too many occurrences of <option>.` on stderr with the FR-017 help block, exit code 2. After the scan, any active option with fewer than `min` occurrences MUST fail as `Missing required option: <option>.` on stderr with the FR-017 help block, exit code 2. Non-repeatable (`max 1`) options MUST NOT silently last-win: a second occurrence is the too-many error.
- **FR-010**: A command handler MUST accept its options in any order relative to the text. `dchat ask --provider faux "Hi"`, `dchat ask "Hi" --provider faux`, and `dchat ask --provider faux "Hi" --model m` are all valid and equivalent. Options consume exactly their arity; whatever no option claims and does not start with `-` is text.
- **FR-010**: Command text is defined as exactly one leftover non-option token. Shell quoting is resolved by the shell before dchat runs, so `ask "Hi there"` arrives as one token and `ask Hi` arrives as one token; both are valid. Two or more leftover non-option tokens MUST fail as extra text (exit code 2), e.g. `ask -p p Hi there` fails naming `there` with a quote hint. Quoting is needed only to protect spaces/specials from the shell; dchat itself never sees the quotes.
- **FR-011**: Any token that looks like an option (starts with `-`, except the `--` delimiter itself) but is claimed by no active option MUST be reported as `Unknown option: <token>` on stderr, followed on stderr by the relevant help block — FR-017. Exit code 2.
- **FR-012**: A bare `--` token ends option processing: it is consumed itself and every token after it is text unconditionally, even one starting with `-`.
- **FR-013**: Detaching an option (removing it from the registration list) MUST remove its spellings from the accepted set: its former spellings fall into the FR-011 unknown-option error, and its help lines disappear from the help output.
- **FR-014**: Help is owned by the entry-point loop, never by handlers. Each command registers its complete ready-to-print help block together with its options at registration time. The block is printed verbatim — the loop MUST NOT compose help lines from option definitions, so blocks may use any language or layout. `--help`/`-h` with no command yet prints general help (global flags plus command names) to stdout. `--help`/`-h` once a command word is known prints that command's block to stdout. In either case the loop stops immediately: the handler is NOT called. Exit code 0. Each option definition MUST still contribute its own help fragment so the blocks stay exact.
- **FR-015**: An option requiring a value with no value present (end of tokens, next token is another option unless consumed via `=` form, or empty `=` value) MUST fail as `Missing value for <option>` on stderr, followed on stderr by the relevant help block — FR-017. Exit code 2. An empty value MUST never be accepted as a real value. Each option's own spec names its option in the message. The `=` form MUST be written with no spaces (`--opt=v`); `--opt = v` and `--opt= v` are always errors (three/one broken tokens, never a value). An `=` value on an arity-0 option (`--help=x`) is the same error naming that option.
- **FR-016**: Command-level requirements (is `--provider` required or defaulted? is text required?) MUST be decided by the command handler AFTER parsing, never by the loop. `ask` defaults a missing provider; another command MAY fail on it. The loop only collects, then enforces FR-009 bounds.
- **FR-017**: Every parse error MUST print the relevant help block after the error line, on stderr (not stdout). Which block: general help if no command word is known at the error position; that command's verbatim block if a command word is already known. This covers: unknown global option/command (general), unknown command option (that command's), missing/empty value (help of the side where the option lives), extra text token (help of the side where the text lives), unknown command word (general). Success-path `--help` stays on stdout, exit 0 — errors never print to stdout.

### Key Entities

- **Option**: one shared shape for global and command options — long name, exactly one short alias, fixed arity, occurrence bounds (`min`/`max`, `Infinity` = unbounded). E.g. `--provider` / `-p` / arity 1 / `min 0, max 1`; `--attach` / `-a` / arity 1 / `min 0, max Infinity`. Global and command options are the same type; a command registration references the shared definition, never copies it.
- **Command**: one shape per command — name word (no aliases for now), its own option list (`Option[]`, references to shared definitions where shapes match), a complete ready-to-print help block (`help`), and the handler function. No help text is ever generated from options — the block is printed verbatim, so any language or layout works.
- **Global option**: an option registered in the entry point, valid from the first token. Allowed only with a uniform shape across all commands. Today: `--help` (arity 0, `min 0, max 1`). Shared options (e.g. `--provider` with identical shape everywhere) MAY be registered here as a convenience; a command that does not own the option rejects it.
- **Command handler**: one function per command. Receives the finished parse state, validates its own requirements, executes. Does no parsing, never handles `--help`. The entry point knows the command name → handler mapping plus the command's registered options and help block.
- **Option definition**: one file per option family (`providerOption`, `keyOption`, `modelOption`) owning its spellings (one long + `=` form + exactly one short alias), its fixed arity, its occurrence bounds, and its help fragment. It parses NOTHING — scanning is owned by the loop. Detachable by removing it from the registration list.
- **Registration list**: the single place in the entry point naming everything the loop knows — global options, the command table (word → handler + its option list + its help block). The only edit needed to add or remove capability.
- **Remainder / text**: the tokens no option has claimed. Exactly one leftover non-option token becomes the command text; two or more is an extra-text error.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With all standard readers registered, asking via every existing option works exactly as before (same stdout, same stderr, same exit codes), plus the free-order form (`ask "Hi" --provider faux`) works identically.
- **SC-002**: Removing one reader from the registration list makes its option spellings fail as unknown options and removes its help lines, with no other code touched.
- **SC-003**: A mistyped option is named in the error output and exits with a usage error; it never silently falls back to a default.
- **SC-004**: An option with a missing value fails with a missing-value error naming the option; an empty value is never accepted.
- **SC-005**: A foreign option for a command (`ask --name x`, `config --provider x`) fails as unknown for that command while remaining valid for the command that owns it.
- **SC-006**: `ask "Hi there"` and `ask Hi` are accepted as one text token; `ask Hi there` (two leftover tokens) fails naming `there` with a quote hint.

## Assumptions

- The standard set today is one command (`ask`) with three readers: provider (003), key (004), model (005). `chat`/`config` are future commands with their own specs, not built here; this spec only fixes the two-phase mechanics they will plug into.
- General help (`dchat --help`) and command routing (unknown command error) stay in the entry point; per-command help and per-command validation live in the handler.
- The existing unknown-provider check (known ids listed, exit code 2) stays where it is; this spec covers only option parsing, not provider-id validation.
