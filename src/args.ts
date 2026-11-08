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

// Single left-to-right scan. Help short-circuit returns { help }.
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
			const text = texts.length > 0 ? texts.join(" ") : undefined;
			return { command, options, text, help: helpFor() };
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
				if (v === undefined || v === "" || v.startsWith("-")) {
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
	return {
		command,
		options,
		text: texts.length > 0 ? texts.join(" ") : undefined,
	};
}
