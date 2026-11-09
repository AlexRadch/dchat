import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	scanArgv,
	MAX_PARAMS,
	type ArgDef,
	type GeneralArgDef,
	type Command,
	type ScanResult,
} from "../src/args.js";


// Fake defs: every shape the grammar allows. Fake command defs are referenced
// as own defs (global markers on them are irrelevant there); generals passed
// per-test carry their own global markers.
const flag: ArgDef = { kind: "flag", def: { name: "--verbose", alias: "-V" } };
const noFlag: ArgDef = { kind: "flag", def: { name: "--no-verbose", alias: "" } };
const bareFlag: ArgDef = { kind: "flag", def: { name: "--dry", alias: "" } };
const opt: ArgDef = { kind: "option", def: { name: "--provider", alias: "-p", repeatable: false } };
const bareOpt: ArgDef = {
	kind: "option",
	def: { name: "--model", alias: "", repeatable: false },
};
const repeatOpt: ArgDef = {
	kind: "option",
	def: { name: "--tag", alias: "-t", repeatable: true },
};
const help: GeneralArgDef = { kind: "flag", def: { name: "--help", alias: "-h", global: true } };

function fakeCmd(defs: ArgDef[] = [flag, noFlag, bareFlag, opt, bareOpt, repeatOpt]): Command {
	return { name: "fake", defs, minParams: 0, maxParams: MAX_PARAMS };
}

// ADR-003 + ADR-004: kind lives on the union arm; each expected failure is
// its own arm with exact fields — no exit codes in the scan, no shared payload.
// Narrow by kind, read via `.result`.
function expectRun(r: ScanResult): asserts r is Extract<ScanResult, { kind: "run" }> {
	assert.equal(r.kind, "run");
}

// ADR-003 + ADR-004: each failure is its own arm with exact fields —
// no exit codes in the scan, no shared payload. Narrow by kind, read `.result`.
type FailureKind = Exclude<ScanResult["kind"], "run" | "no-command">;

function expectFailure<K extends FailureKind>(
	r: ScanResult,
	kind: K,
	expected: Record<string, unknown>,
): asserts r is Extract<ScanResult, { kind: K }> {
	assert.equal(r.kind, kind);
	for (const [k, v] of Object.entries(expected)) {
		assert.deepEqual((r.result as Record<string, unknown>)[k], v);
	}
}

describe("scan: flags", () => {
	it("long and alias both store true under the long name", () => {
		const a = scanArgv(["fake", "--verbose"], [], [fakeCmd()]);
		const b = scanArgv(["fake", "-V"], [], [fakeCmd()]);
		assert.deepEqual(a.result.argValues, { "--verbose": true });
		assert.deepEqual(b.result.argValues, { "--verbose": true });
	});

	it("flag without alias works", () => {
		const r = scanArgv(["fake", "--dry"], [], [fakeCmd()]);
		assert.deepEqual(r.result.argValues, { "--dry": true });
	});

	it("--no- form writes false to the positive key", () => {
		const r = scanArgv(["fake", "--no-verbose"], [], [fakeCmd()]);
		assert.deepEqual(r.result.argValues, { "--verbose": false });
	});

	it("--flag then --no-flag: last wins, no error", () => {
		const r = scanArgv(["fake", "--verbose", "--no-verbose"], [], [fakeCmd()]);
		assert.deepEqual(r.result.argValues, { "--verbose": false });
	});

	it("second identical flag fails as too-many", () => {
		{
			const r = scanArgv(["fake", "--verbose", "--verbose"], [], [fakeCmd()]);
			expectFailure(r, "too-many", {
				message: "Too many occurrences of --verbose.",
				name: "--verbose",
			});
			if (r.kind !== "too-many") return;
			assert.equal(r.result.command?.name, "fake");
		}
	});

	it("flag with = value fails", () => {
		expectFailure(scanArgv(["fake", "--verbose=x"], [], [fakeCmd()]), "unexpected-value", {
			message: "Unexpected value for --verbose.",
			flag: "--verbose",
		});
	});

	it("-V=x fails (alias = form is not glued)", () => {
		expectFailure(scanArgv(["fake", "-V=x"], [], [fakeCmd()]), "unexpected-value", {
			message: "Unexpected value for --verbose.",
			flag: "--verbose",
		});
	});
});

describe("scan: options", () => {
	it("apart and alias forms store one-element arrays", () => {
		const a = scanArgv(["fake", "--provider", "faux"], [], [fakeCmd()]);
		const b = scanArgv(["fake", "-p", "faux"], [], [fakeCmd()]);
		assert.deepEqual(a.result.argValues, { "--provider": ["faux"] });
		assert.deepEqual(b.result.argValues, { "--provider": ["faux"] });
	});

	it("option without alias works", () => {
		const r = scanArgv(["fake", "--model", "m1"], [], [fakeCmd()]);
		assert.deepEqual(r.result.argValues, { "--model": ["m1"] });
	});

	it("--opt=v stores the glued value", () => {
		const r = scanArgv(["fake", "--provider=faux"], [], [fakeCmd()]);
		assert.deepEqual(r.result.argValues, { "--provider": ["faux"] });
	});

	it("-ovalue stores the glued value", () => {
		const r = scanArgv(["fake", "-pfaux"], [], [fakeCmd()]);
		assert.deepEqual(r.result.argValues, { "--provider": ["faux"] });
	});

	it("-o=value is an error, not a glued value", () => {
		expectFailure(scanArgv(["fake", "-p=faux"], [], [fakeCmd()]), "unexpected-value", {
			message: "Unexpected value for --provider.",
			flag: "--provider",
		});
	});

	it("missing value: end, dash-next, empty =", () => {
		expectFailure(scanArgv(["fake", "--provider"], [], [fakeCmd()]), "missing-value", {
			message: "Missing value for --provider.",
			option: "--provider",
		});
		expectFailure(scanArgv(["fake", "--provider", "--dry"], [], [fakeCmd()]), "missing-value", {
			message: "Missing value for --provider.",
			option: "--provider",
		});
		expectFailure(scanArgv(["fake", "--provider="], [], [fakeCmd()]), "missing-value", {
			message: "Missing value for --provider.",
			option: "--provider",
		});
	});

	it("second occurrence of single-shot fails, repeatable accumulates", () => {
		expectFailure(
			scanArgv(["fake", "--provider", "a", "--provider", "b"], [], [fakeCmd()]),
			"too-many",
			{
				message: "Too many occurrences of --provider.",
				name: "--provider",
				command: fakeCmd(),
			},
		);
		const r = scanArgv(["fake", "--tag", "a", "--tag", "b"], [], [fakeCmd()]);
		assert.deepEqual(r.result.argValues, { "--tag": ["a", "b"] });
	});
});

describe("scan: run arm (no help requested)", () => {
	it("carries command, options, params — never help", () => {
		const r = scanArgv(["fake", "--provider", "faux", "hi"], [], [fakeCmd()]);
		assert.equal(r.kind, "run");
		assert.equal(r.result.command.name, "fake");
		assert.deepEqual(r.result.argValues, { "--provider": ["faux"] });
		assert.deepEqual(r.result.params, ["hi"]);
		assert.ok(!("help" in r));
	});

	it("no word reports facts, not a failure", () => {
		const g: GeneralArgDef = { kind: "option", def: { name: "--provider", alias: "-p", repeatable: false, global: true } };
		const cmd: Command = { name: "other", defs: [], minParams: 0, maxParams: MAX_PARAMS };
		const r = scanArgv(["--provider", "faux"], [g], [cmd]);
		assert.equal(r.kind, "no-command");
		if (r.kind !== "no-command") return;
		assert.deepEqual(r.result.argValues, { "--provider": ["faux"] });
		assert.deepEqual(r.result.params, []);
		assert.ok(!("exitCode" in r.result));
	});
});

describe("scan: params and --", () => {
	it("plains before and after options stay as ordered chunks", () => {
		const r = scanArgv(["fake", "hello", "--provider", "faux", "world"], [], [fakeCmd()]);
		assert.deepEqual(r.result.params, ["hello", "world"]);
		assert.deepEqual(r.result.argValues, { "--provider": ["faux"] });
	});

	it("option takes its following plain before params do", () => {
		const r = scanArgv(["fake", "--provider", "faux"], [], [fakeCmd()]);
		assert.deepEqual(r.result.argValues, { "--provider": ["faux"] });
		assert.deepEqual(r.result.params, []);
	});

	it("-- ends options: everything after is params, even -x and --help", () => {
		const r = scanArgv(["fake", "--", "--provider", "--help", "-x"], [], [fakeCmd()]);
		assert.deepEqual(r.result.params, ["--provider", "--help", "-x"]);
		assert.deepEqual(r.result.argValues, {});
		assert.equal(r.kind, "run");
	});
});

describe("scan: globals before command", () => {
	const g: GeneralArgDef = { kind: "option", def: { name: "--provider", alias: "-p", repeatable: false, global: true } };

	it("global valid before and after the word, same shape", () => {
		const cmd: Command = { name: "c", defs: [], minParams: 0, maxParams: MAX_PARAMS };
		const a = scanArgv(["--provider", "faux", "c", "hi"], [g], [cmd]);
		const b = scanArgv(["c", "--provider", "faux", "hi"], [g], [cmd]);
		assert.deepEqual(a.result.argValues, { "--provider": ["faux"] });
		assert.deepEqual(a.result.argValues, b.result.argValues);
		assert.equal(a.result.command.name, "c");
	});

	it("command-owned spelling before its word fails immediately", () => {
		const cmd: Command = { name: "c", defs: [g], minParams: 0, maxParams: MAX_PARAMS };
		expectFailure(scanArgv(["--provider", "faux", "c"], [], [cmd]), "unknown-option", {
			message: "Unknown option: --provider.",
			token: "--provider",
		});
	});

	it("command referencing the same global entry works after the word", () => {
		const cmd: Command = { name: "c", defs: [g], minParams: 0, maxParams: MAX_PARAMS };
		const r = scanArgv(["c", "--provider", "faux"], [g], [cmd]);
		assert.deepEqual(r.result.argValues, { "--provider": ["faux"] });
	});
});

describe("scan: help as ordinary global flag", () => {
	function helpCmd(defs: ArgDef[] = [help]): Command {
		return { name: "fake", defs, minParams: 1, maxParams: MAX_PARAMS };
	}

	it("help with no word rides no-command, flag set", () => {
		const g: GeneralArgDef = { kind: "option", def: { name: "--provider", alias: "-p", repeatable: false, global: false } };
		const r = scanArgv(["--provider", "faux", "--help"], [g, help], [helpCmd()]);
		assert.equal(r.kind, "no-command");
		if (r.kind !== "no-command") return;
		assert.deepEqual(r.result.argValues, { "--provider": ["faux"], "--help": true });
	});

	it("-h before and after the word carry the same flag", () => {
		const zero: Command = { name: "fake", defs: [help], minParams: 0, maxParams: MAX_PARAMS };
		const a = scanArgv(["-h", "fake"], [help], [zero]);
		const b = scanArgv(["fake", "-h"], [help], [zero]);
		assert.equal(a.kind, "run");
		assert.equal(b.kind, "run");
		if (a.kind !== "run" || b.kind !== "run") return;
		assert.deepEqual(a.result.argValues, { "--help": true });
		assert.deepEqual(a.result, b.result);
	});

	it("run with help flag carries parsed values and params", () => {
		const r = scanArgv(["fake", "--provider", "faux", "hi", "-h"], [help], [helpCmd([opt, help])]);
		assert.equal(r.kind, "run");
		if (r.kind !== "run") return;
		assert.equal(r.result.command.name, "fake");
		assert.deepEqual(r.result.argValues, { "--provider": ["faux"], "--help": true });
		assert.deepEqual(r.result.params, ["hi"]);
	});

	it("repeated -h fails as too-many like any flag", () => {
		expectFailure(scanArgv(["fake", "-h", "-h"], [help], [helpCmd([help])]), "too-many", {
			message: "Too many occurrences of --help.",
			name: "--help",
		});
	});

	it("error beats help flag in either order", () => {
		expectFailure(scanArgv(["--help", "--bogus"], [help], [helpCmd()]), "unknown-option", {
			message: "Unknown option: --bogus.",
			token: "--bogus",
		});
	});

	it("help beside an option never fills its value slot", () => {
		expectFailure(
			scanArgv(["fake", "--provider", "-h"], [help], [helpCmd([opt, help])]),
			"missing-value",
			{
				message: "Missing value for --provider.",
				option: "--provider",
				command: helpCmd([opt, help]),
			},
		);
	});

	it("--help=x fails; --no-help unlisted is unknown", () => {
		expectFailure(scanArgv(["--help=x"], [help], [helpCmd()]), "unexpected-value", {
			message: "Unexpected value for --help.",
			flag: "--help",
		});
		expectFailure(scanArgv(["fake", "--no-help"], [], [helpCmd()]), "unknown-option", {
			message: "Unknown option: --no-help.",
			token: "--no-help",
		});
	});

	it("non-global general invisible after the word", () => {
		const g: GeneralArgDef = { kind: "option", def: { name: "--provider", alias: "-p", repeatable: false, global: false } };
		expectFailure(scanArgv(["fake", "--provider", "faux"], [g], [helpCmd()]), "unknown-option", {
			message: "Unknown option: --provider.",
			token: "--provider",
		});
	});

	it("re-check on word: multi-use general, single-use command rule fails", () => {
		const multi: GeneralArgDef = { kind: "option", def: { name: "--tag", alias: "-t", repeatable: true, global: true } };
		const single: GeneralArgDef = { kind: "option", def: { name: "--tag", alias: "-t", repeatable: false, global: false } };
		expectFailure(
			scanArgv(["--tag", "a", "--tag", "b", "fake"], [multi], [
				{ name: "fake", defs: [single], minParams: 0, maxParams: MAX_PARAMS },
			]),
			"too-many",
			{
				message: "Too many occurrences of --tag.",
				name: "--tag",
				command: { name: "fake", defs: [single], minParams: 0, maxParams: MAX_PARAMS },
			},
		);
	});

	it("re-check on word: single use passes under single-use command rule", () => {
		const multi: GeneralArgDef = { kind: "option", def: { name: "--tag", alias: "-t", repeatable: true, global: true } };
		const single: GeneralArgDef = { kind: "option", def: { name: "--tag", alias: "-t", repeatable: false, global: false } };
		const r = scanArgv(["--tag", "a", "fake"], [multi], [{ name: "fake", defs: [single], minParams: 0, maxParams: MAX_PARAMS }]);
		assert.equal(r.kind, "run");
	});

	it("set flag does NOT skip arity: help on arity-1 fails as Too few params", () => {
		const r = scanArgv(["fake", "-h"], [help], [helpCmd()]);
		assert.equal(r.kind, "too-few-params");
		if (r.kind !== "too-few-params") return;
		assert.equal(r.result.message, "Too few params for fake.");
		assert.equal(r.result.got, 0);
	});
});

describe("scan: errors carry the relevant help", () => {
	it("unknown global option carries general help", () => {
		expectFailure(scanArgv(["--bogus"], [], [fakeCmd()]), "unknown-option", {
			message: "Unknown option: --bogus.",
			token: "--bogus",
		});
	});

	it("unknown command-option carries command help", () => {
		expectFailure(scanArgv(["fake", "--bogus"], [], [fakeCmd()]), "unknown-option", {
			message: "Unknown option: --bogus.",
			token: "--bogus",
		});
	});

	it("unknown command word exits 1 with general help", () => {
		expectFailure(scanArgv(["badcmd"], [], [fakeCmd()]), "unknown-command", {
			message: "Unknown command: badcmd.",
			word: "badcmd",
		});
	});
});

describe("scan: empty argv", () => {
	it("empty argv with no word reports empty facts", () => {
		const r = scanArgv([], [], [fakeCmd()]);
		assert.equal(r.kind, "no-command");
		if (r.kind !== "no-command") return;
		assert.deepEqual(r.result.argValues, {});
		assert.deepEqual(r.result.params, []);
	});
});

describe("scan: arity", () => {
	function arityCmd(minParams: number, maxParams: number): Command {
		return { name: "fake", defs: [], minParams, maxParams };
	}

	it("run inside arity passes", () => {
		const r = scanArgv(["fake", "a", "b"], [], [arityCmd(1, 2)]);
		assert.equal(r.kind, "run");
	});

	it("too few params fails as too-few-params with got count", () => {
		const r = scanArgv(["fake"], [], [arityCmd(1, 2)]);
		assert.equal(r.kind, "too-few-params");
		if (r.kind !== "too-few-params") return;
		assert.equal(r.result.message, "Too few params for fake.");
		assert.equal(r.result.command.name, "fake");
		assert.equal(r.result.got, 0);
	});

	it("too many params fails as too-many-params with got count", () => {
		const r = scanArgv(["fake", "a", "b", "c"], [], [arityCmd(1, 2)]);
		assert.equal(r.kind, "too-many-params");
		if (r.kind !== "too-many-params") return;
		assert.equal(r.result.message, "Too many params for fake.");
		assert.equal(r.result.command.name, "fake");
		assert.equal(r.result.got, 3);
	});

	it("maxParams >= MAX_PARAMS means unbounded", () => {
		const chunks = Array.from({ length: 2000 }, (_, k) => `p${k}`);
		const r = scanArgv(["fake", ...chunks], [], [arityCmd(0, MAX_PARAMS)]);
		assert.equal(r.kind, "run");
	});

	it("min 0 allows empty params", () => {
		const r = scanArgv(["fake"], [], [arityCmd(0, MAX_PARAMS)]);
		assert.equal(r.kind, "run");
	});

	it("help flag on arity-1 command fails dumb (no privilege)", () => {
		const h: GeneralArgDef = { kind: "flag", def: { name: "--help", alias: "-h", global: true } };
		const r = scanArgv(["fake", "-h"], [h], [arityCmd(1, 2)]);
		assert.equal(r.kind, "too-few-params");
		if (r.kind !== "too-few-params") return;
		assert.equal(r.result.message, "Too few params for fake.");
	});

	it("bad arity shape throws (programmer bug)", () => {
		assert.throws(
			() => scanArgv(["fake"], [], [{ name: "fake", defs: [], minParams: 2, maxParams: 1 }]),
			/Bad arity for fake: min > max\./,
		);
		assert.throws(
			() => scanArgv(["fake"], [], [{ name: "fake", defs: [], minParams: -1, maxParams: 1 }]),
			/Bad arity for fake: bounds must be >= 0\./,
		);
	});
});
