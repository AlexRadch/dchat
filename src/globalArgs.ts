// Global command-line arguments for commands (spec 008).
// Valid before any command word and after every command word, one shape everywhere.
// --help / -h is NOT listed here: it is a loop rule (spec 002 FR-007).
import type { Def } from "./args.js";

export const GLOBAL_ARGS: Def[] = [
	{ kind: "option", def: { name: "--provider", alias: "-p", repeatable: false } },
	{ kind: "option", def: { name: "--key", alias: "-k", repeatable: false } },
	{ kind: "option", def: { name: "--model", alias: "-m", repeatable: false } },
];
