// Key option definition: one shared Option + help fragment.
// No scanning lives here — the loop in args.ts owns all parsing.
// Detach: remove the reference from the command's options list and
// its lines from that command's verbatim help block.
import type { Option } from "./args.js";

export const keyOption: Option = {
	name: "--key",
	alias: "-k",
	arity: 1,
	min: 0,
	max: 1,
};

export const keyHelp: string[] = [
	"  --key SPEC       Key, or its source: literal, env:NAME, env,",
	"                   file:PATH, dotenv:PATH[?VAR=NAME], dotenv[:VAR=NAME],",
	"                   keychain[:SERVICE[:ACCOUNT]].",
	"                   Without --key: {PROVIDER}_API_KEY from env, ./.env,",
	"                   ~/.env, OS keychain.",
];
