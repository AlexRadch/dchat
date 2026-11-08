// Provider option definition: one shared Option + help fragment.
// No scanning lives here — the loop in args.ts owns all parsing.
// Detach: remove the reference from the command's options list and
// its lines from that command's verbatim help block.
import type { Option } from "./args.js";

export const providerOption: Option = {
	name: "--provider",
	alias: "-p",
	arity: 1,
	min: 0,
	max: 1,
};

export const providerHelp: string[] = [
	"  --provider P     Provider id (default: openrouter)",
];
