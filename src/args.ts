// Shared CLI shape (spec 002): Flag / Option / Def / Command, single-scan parser.
// --help / -h is a loop rule, never declared in any defs list.
// Full scan arrives with the ask command spec; until then this is types + stub.

export interface Flag {
	name: string;
	alias: string;
}

export interface Option {
	name: string;
	alias: string;
	repeatable: boolean;
}

// kind lives only where the two are mixed; Flag and Option stay clean.
export type Def = { kind: "flag"; def: Flag } | { kind: "option"; def: Option };

export interface Command {
	name: string;
	defs: Def[];
	help: string;
}

export interface RunCommand extends Command {
	run: (options: Record<string, boolean | string[]>, text?: string) => void | Promise<void>;
}

export interface ScanResult {
	command?: Command;
	options: Record<string, boolean | string[]>;
	text?: string;
	help?: string;
}

export class ParseError extends Error {
	exitCode: 1 | 2;
	helpBlock: string;
	constructor(message: string, helpBlock: string, exitCode: 1 | 2) {
		super(message);
		this.helpBlock = helpBlock;
		this.exitCode = exitCode;
	}
}

// STUB scan: real loop arrives with the ask command spec (no commands to debug
// against yet). Returns general help without error so the entry point prints usage.
export function scanArgv(
	argv: string[],
	globals: Def[],
	commands: Command[],
	generalHelp: string,
): ScanResult {
	void argv;
	void globals;
	void commands;
	return { command: undefined, options: {}, text: undefined, help: generalHelp };
}
