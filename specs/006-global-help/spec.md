# Feature Specification: Global Help Option

**Feature Branch**: `006-global-help`

**Created**: 2026-11-07

**Parent**: `specs/002-argument-readers/spec.md` (single scan loop: FR-014; this spec fixes the help behavior the loop implements inline).

**Input**: User description: "Global --help/-h handled by the entry-point scan itself: general help with no command, verbatim command block with a command; scan stops, handler never called."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - General help with no command yet (Priority: P1)

A user runs `dchat --help` or `dchat -h` and sees the general help (global flags plus the command list), exit 0. No command runs.

**Why this priority**: Help must work even when every command is parked or unknown.

**Independent Test**: `dchat --help` and `dchat -h` print the same general block, exit 0, even with an empty command table.

**Acceptance Scenarios**:

1. **Given** no command word has been scanned yet, **When** the loop meets `--help` or `-h`, **Then** it prints the general help block to stdout and exits 0.
2. **Given** any tokens follow `--help` (e.g. `dchat --help ask`), **When** the loop meets `--help`, **Then** it still prints general help and stops — the rest is ignored, no error, exit 0.

---

### User Story 2 - Command help after the command word (Priority: P1)

A user runs `dchat ask --help` and sees exactly the block that the `ask` command registered — printed verbatim, exit 0. The ask handler never runs.

**Why this priority**: Per-command help belongs to the loop, so handlers never see help requests.

**Independent Test**: `dchat ask --help` prints the registered `ask.help` byte-for-byte; the handler call count stays zero.

**Acceptance Scenarios**:

1. **Given** the `ask` command is registered with its `help` block, **When** the loop meets `--help` after the `ask` word, **Then** it prints the `help` block verbatim and exits 0 without calling the handler.
2. **Given** `--help` appears BEFORE the command (`dchat --help ask`), **When** the scan runs, **Then** general help is printed — command help is NOT selected, because no command word was known yet.

---

### User Story 3 - Help with a value is an error, with help (Priority: P2)

A user writes `--help=x` and gets an arity error naming `--help`, followed by the general help block on stderr — not help on stdout.

**Why this priority**: Arity is fixed at 0; smuggled values must fail loudly like every other arity violation, and per FR-017 every error carries its help block.

**Independent Test**: `dchat --help=x` → stderr names `--help` AND contains the general help block; exit 2; stdout empty.

**Acceptance Scenarios**:

1. **Given** `--help` with arity 0, **When** the user writes `--help=x` or `-h=x`, **Then** the program reports the arity error naming `--help`, prints general help on stderr, and exits 2.

---

### User Story 4 - No arguments at all (Priority: P1)

A user runs bare `dchat` with zero tokens and gets the general help block on stderr, exit 2 — same text as `--help`, but on the error channel because nothing was asked.

**Why this priority**: Bare invocation is the most common beginner mistake; it must teach, not go silent, and its non-zero exit keeps scripts from mistaking it for success.

**Independent Test**: `dchat` with `argv = []` → stderr contains the general help block, stdout empty, exit 2.

**Acceptance Scenarios**:

1. **Given** zero command-line tokens, **When** the entry point runs, **Then** it prints the general help block to stderr and exits 2 without invoking the scan or any handler.

---

### Edge Cases

- `-h` behaves exactly like `--help` in every position.
- Help works with an empty command table (all commands parked): general help lists zero commands, exit 0.
- Help text is stored in the `Command.help` field at registration; the loop MUST NOT compose it from option definitions.
- A lone `--help` with no command table and no other tokens: general help, exit 0.
- Unknown global option BEFORE `--help` (`dchat --porvider --help`): the scan stops at `--porvider` — error + general help on stderr, exit 2. Tokens after the error are ignored.
- Unknown global option AFTER `--help` (`dchat --help --porvider`): `--help` wins — general help on stdout, exit 0. The rest is ignored, no error.
- Unknown command word (`dchat badcmd --help`): `badcmd` is not a known command — error + general help on stderr, exit 1. `dchat --help badcmd`: general help on stdout, exit 0.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `--help` / `-h` MUST be handled inline in the entry-point scan, never in a reader file and never in a command handler.
- **FR-002**: `--help` / `-h` has fixed arity 0. Any `=` form (`--help=x`, `-h=x`) MUST fail as an arity error naming `--help`, exit code 2.
- **FR-003**: When `--help`/`-h` is met before any command word, the loop MUST print the general help block (global flags plus registered command names) to stdout and exit 0 immediately. Tokens after it are ignored.
- **FR-004**: When `--help`/`-h` is met after a command word, the loop MUST print that command's registered `help` block verbatim (byte-for-byte, no composition) to stdout and exit 0 immediately. The handler MUST NOT be called.
- **FR-005**: `dchat --help ask` (help before the command) MUST print general help, NOT command help. Position decides: help answers what is known at its own position.
- **FR-006**: Help output MUST go to stdout, exit code 0. Help MUST work with zero registered commands.
- **FR-007**: Help-vs-error order: the scan stops at the FIRST decisive token. Error before `--help` → error + relevant help block on stderr (per 002 FR-017), exit 2/1; `--help` is never reached. `--help` before the error → help on stdout, exit 0; the error is never reached.
- **FR-008**: Bare invocation (`argv` empty, zero tokens) MUST print the general help block to stderr and exit 2, without invoking the scan or any handler. Same text as `--help`, error channel because nothing was asked.

### Key Entities

- **Global help flag**: `--help` / `-h`, arity 0, inline in the loop. The only help in the program until per-command specs add more commands.
- **General help block**: verbatim text listing global flags plus command names. Owned by the entry point.
- **Command help block**: `Command.help`, a complete ready-to-print text registered with the command. Printed verbatim, never composed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `dchat --help` and `dchat -h` print identical general help, exit 0, with an empty command table.
- **SC-002**: `dchat ask --help` prints the registered block byte-for-byte; the handler is never called.
- **SC-003**: `dchat --help=x` fails naming `--help` AND prints general help on stderr; exit 2; stdout empty.
- **SC-004**: `dchat --help ask` prints general help (not command help), exit 0.
- **SC-005**: `dchat --porvider --help` → error + general help on stderr, exit 2. `dchat --help --porvider` → general help on stdout, exit 0.
- **SC-006**: `dchat badcmd --help` → unknown-command error + general help on stderr, exit 1. `dchat --help badcmd` → general help on stdout, exit 0.
- **SC-007**: `dchat` with zero tokens → general help on stderr, stdout empty, exit 2; no handler called.

## Assumptions

- Loop mechanics (single scan, activation, errors) live in `002-argument-readers` and are not repeated here.
- The `ask` command and its help block arrive with the ask command spec; until then only general help is observable.
