// Shared CLI shape (spec 002): Flag / Option / ArgDef / Command, single-scan parser.
// No hard-coded spellings: every dash-token resolves through the visible defs.
// scanArgv is standalone: testable on fake defs, independent of any command.
// Scan only: names, defs, values, chunks. Help texts and execution live above (see spec 002 Scope).
// The largest params count any command accepts. Doubles as the infinity
// marker: maxParams >= MAX_PARAMS means "no upper bound" (unbounded arity).
// A plain integer, not Infinity — it fits every language's int type
// (1024 argv entries never happen in practice).
export const MAX_PARAMS = 1024;

export interface Flag {
	name: string;
	alias: string;
}

export interface Option {
	name: string;
	alias: string;
	repeatable: boolean;
}

// kind lives only in the wrapper; Flag and Option stay clean.
// General heirs carry the marker — command-side entries cannot have it:
// global: true stays visible after a command word.
export type ArgDef = { kind: "flag"; def: Flag } | { kind: "option"; def: Option };

export interface GeneralFlag extends Flag {
	global: boolean;
}

export interface GeneralOption extends Option {
	global: boolean;
}

export type GeneralArgDef =
	| { kind: "flag"; def: GeneralFlag }
	| { kind: "option"; def: GeneralOption };

export interface Command {
	name: string;
	defs: ArgDef[];
	// Param arity: how many param chunks the command accepts.
	// Both bounds required, integers, 0 <= minParams <= maxParams.
	// maxParams >= MAX_PARAMS means unbounded (no upper check);
	// ask uses { minParams: 1, maxParams: MAX_PARAMS }.
	minParams: number;
	maxParams: number;
}

// Single named map for every flag state and option value, declared once
// and used by every result arm: flags store booleans, options store arrays.
export type ArgValues = Record<string, boolean | string[]>;

export interface NoCommandPayload {
	argValues: ArgValues;
	params: string[];
}

export interface RunPayload {
	command: Command;
	argValues: ArgValues;
	params: string[];
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
// never exceptions.
// A set help flag is NOT a scan outcome: it rides inside argValues of the
// normal arm (run / no-command) and the entry point reads it first.
// Declared with interfaces (plain structural shapes, erased at runtime —
// the C# record equivalent, not class: nothing to construct or extend,
// the `kind` string already discriminates).
export type ScanResult =
	| { kind: "run"; result: RunPayload }
	| { kind: "no-command"; result: NoCommandPayload }
	| { kind: "parse-error"; result: ParseErrorPayload };

// Registration errors are programmer bugs (ADR-004: truly exceptional —
// no meaningful value to return), so they stay thrown as plain Errors.
// Expected input failures never throw: they return the parse-error arm.

function spellings(def: ArgDef | GeneralArgDef): string[] {
	const out = [def.def.name];
	if (def.def.alias !== "") out.push(def.def.alias);
	return out;
}

// Flags store under one key: positive name holds true, its --no- form writes
// false to the same key (e.g. --no-verbose clears --verbose).
function storageKey(def: ArgDef | GeneralArgDef): string {
	if (def.kind === "flag" && def.def.name.startsWith("--no-")) {
		return `--${def.def.name.slice(5)}`;
	}
	return def.def.name;
}

function dedupRefs<T extends ArgDef | GeneralArgDef>(defs: T[]): T[] {
	return [...new Set(defs)];
}

// Registration errors are programmer errors: same spelling on two different
// entries is rejected loudly instead of silently shadowing. The same
// referenced object counted twice is one rule, not a duplicate.
function assertUnique(active: (ArgDef | GeneralArgDef)[], label: string): void {
	const seen = new Map<string, ArgDef | GeneralArgDef>();
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

// Arity shape is a programmer bug (negative, min > max), so it throws.
// Bad counts on the line are expected input failures (parse-error arm).
function assertArityShape(command: Command): void {
	const { minParams, maxParams } = command;
	if (!Number.isInteger(minParams) || !Number.isInteger(maxParams)) {
		throw new Error(`Bad arity for ${command.name}: bounds must be integers.`);
	}
	if (minParams < 0 || maxParams < 0) {
		throw new Error(`Bad arity for ${command.name}: bounds must be >= 0.`);
	}
	if (minParams > maxParams) {
		throw new Error(`Bad arity for ${command.name}: min > max.`);
	}
}

function findExact(active: (ArgDef | GeneralArgDef)[], token: string): ArgDef | GeneralArgDef | undefined {
	return active.find((d) => token === d.def.name || (d.def.alias !== "" && token === d.def.alias));
}

// Single left-to-right scan. No hard-coded spellings: every dash-token
// resolves through the visible defs. Expected input failures return the
// parse-error arm (ADR-004), never throw.
// Only programmer bugs (duplicate registration) throw, as plain Errors.
export function scanArgv(
	argv: string[],
	generals: GeneralArgDef[],
	commands: Command[],
): ScanResult {
	assertUnique(dedupRefs(generals), "generals");
	// Only general entries carry global — narrowing by property presence,
	// never by name; command entries cannot be mistaken for generals.
	const isGlobal = (d: ArgDef | GeneralArgDef): d is GeneralArgDef =>
		"global" in d.def && (d.def as { global?: boolean }).global === true;
	for (const c of commands) {
		// The same referenced general counted twice is one rule (dedupRefs);
		// a DIFFERENT object with the same spelling is the command's rule
		// after its word (fallback order per FR-001) — NOT a duplicate.
		// Only clashes OUTSIDE the command's own spellings collide loudly.
		const ownSpelled = new Set(c.defs.flatMap(spellings));
		const globalOnly = generals.filter((g) => isGlobal(g) && !c.defs.includes(g as ArgDef));
		assertUnique(
			dedupRefs(globalOnly.filter((g) => !spellings(g).some((s) => ownSpelled.has(s)))),
			`command ${c.name}`,
		);
		assertArityShape(c);
	}
	let command: Command | undefined;
	const argValues: ArgValues = {};
	const counts = new Map<ArgDef | GeneralArgDef, number>();
	const texts: string[] = [];
	let endOfOptions = false;

	// Before the word only generals are visible; after it the command's own
	// defs are tried first, then generals with global: true — never the rest.
	const active = (): (ArgDef | GeneralArgDef)[] =>
		dedupRefs(command ? [...command.defs, ...generals.filter(isGlobal)] : generals);
	// Dumb rule resolution (spec 002 FR-001): the command's own entry wins
	// after its word, else the global general. Never compared, never validated.
	const ruleFor = (entry: ArgDef | GeneralArgDef): ArgDef | GeneralArgDef => {
		if (!command) return entry;
		if (command.defs.includes(entry as ArgDef)) return entry;
		const spelled = spellings(entry);
		return (
			command.defs.find((d) => spellings(d).some((s) => spelled.includes(s))) ??
			generals.find((g) => isGlobal(g) && spellings(g).some((s) => spelled.includes(s))) ??
			entry
		);
	};
	const fail = (message: string, exitCode: 1 | 2): ScanResult => ({
		kind: "parse-error",
		result: { message, exitCode, command },
	});
	const tooMany = (name: string): ScanResult => {
		return fail(`Too many occurrences of ${name}.`, 2);
	};
	const storeOption = (entry: Extract<ArgDef | GeneralArgDef, { kind: "option" }>, value: string): ScanResult | undefined => {
		if ((counts.get(entry) ?? 0) >= 1 && !entry.def.repeatable) {
			return tooMany(entry.def.name);
		}
		counts.set(entry, (counts.get(entry) ?? 0) + 1);
		const prev = argValues[entry.def.name];
		argValues[entry.def.name] = [...(Array.isArray(prev) ? prev : []), value];
	};

	let i = 0;
	while (i < argv.length) {
		const t = argv[i];
		if (!endOfOptions && t === "--") {
			endOfOptions = true;
			i++;
			continue;
		}
		if (!endOfOptions && t.startsWith("-") && t.length > 1) {
			const list = active();
			const exact = findExact(list, t);
			if (exact) {
				const rule = ruleFor(exact);
				if (rule.kind === "flag") {
					if ((counts.get(rule) ?? 0) >= 1) return tooMany(rule.def.name);
					counts.set(rule, 1);
					argValues[storageKey(rule)] = rule.def.name.startsWith("--no-") ? false : true;
					i++;
					continue;
				}
				const v = argv[i + 1];
				if (v === undefined || v === "" || (v.startsWith("-") && v !== "--")) {
					return fail(`Missing value for ${rule.def.name}.`, 2);
				}
				const stored = storeOption(rule, v);
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
					const rule = ruleFor(byName);
					if (rule.kind === "flag") {
						return fail(`Unexpected value for ${rule.def.name}.`, 2);
					}
					if (suffix === "") {
						return fail(`Missing value for ${rule.def.name}.`, 2);
					}
					const storedByName = storeOption(rule, suffix);
					if (storedByName) return storedByName;
					i++;
					continue;
				}
				const byAlias = list.find((d) => d.def.alias !== "" && lname === d.def.alias);
				if (byAlias) {
					return fail(`Unexpected value for ${ruleFor(byAlias).def.name}.`, 2);
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
				const rule = ruleFor(glued);
				if (rule.kind !== "option") {
					return fail(`Unexpected value for ${rule.def.name}.`, 2);
				}
				const storedGlued = storeOption(rule, t.slice(glued.def.alias.length));
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
				// Dumb re-check (spec 002 FR-001): everything collected before
				// the word is re-checked against the command's rule for it.
				// Same object is one rule; a different object with one spelling
				// is the command's rule now — counts restart under it.
				const before = new Map<ArgDef, number>();
				for (const [entry, n] of counts) {
					const rule = ruleFor(entry);
					before.set(rule, (before.get(rule) ?? 0) + n);
				}
				counts.clear();
				for (const [rule, n] of before) {
					if (rule.kind === "flag") {
						if (n >= 1) {
							if ((counts.get(rule) ?? 0) >= 1) return tooMany(rule.def.name);
							counts.set(rule, 1);
						}
						continue;
					}
					if (!rule.def.repeatable && n > 1) return tooMany(rule.def.name);
					counts.set(rule, n);
				}
				i++;
				continue;
			}
			return fail(`Unknown command: ${t}.`, 1);
		}
		texts.push(t);
		i++;
	}
	// No joining here: the scan hands over raw chunks in order; the command
	// joins them as it needs (ask joins with one space).
	// A run always carries a command: with no word there is nothing to
	// dispatch to, so the scan reports facts instead of failing — the entry
	// point decides (help flag → block; params present → error; empty → help).
	// No exitCode here: a missing word is a normal outcome, not a failure.
	if (!command) {
		return { kind: "no-command", result: { argValues, params: texts } };
	}
	// Arity is checked on the run path, always — a set flag changes nothing.
	// A help flag on an arity-1 command fails as Too few params (dumb).
	if (texts.length < command.minParams) {
		return fail(`Too few params for ${command.name}.`, 2);
	}
	if (command.maxParams < MAX_PARAMS && texts.length > command.maxParams) {
		return fail(`Too many params for ${command.name}.`, 2);
	}
	return { kind: "run", result: { command, argValues, params: texts } };
}
