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
}

// NOTE: execution (`run`) and help texts live above the scan, in the entry
// point and command modules — never here. The scan only resolves names,
// defs, options and text.

export interface GeneralHelpPayload {
	options: Record<string, boolean | string[]>;
}

export interface CommandHelpPayload {
	command: Command;
	options: Record<string, boolean | string[]>;
	text?: string;
}

export interface RunPayload {
	command?: Command;
	options: Record<string, boolean | string[]>;
	text?: string;
}

export interface ParseErrorPayload {
	message: string;
	exitCode: 1 | 2;
	command?: Command;
}

// Discriminated union per ADR-003 + ADR-004: the tag lives on the arms, the
// payloads stay clean (a payload knows nothing about the unions it joins).
// Expected scan failures are the parse-error arm (message + exit code +
// resolved word; no help text — the entry point restores the block itself),
// never exceptions. Bare `help?` on an unstaged result made no sense — now
// the arm tells it.
// Declared with interfaces (plain structural shapes, erased at runtime —
// the C# record equivalent, not class: nothing to construct or extend,
// the `kind` string already discriminates).
export type ScanResult =
	| { kind: "general-help"; result: GeneralHelpPayload }
	| { kind: "command-help"; result: CommandHelpPayload }
	| { kind: "run"; result: RunPayload }
	| { kind: "parse-error"; result: ParseErrorPayload };

// Registration errors are programmer bugs (ADR-004: truly exceptional —
// no meaningful value to return), so they stay thrown as plain Errors.
// Expected input failures never throw: they return the parse-error arm.

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
// Expected input failures return the parse-error arm (ADR-004), never throw.
// Only programmer bugs (duplicate registration) throw, as plain Errors.
export function scanArgv(
	argv: string[],
	globals: Def[],
	commands: Command[],
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
	const fail = (message: string, exitCode: 1 | 2): ScanResult => ({
		kind: "parse-error",
		result: { message, exitCode, command },
	});
	const tooMany = (name: string): ScanResult => {
		return fail(`Too many occurrences of ${name}.`, 2);
	};
	const storeOption = (entry: Extract<Def, { kind: "option" }>, value: string): ScanResult | undefined => {
		if ((counts.get(entry) ?? 0) >= 1 && !entry.def.repeatable) {
			return tooMany(entry.def.name);
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
			return fail("Unexpected value for --help.", 2);
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
					if ((counts.get(exact) ?? 0) >= 1) return tooMany(exact.def.name);
					counts.set(exact, 1);
					options[storageKey(exact)] = exact.def.name.startsWith("--no-") ? false : true;
					i++;
					continue;
				}
				const v = argv[i + 1];
				if (v === undefined || v === "" || v === "--help" || v === "-h" || (v.startsWith("-") && v !== "--")) {
					return fail(`Missing value for ${exact.def.name}.`, 2);
				}
				const stored = storeOption(exact, v);
				if (stored) return stored;
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
						return fail(`Unexpected value for ${byName.def.name}.`, 2);
					}
					if (suffix === "") {
						return fail(`Missing value for ${byName.def.name}.`, 2);
					}
					const storedByName = storeOption(byName, suffix);
					if (storedByName) return storedByName;
					i++;
					continue;
				}
				const byAlias = list.find((d) => d.def.alias !== "" && lname === d.def.alias);
				if (byAlias) {
					return fail(`Unexpected value for ${byAlias.def.name}.`, 2);
				}
				return fail(`Unknown option: ${t}.`, 2);
			}
			const glued = list.find(
				(d) =>
					d.kind === "option" &&
					d.def.alias !== "" &&
					t.startsWith(d.def.alias) &&
					t.length > d.def.alias.length,
			);
			if (glued && glued.kind === "option") {
				const storedGlued = storeOption(glued, t.slice(glued.def.alias.length));
				if (storedGlued) return storedGlued;
				i++;
				continue;
			}
			return fail(`Unknown option: ${t}.`, 2);
		}
		if (!command && !endOfOptions) {
			const found = commands.find((c) => c.name === t);
			if (found) {
				command = found;
				i++;
				continue;
			}
			return fail(`Unknown command: ${t}.`, 1);
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
				? { kind: "command-help", result: { command, options, text } }
				: { kind: "general-help", result: { options } };
		}
		return { kind: "run", result: { command, options, text } };
}
