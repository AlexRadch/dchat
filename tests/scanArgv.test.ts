import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	scanArgv,
	MAX_PARAMS,
	type ArgDef,
	type Command,
	type ScanResult,
} from "../src/args.js";


// Fake defs: every shape the grammar allows.
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

function fakeCmd(defs: ArgDef[] = [flag, noFlag, bareFlag, opt, bareOpt, repeatOpt]): Command {
	return { name: "fake", defs, minParams: 0, maxParams: MAX_PARAMS };
}

// ADR-003 + ADR-004: kind lives on the union arm; expected failures return
// the parse-error arm, never throw. Narrow by kind, read via `.result`.
function expectRun(r: ScanResult): asserts r is Extract<ScanResult, { kind: "run" }> {
	assert.equal(r.kind, "run");
}

function expectParseError(
	r: ScanResult,
	message: string,
	exitCode: 1 | 2,
	commandName?: string,
): asserts r is Extract<ScanResult, { kind: "parse-error" }> {
	assert.equal(r.kind, "parse-error");
	assert.equal(r.result.message, message);
	assert.equal(r.result.exitCode, exitCode);
	assert.equal(r.result.command?.name, commandName);
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
		expectParseError(
			scanArgv(["fake", "--verbose", "--verbose"], [], [fakeCmd()]),
			"Too many occurrences of --verbose.",
			2, "fake",
		);
	});

	it("flag with = value fails", () => {
		expectParseError(
			scanArgv(["fake", "--verbose=x"], [], [fakeCmd()]),
			"Unexpected value for --verbose.",
			2, "fake",
		);
	});

	it("-V=x fails (alias = form is not glued)", () => {
		expectParseError(
			scanArgv(["fake", "-V=x"], [], [fakeCmd()]),
			"Unexpected value for --verbose.",
			2, "fake",
		);
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
		expectParseError(
			scanArgv(["fake", "-p=faux"], [], [fakeCmd()]),
			"Unexpected value for --provider.",
			2, "fake",
		);
	});

	it("missing value: end, dash-next, empty =", () => {
		expectParseError(
			scanArgv(["fake", "--provider"], [], [fakeCmd()]),
			"Missing value for --provider.",
			2, "fake",
		);
		expectParseError(
			scanArgv(["fake", "--provider", "--dry"], [], [fakeCmd()]),
			"Missing value for --provider.",
			2, "fake",
		);
		expectParseError(
			scanArgv(["fake", "--provider="], [], [fakeCmd()]),
			"Missing value for --provider.",
			2, "fake",
		);
	});

	it("second occurrence of single-shot fails, repeatable accumulates", () => {
		expectParseError(
			scanArgv(["fake", "--provider", "a", "--provider", "b"], [], [fakeCmd()]),
			"Too many occurrences of --provider.",
			2, "fake",
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
		const g: ArgDef = { kind: "option", def: { name: "--provider", alias: "-p", repeatable: false } };
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
	const g: ArgDef = { kind: "option", def: { name: "--provider", alias: "-p", repeatable: false } };

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
		expectParseError(
			scanArgv(["--provider", "faux", "c"], [], [cmd]),
			"Unknown option: --provider.",
			2,
		);
	});

	it("command referencing the same global entry works after the word", () => {
		const cmd: Command = { name: "c", defs: [g], minParams: 0, maxParams: MAX_PARAMS };
		const r = scanArgv(["c", "--provider", "faux"], [g], [cmd]);
		assert.deepEqual(r.result.argValues, { "--provider": ["faux"] });
	});
});

describe("scan: help arms (union)", () => {
	it("--help with no command returns general-help with parsed globals", () => {
		const g: ArgDef = { kind: "option", def: { name: "--provider", alias: "-p", repeatable: false } };
		const cmd: Command = { name: "other", defs: [], minParams: 0, maxParams: MAX_PARAMS };
		const r = scanArgv(["--provider", "faux", "--help"], [g], [cmd]);
		assert.equal(r.kind, "general-help");
		assert.deepEqual(r.result.argValues, { "--provider": ["faux"] });
	});

	it("-h before and after the word return the identical command-help", () => {
		const a = scanArgv(["-h", "fake"], [], [fakeCmd()]);
		const b = scanArgv(["fake", "-h"], [], [fakeCmd()]);
		assert.equal(a.kind, "command-help");
		assert.equal(b.kind, "command-help");
		if (a.kind !== "command-help" || b.kind !== "command-help") return;
		assert.equal(a.result.command.name, "fake");
		assert.deepEqual(a, b);
	});

	it("command-help carries parsed options and params", () => {
		const r = scanArgv(["fake", "--provider", "faux", "hi", "-h"], [], [fakeCmd()]);
		assert.equal(r.kind, "command-help");
		if (r.kind !== "command-help") return;
		assert.equal(r.result.command.name, "fake");
		assert.deepEqual(r.result.argValues, { "--provider": ["faux"] });
		assert.deepEqual(r.result.params, ["hi"]);
	});


	it("repeated -h is harmless, not too-many", () => {
		const r = scanArgv(["fake", "-h", "-h"], [], [fakeCmd()]);
		assert.equal(r.kind, "command-help");
	});


	it("error beats help in either order", () => {
		expectParseError(
			scanArgv(["--help", "--bogus"], [], [fakeCmd()]),
			"Unknown option: --bogus.",
			2,
		);
	});

	it("help beside an option never fills its value slot", () => {
		expectParseError(
			scanArgv(["fake", "--provider", "-h"], [], [fakeCmd()]),
			"Missing value for --provider.",
			2, "fake",
		);
	});


	it("--help=x fails; --no-help is unknown", () => {
		expectParseError(
			scanArgv(["--help=x"], [], [fakeCmd()]),
			"Unexpected value for --help.",
			2,
		);
		expectParseError(
			scanArgv(["fake", "--no-help"], [], [fakeCmd()]),
			"Unknown option: --no-help.",
			2, "fake",
		);
	});
});

describe("scan: errors carry the relevant help", () => {
	it("unknown global option carries general help", () => {
		expectParseError(
			scanArgv(["--bogus"], [], [fakeCmd()]),
			"Unknown option: --bogus.",
			2,
		);
	});

	it("unknown command-option carries command help", () => {
		expectParseError(
			scanArgv(["fake", "--bogus"], [], [fakeCmd()]),
			"Unknown option: --bogus.",
			2, "fake",
		);
	});

	it("unknown command word exits 1 with general help", () => {
		expectParseError(
			scanArgv(["badcmd"], [], [fakeCmd()]),
			"Unknown command: badcmd.",
			1,
		);
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

	it("too few params fails as parse-error", () => {
		const r = scanArgv(["fake"], [], [arityCmd(1, 2)]);
		assert.equal(r.kind, "parse-error");
		if (r.kind !== "parse-error") return;
		assert.equal(r.result.message, "Too few params for fake.");
		assert.equal(r.result.exitCode, 2);
		assert.equal(r.result.command?.name, "fake");
	});

	it("too many params fails as parse-error", () => {
		const r = scanArgv(["fake", "a", "b", "c"], [], [arityCmd(1, 2)]);
		assert.equal(r.kind, "parse-error");
		if (r.kind !== "parse-error") return;
		assert.equal(r.result.message, "Too many params for fake.");
		assert.equal(r.result.exitCode, 2);
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

	it("help skips the arity check", () => {
		const r = scanArgv(["fake", "-h"], [], [arityCmd(1, 2)]);
		assert.equal(r.kind, "command-help");
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
