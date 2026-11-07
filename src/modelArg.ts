// Reads --model / --model=<v> / -m: lazy, first token only.
// Detach: delete the import, the call block, and the help spread in chat.ts.
export const modelHelp: string[] = [
	"  --model MODEL    Model id (default: first in provider catalog)",
];

export function readModelArg(tokens: string[]): {
	model?: string;
	rest: string[];
} {
	const [first, second, ...tail] = tokens;
	if (first === "--model" || first === "-m") {
		if (second === undefined || second === "" || second.startsWith("-")) {
			throw new Error('Missing value for --model. Try "dchat ask --help".');
		}
		return { model: second, rest: tail };
	}
	if (first !== undefined && first.startsWith("--model=")) {
		const v = first.slice("--model=".length);
		if (!v) {
			throw new Error('Missing value for --model. Try "dchat ask --help".');
		}
		const rest = second === undefined ? tail : [second, ...tail];
		return { model: v, rest };
	}
	return { model: undefined, rest: tokens };
}
