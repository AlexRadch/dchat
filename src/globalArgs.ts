// Global command-line arguments for commands (spec 008).
// Valid before any command word and after every command word, one shape everywhere.
// Each entry is exported individually so commands reference it (never copy it):
// fix a spelling here and every command picks it up.
// A command that needs a global references the entry (e.g. ask references
// these three); the globals spec never names which commands use them.
import type { Def } from "./args.js";

export const providerOption: Def = {
	kind: "option",
	def: { name: "--provider", alias: "-p", repeatable: false },
};

export const keyOption: Def = {
	kind: "option",
	def: { name: "--key", alias: "-k", repeatable: false },
};

export const modelOption: Def = {
	kind: "option",
	def: { name: "--model", alias: "-m", repeatable: false },
};

export const GLOBAL_ARGS: Def[] = [providerOption, keyOption, modelOption];
