// Reads --provider / --provider=<v> / -p: lazy, first token only.
// Detach: delete the import, the call block, and the help spread in chat.ts.
export const providerHelp: string[] = [
	"  --provider P     Provider id (default: openrouter)",
];

export function readProviderArg(tokens: string[]): {
	provider?: string;
	rest: string[];
} {
	const [first, second, ...tail] = tokens;
	if (first === "--provider" || first === "-p") {
		if (second === undefined || second === "" || second.startsWith("-")) {
			throw new Error('Missing value for --provider. Try "dchat ask --help".');
		}
		return { provider: second, rest: tail };
	}
	if (first !== undefined && first.startsWith("--provider=")) {
		const v = first.slice("--provider=".length);
		if (!v) {
			throw new Error('Missing value for --provider. Try "dchat ask --help".');
		}
		const rest = second === undefined ? tail : [second, ...tail];
		return { provider: v, rest };
	}
	return { provider: undefined, rest: tokens };
}
