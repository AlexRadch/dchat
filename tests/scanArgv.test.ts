import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	scanArgv,
	ParseError,
	type Def,
	type Command,
	type ScanResult,
} from "../src/args.js";


// Fake defs: every shape the grammar allows.
const flag: Def = { kind: "flag", def: { name: "--verbose", alias: "-V" } };
const noFlag: Def = { kind: "flag", def: { name: "--no-verbose", alias: "" } };
const bareFlag: Def = { kind: "flag", def: { name: "--dry", alias: "" } };
const opt: Def = { kind: "option", def: { name: "--provider", alias: "-p", repeatable: false } };
const bareOpt: Def = {
	kind: "option",
	def: { name: "--model", alias: "", repeatable: false },
};
const repeatOpt: Def = {
	kind: "option",
	def: { name: "--tag", alias: "-t", repeatable: true },
};

function fakeCmd(defs: Def[] = [flag, noFlag, bareFlag, opt, bareOpt, repeatOpt]): Command {
	return { name: "fake", defs };
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
		assert.deepEqual(a.result.options, { "--verbose": true });
		assert.deepEqual(b.result.options, { "--verbose": true });
	});

	it("flag without alias works", () => {
		const r = scanArgv(["fake", "--dry"], [], [fakeCmd()]);
		assert.deepEqual(r.result.options, { "--dry": true });
	});

	it("--no- form writes false to the positive key", () => {
		const r = scanArgv(["fake", "--no-verbose"], [], [fakeCmd()]);
		assert.deepEqual(r.result.options, { "--verbose": false });
	});

	it("--flag then --no-flag: last wins, no error", () => {
		const r = scanArgv(["fake", "--verbose", "--no-verbose"], [], [fakeCmd()]);
		assert.deepEqual(r.result.options, { "--verbose": false });
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
		assert.deepEqual(a.result.options, { "--provider": ["faux"] });
		assert.deepEqual(b.result.options, { "--provider": ["faux"] });
	});

	it("option without alias works", () => {
		const r = scanArgv(["fake", "--model", "m1"], [], [fakeCmd()]);
		assert.deepEqual(r.result.options, { "--model": ["m1"] });
	});

	it("--opt=v stores the glued value", () => {
		const r = scanArgv(["fake", "--provider=faux"], [], [fakeCmd()]);
		assert.deepEqual(r.result.options, { "--provider": ["faux"] });
	});

	it("-ovalue stores the glued value", () => {
		const r = scanArgv(["fake", "-pfaux"], [], [fakeCmd()]);
		assert.deepEqual(r.result.options, { "--provider": ["faux"] });
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
		assert.deepEqual(r.result.options, { "--tag": ["a", "b"] });
	});
});

describe("scan: run arm (no help requested)", () => {
	it("carries command?, options, params — never help", () => {
		const r = scanArgv(["fake", "--provider", "faux", "hi"], [], [fakeCmd()]);
		assert.equal(r.kind, "run");
		assert.equal(r.result.command?.name, "fake");
		assert.deepEqual(r.result.options, { "--provider": ["faux"] });
		assert.deepEqual(r.result.params, ["hi"]);
		assert.ok(!("help" in r));
	});

	it("run without command carries parsed globals only", () => {
		const g: Def = { kind: "option", def: { name: "--provider", alias: "-p", repeatable: false } };
		const cmd: Command = { name: "other", defs: [] };
		const r = scanArgv(["--provider", "faux"], [g], [cmd]);
		assert.equal(r.kind, "run");
		assert.equal(r.result.command, undefined);
		assert.deepEqual(r.result.options, { "--provider": ["faux"] });
	});
});

describe("scan: params and --", () => {
	it("plains before and after options stay as ordered chunks", () => {
		const r = scanArgv(["fake", "hello", "--provider", "faux", "world"], [], [fakeCmd()]);
		assert.deepEqual(r.result.params, ["hello", "world"]);
		assert.deepEqual(r.result.options, { "--provider": ["faux"] });
	});

	it("option takes its following plain before params do", () => {
		const r = scanArgv(["fake", "--provider", "faux"], [], [fakeCmd()]);
		assert.deepEqual(r.result.options, { "--provider": ["faux"] });
		assert.deepEqual(r.result.params, []);
	});

	it("-- ends options: everything after is params, even -x and --help", () => {
		const r = scanArgv(["fake", "--", "--provider", "--help", "-x"], [], [fakeCmd()]);
		assert.deepEqual(r.result.params, ["--provider", "--help", "-x"]);
		assert.deepEqual(r.result.options, {});
		assert.equal(r.kind, "run");
	});
});

describe("scan: globals before command", () => {
	const g: Def = { kind: "option", def: { name: "--provider", alias: "-p", repeatable: false } };

	it("global valid before and after the word, same shape", () => {
		const cmd: Command = { name: "c", defs: [] };
		const a = scanArgv(["--provider", "faux", "c", "hi"], [g], [cmd]);
		const b = scanArgv(["c", "--provider", "faux", "hi"], [g], [cmd]);
		assert.deepEqual(a.result.options, { "--provider": ["faux"] });
		assert.deepEqual(a.result.options, b.result.options);
		assert.equal(a.result.command?.name, "c");
	});

	it("command-owned spelling before its word fails immediately", () => {
		const cmd: Command = { name: "c", defs: [g] };
		expectParseError(
			scanArgv(["--provider", "faux", "c"], [], [cmd]),
			"Unknown option: --provider.",
			2,
		);
	});

	it("command referencing the same global entry works after the word", () => {
		const cmd: Command = { name: "c", defs: [g] };
		const r = scanArgv(["c", "--provider", "faux"], [g], [cmd]);
		assert.deepEqual(r.result.options, { "--provider": ["faux"] });
	});
});

describe("scan: help arms (union)", () => {
	it("--help with no command returns general-help with parsed globals", () => {
		const g: Def = { kind: "option", def: { name: "--provider", alias: "-p", repeatable: false } };
		const cmd: Command = { name: "other", defs: [] };
		const r = scanArgv(["--provider", "faux", "--help"], [g], [cmd]);
		assert.equal(r.kind, "general-help");
		assert.deepEqual(r.result.options, { "--provider": ["faux"] });
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
		assert.deepEqual(r.result.options, { "--provider": ["faux"] });
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
	it("is a run with no command, no options, no params", () => {
		const r = scanArgv([], [], [fakeCmd()]);
		assert.equal(r.kind, "run");
		assert.equal(r.result.command, undefined);
		assert.deepEqual(r.result.options, {});
		assert.deepEqual(r.result.params, []);
	});
});
