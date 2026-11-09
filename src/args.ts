// Shared CLI shape (spec 002): Flag / Option / Def / Command, single-scan parser.
// --help / -h is a loop rule, never declared in any defs list.
// scanArgv is standalone: testable on fake defs, independent of any command.

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

export interface GeneralHelpPayload {
	options: Record<string, boolean | string[]>;
	help: string;
}

export interface CommandHelpPayload {
	command: Command;
	options: Record<string, boolean | string[]>;
	text?: string;
	help: string;
}

export interface RunPayload {
	command?: Command;
	options: Record<string, boolean | string[]>;
	text?: string;
}

// Discriminated union per ADR-003: the tag lives on the arms, the payloads
// stay clean (a payload knows nothing about the unions it joins). Bare
// `help?` on an unstaged result made no sense — now the arm tells it.
// Declared with interfaces (plain structural shapes, erased at runtime —
// the C# record equivalent, not class: nothing to construct or extend,
// the `kind` string already discriminates).
export type ScanResult =
	| { kind: "general-help"; result: GeneralHelpPayload }
	| { kind: "command-help"; result: CommandHelpPayload }
	| { kind: "run"; result: RunPayload };

export class ParseError extends Error {
	exitCode: 1 | 2;
	helpBlock: string;
	constructor(message: string, helpBlock: string, exitCode: 1 | 2) {
		super(message);
		this.helpBlock = helpBlock;
		this.exitCode = exitCode;
	}
}

function relevantHelp(command: Command | undefined, generalHelp: string): string {
	return command ? command.help : generalHelp;
}

function spellings(def: Def): string[] {
	const out = [def.def.name];
	if (def.def.alias !== "") out.push(def.def.alias);
	return out;
}

// Flags store under one key: positive name holds true, its --no- form writes
// false to the same key (e.g. --no-verbose clears --verbose).
function storageKey(def: Def): string {
	if (def.kind === "flag" && def.def.name.startsWith("--no-")) {
		return `--${def.def.name.slice(5)}`;
	}
	return def.def.name;
}

function dedupRefs(defs: Def[]): Def[] {
	return [...new Set(defs)];
}

// Registration errors are programmer errors: same spelling on two different
// entries is rejected loudly instead of silently shadowing.
function assertUnique(active: Def[], label: string): void {
	const seen = new Map<string, Def>();
	for (const def of active) {
		for (const s of spellings(def)) {
			const prev = seen.get(s);
			if (prev && prev !== def) {
				throw new Error(`Duplicate spelling ${s} (${label})`);
			}
			seen.set(s, def);
		}
	}
}

function findExact(active: Def[], token: string): Def | undefined {
	return active.find((d) => token === d.def.name || (d.def.alias !== "" && token === d.def.alias));
}

// Single left-to-right scan. Help is remembered, not terminal: the scan keeps
// going so later tokens may still fail (an error always beats help).
// Any other decisive token throws ParseError carrying its help block.
export function scanArgv(
	argv: string[],
	globals: Def[],
	commands: Command[],
	generalHelp: string,
): ScanResult {
	assertUnique(dedupRefs(globals), "globals");
	for (const c of commands) {
		assertUnique(dedupRefs([...globals, ...c.defs]), `command ${c.name}`);
	}
	let command: Command | undefined;
	const options: Record<string, boolean | string[]> = {};
	const counts = new Map<Def, number>();
	const texts: string[] = [];
	let endOfOptions = false;
	let helpSeen = false;

	const active = (): Def[] =>
		dedupRefs(command ? [...globals, ...command.defs] : globals);
	const helpFor = (): string => relevantHelp(command, generalHelp);
	const tooMany = (name: string): never => {
		throw new ParseError(`Too many occurrences of ${name}.`, helpFor(), 2);
	};
	const storeOption = (entry: Extract<Def, { kind: "option" }>, value: string): void => {
		if ((counts.get(entry) ?? 0) >= 1 && !entry.def.repeatable) {
			tooMany(entry.def.name);
		}
		counts.set(entry, (counts.get(entry) ?? 0) + 1);
		const prev = options[entry.def.name];
		options[entry.def.name] = [...(Array.isArray(prev) ? prev : []), value];
	};

	let i = 0;
	while (i < argv.length) {
		const t = argv[i];
		if (!endOfOptions && (t === "--help" || t === "-h")) {
			// Help needs no counts entry: repeating the same help flag is
			// harmless — it returns the same block, so it never too-manys.
			helpSeen = true;
			i++;
			continue;
		}
		if (!endOfOptions && (t.startsWith("--help=") || t.startsWith("-h="))) {
			throw new ParseError("Unexpected value for --help.", helpFor(), 2);
		}
		if (!endOfOptions && t === "--") {
			endOfOptions = true;
			i++;
			continue;
		}
		if (!endOfOptions && t.startsWith("-") && t.length > 1) {
			const list = active();
			const exact = findExact(list, t);
			if (exact) {
				if (exact.kind === "flag") {
					if ((counts.get(exact) ?? 0) >= 1) tooMany(exact.def.name);
					counts.set(exact, 1);
					options[storageKey(exact)] = exact.def.name.startsWith("--no-") ? false : true;
					i++;
					continue;
				}
				const v = argv[i + 1];
				if (v === undefined || v === "" || v === "--help" || v === "-h" || (v.startsWith("-") && v !== "--")) {
					throw new ParseError(`Missing value for ${exact.def.name}.`, helpFor(), 2);
				}
				storeOption(exact, v);
				i += 2;
				continue;
			}
			const eq = t.indexOf("=");
			if (eq > 0) {
				const lname = t.slice(0, eq);
				const suffix = t.slice(eq + 1);
				const byName = list.find((d) => lname === d.def.name);
				if (byName) {
					if (byName.kind === "flag") {
						throw new ParseError(`Unexpected value for ${byName.def.name}.`, helpFor(), 2);
					}
					if (suffix === "") {
						throw new ParseError(`Missing value for ${byName.def.name}.`, helpFor(), 2);
					}
					storeOption(byName, suffix);
					i++;
					continue;
				}
				const byAlias = list.find((d) => d.def.alias !== "" && lname === d.def.alias);
				if (byAlias) {
					throw new ParseError(`Unexpected value for ${byAlias.def.name}.`, helpFor(), 2);
				}
				throw new ParseError(`Unknown option: ${t}.`, helpFor(), 2);
			}
			const glued = list.find(
				(d) =>
					d.kind === "option" &&
					d.def.alias !== "" &&
					t.startsWith(d.def.alias) &&
					t.length > d.def.alias.length,
			);
			if (glued && glued.kind === "option") {
				storeOption(glued, t.slice(glued.def.alias.length));
				i++;
				continue;
			}
			throw new ParseError(`Unknown option: ${t}.`, helpFor(), 2);
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
		texts.push(t);
		i++;
	}
	const text = texts.length > 0 ? texts.join(" ") : undefined;
	if (helpSeen) {
		// Help selects which block to show, never hides an error (errors throw
		// above). `-h word` and `word -h` resolve the same: the word is still
		// scanned, so both land on the identical arm.
		return command
			? { kind: "command-help", result: { command, options, text, help: command.help } }
			: { kind: "general-help", result: { options, help: generalHelp } };
	}
	return { kind: "run", result: { command, options, text } };
}
