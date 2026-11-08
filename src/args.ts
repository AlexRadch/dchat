// Shared CLI shape: one Option type, one Command type, single-scan parser.
// Readers are referenced by commands, never copied.

export interface Option {
	name: string;
	alias: string;
	arity: number;
	min: number;
	max: number;
}

export interface CommandRunArgs {
	options: Record<string, string[]>;
	text?: string;
}

export interface Command {
	name: string;
	options: Option[];
	help: string;
	run: (args: CommandRunArgs) => void | Promise<void>;
}

export interface ScanResult {
	command?: Command;
	options: Record<string, string[]>;
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

export const GLOBAL_OPTIONS: Option[] = [];

export const COMMANDS: Command[] = [];

function relevantHelp(command: Command | undefined, generalHelp: string): string {
	return command ? command.help : generalHelp;
}

// Single left-to-right scan. Help short-circuit returns { help }.
// Any other decisive token throws ParseError carrying its help block.
export function scanArgv(
	argv: string[],
	globalOptions: Option[],
	commands: Command[],
	generalHelp: string,
): ScanResult {
	let command: Command | undefined;
	const options: Record<string, string[]> = {};
	const counts: Record<string, number> = {};
	let text: string | undefined;
	let endOfOptions = false;
	function store(opt: Option, vals: string[]): void {
		const n = (counts[opt.name] ?? 0) + 1;
		if (n > opt.max) {
			throw new ParseError(
				`Too many occurrences of ${opt.name}.`,
				relevantHelp(command, generalHelp),
				2,
			);
		}
		counts[opt.name] = n;
		options[opt.name] = [...(options[opt.name] ?? []), ...vals];
	}
	let i = 0;
	while (i < argv.length) {
		const t = argv[i];
		if (!endOfOptions && (t === "--help" || t === "-h")) {
			return { command, options, text, help: relevantHelp(command, generalHelp) };
		}
		if (!endOfOptions && (t.startsWith("--help=") || t.startsWith("-h="))) {
			throw new ParseError(
				"Unexpected value for --help.",
				relevantHelp(command, generalHelp),
				2,
			);
		}
		if (!endOfOptions && t === "--") {
			endOfOptions = true;
			i++;
			continue;
		}
		if (!endOfOptions && t.startsWith("-") && t.length > 1) {
			const active: Option[] = [...globalOptions, ...(command ? command.options : [])];
			const exact = active.find((o) => t === o.name || t === o.alias);
			if (exact) {
				if (exact.arity === 0) {
					store(exact, []);
					i++;
					continue;
				}
				const vals: string[] = [];
				for (let k = 1; k <= exact.arity; k++) {
					const v = argv[i + k];
					if (v === undefined || v.startsWith("-") || v === "") {
						throw new ParseError(
							`Missing value for ${exact.name}.`,
							relevantHelp(command, generalHelp),
							2,
						);
					}
					vals.push(v);
				}
				store(exact, vals);
				i += 1 + exact.arity;
				continue;
			}
			const eq = t.indexOf("=");
			if (eq > 0) {
				const lname = t.slice(0, eq);
				const suffix = t.slice(eq + 1);
				const longOpt = active.find((o) => lname === o.name);
				if (longOpt) {
					if (longOpt.arity === 0) {
						throw new ParseError(
							`Unexpected value for ${longOpt.name}.`,
							relevantHelp(command, generalHelp),
							2,
						);
					}
					if (!suffix) {
						throw new ParseError(
							`Missing value for ${longOpt.name}.`,
							relevantHelp(command, generalHelp),
							2,
						);
					}
					if (longOpt.arity === 1) {
						store(longOpt, [suffix]);
						i++;
						continue;
					}
					const vals: string[] = [suffix];
					for (let k = 2; k <= longOpt.arity; k++) {
						const v = argv[i + k - 1];
						if (v === undefined || v.startsWith("-") || v === "") {
							throw new ParseError(
								`Missing value for ${longOpt.name}.`,
								relevantHelp(command, generalHelp),
								2,
							);
						}
						vals.push(v);
					}
					store(longOpt, vals);
					i += longOpt.arity;
					continue;
				}
				const shortOpt = active.find((o) => t.startsWith(o.alias + "="));
				if (shortOpt) {
					throw new ParseError(
						`Unexpected value for ${shortOpt.name}.`,
						relevantHelp(command, generalHelp),
						2,
					);
				}
			} else {
				const shortOpt = active.find((o) => t.startsWith(o.alias + "="));
				if (shortOpt) {
					throw new ParseError(
						`Unexpected value for ${shortOpt.name}.`,
						relevantHelp(command, generalHelp),
						2,
					);
				}
			}
			throw new ParseError(
				`Unknown option: ${t}.`,
				relevantHelp(command, generalHelp),
				2,
			);
		}
		if (!command && !endOfOptions) {
			const found = commands.find((c) => c.name === t);
			if (found) {
				command = found;
				i++;
				continue;
			}
			throw new ParseError(`Unknown command: ${t}.`, generalHelp, 1);
		}
		if (text !== undefined) {
			throw new ParseError(
				`Unexpected extra text: "${t}". Did you forget quotes?`,
				relevantHelp(command, generalHelp),
				2,
			);
		}
		text = t;
		i++;
	}
	if (!command && text !== undefined) {
		throw new ParseError(`Unknown command: ${text}.`, generalHelp, 1);
	}
	const active: Option[] = [...globalOptions, ...(command ? command.options : [])];
	for (const opt of active) {
		if ((counts[opt.name] ?? 0) < opt.min) {
			throw new ParseError(
				`Missing required option: ${opt.name}.`,
				relevantHelp(command, generalHelp),
				2,
			);
		}
	}
	return { command, options, text };
}
