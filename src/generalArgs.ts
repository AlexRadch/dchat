// General command-line arguments for commands (spec 008).
// Valid before any command word; only global: true stays visible after it.
// Each entry is exported individually so commands reference it (never copy it):
// fix a spelling here and every command picks it up.
// A command that needs a non-global general references the entry (e.g. ask
// references these three); the generals spec never names which commands use them.
// helpFlag is a plain flag entry (global) owned by nobody special:
// the scan treats it like any flag, the entry point gives it meaning.
import type { GeneralArgDef } from "./args.js";

export const providerOption: GeneralArgDef = {
	kind: "option",
	def: { name: "--provider", alias: "-p", repeatable: false, global: false },
};

export const keyOption: GeneralArgDef = {
	kind: "option",
	def: { name: "--key", alias: "-k", repeatable: false, global: false },
};

export const modelOption: GeneralArgDef = {
	kind: "option",
	def: { name: "--model", alias: "-m", repeatable: false, global: false },
};

export const helpFlag: GeneralArgDef = {
	kind: "flag",
	def: { name: "--help", alias: "-h", global: true },
};

export const GENERAL_ARGS: GeneralArgDef[] = [providerOption, keyOption, modelOption, helpFlag];
