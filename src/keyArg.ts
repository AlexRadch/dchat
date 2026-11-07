// Reads --key / --key=<v> / -k: lazy, first token only.
// Detach: delete the import, the call block, and the help spread in chat.ts.
export const keyHelp: string[] = [
	"  --key SPEC       Key, or its source: literal, env:NAME, env,",
	"                   file:PATH, dotenv:PATH[?VAR=NAME], dotenv[:VAR=NAME],",
	"                   keychain[:SERVICE[:ACCOUNT]].",
	"                   Without --key: {PROVIDER}_API_KEY from env, ./.env,",
	"                   ~/.env, OS keychain.",
];

export function readKeyArg(tokens: string[]): {
	key?: string;
	rest: string[];
} {
	const [first, second, ...tail] = tokens;
	if (first === "--key" || first === "-k") {
		if (second === undefined || second === "" || second.startsWith("-")) {
			throw new Error('Missing value for --key. Try "dchat ask --help".');
		}
		return { key: second, rest: tail };
	}
	if (first !== undefined && first.startsWith("--key=")) {
		const v = first.slice("--key=".length);
		if (!v) {
			throw new Error('Missing value for --key. Try "dchat ask --help".');
		}
		const rest = second === undefined ? tail : [second, ...tail];
		return { key: v, rest };
	}
	return { key: undefined, rest: tokens };
}
