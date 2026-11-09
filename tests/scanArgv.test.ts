import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	scanArgv,
	ParseError,
	type Def,
	type Command,
	type ScanResult,
} from "../src/args.js";

const GENERAL = "GENERAL_HELP";
const CMD_HELP = "CMD_HELP";

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
	return { name: "fake", defs, help: CMD_HELP };
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
		const a = scanArgv(["fake", "--verbose"], [], [fakeCmd()], GENERAL);
		const b = scanArgv(["fake", "-V"], [], [fakeCmd()], GENERAL);
		assert.deepEqual(a.result.options, { "--verbose": true });
		assert.deepEqual(b.result.options, { "--verbose": true });
	});

	it("flag without alias works", () => {
		const r = scanArgv(["fake", "--dry"], [], [fakeCmd()], GENERAL);
		assert.deepEqual(r.result.options, { "--dry": true });
	});

	it("--no- form writes false to the positive key", () => {
		const r = scanArgv(["fake", "--no-verbose"], [], [fakeCmd()], GENERAL);
		assert.deepEqual(r.result.options, { "--verbose": false });
	});

	it("--flag then --no-flag: last wins, no error", () => {
		const r = scanArgv(["fake", "--verbose", "--no-verbose"], [], [fakeCmd()], GENERAL);
		assert.deepEqual(r.result.options, { "--verbose": false });
	});

	it("second identical flag fails as too-many", () => {
		expectParseError(
			scanArgv(["fake", "--verbose", "--verbose"], [], [fakeCmd()], GENERAL),
			"Too many occurrences of --verbose.",
			2, "fake",
		);
	});

	it("flag with = value fails", () => {
		expectParseError(
			scanArgv(["fake", "--verbose=x"], [], [fakeCmd()], GENERAL),
			"Unexpected value for --verbose.",
			2, "fake",
		);
	});

	it("-V=x fails (alias = form is not glued)", () => {
		expectParseError(
			scanArgv(["fake", "-V=x"], [], [fakeCmd()], GENERAL),
			"Unexpected value for --verbose.",
			2, "fake",
		);
	});
});

describe("scan: options", () => {
	it("apart and alias forms store one-element arrays", () => {
		const a = scanArgv(["fake", "--provider", "faux"], [], [fakeCmd()], GENERAL);
		const b = scanArgv(["fake", "-p", "faux"], [], [fakeCmd()], GENERAL);
		assert.deepEqual(a.result.options, { "--provider": ["faux"] });
		assert.deepEqual(b.result.options, { "--provider": ["faux"] });
	});

	it("option without alias works", () => {
		const r = scanArgv(["fake", "--model", "m1"], [], [fakeCmd()], GENERAL);
		assert.deepEqual(r.result.options, { "--model": ["m1"] });
	});

	it("--opt=v stores the glued value", () => {
		const r = scanArgv(["fake", "--provider=faux"], [], [fakeCmd()], GENERAL);
		assert.deepEqual(r.result.options, { "--provider": ["faux"] });
	});

	it("-ovalue stores the glued value", () => {
		const r = scanArgv(["fake", "-pfaux"], [], [fakeCmd()], GENERAL);
		assert.deepEqual(r.result.options, { "--provider": ["faux"] });
	});

	it("-o=value is an error, not a glued value", () => {
		expectParseError(
			scanArgv(["fake", "-p=faux"], [], [fakeCmd()], GENERAL),
			"Unexpected value for --provider.",
			2, "fake",
		);
	});

	it("missing value: end, dash-next, empty =", () => {
		expectParseError(
			scanArgv(["fake", "--provider"], [], [fakeCmd()], GENERAL),
			"Missing value for --provider.",
			2, "fake",
		);
		expectParseError(
			scanArgv(["fake", "--provider", "--dry"], [], [fakeCmd()], GENERAL),
			"Missing value for --provider.",
			2, "fake",
		);
		expectParseError(
			scanArgv(["fake", "--provider="], [], [fakeCmd()], GENERAL),
			"Missing value for --provider.",
			2, "fake",
		);
	});

	it("second occurrence of single-shot fails, repeatable accumulates", () => {
		expectParseError(
			scanArgv(["fake", "--provider", "a", "--provider", "b"], [], [fakeCmd()], GENERAL),
			"Too many occurrences of --provider.",
			2, "fake",
		);
		const r = scanArgv(["fake", "--tag", "a", "--tag", "b"], [], [fakeCmd()], GENERAL);
		assert.deepEqual(r.result.options, { "--tag": ["a", "b"] });
	});
});

describe("scan: run arm (no help requested)", () => {
	it("carries command?, options, text? — never help", () => {
		const r = scanArgv(["fake", "--provider", "faux", "hi"], [], [fakeCmd()], GENERAL);
		assert.equal(r.kind, "run");
		assert.equal(r.result.command?.name, "fake");
		assert.deepEqual(r.result.options, { "--provider": ["faux"] });
		assert.equal(r.result.text, "hi");
		assert.ok(!("help" in r));
	});

	it("run without command carries parsed globals only", () => {
		const g: Def = { kind: "option", def: { name: "--provider", alias: "-p", repeatable: false } };
		const cmd: Command = { name: "other", defs: [], help: CMD_HELP };
		const r = scanArgv(["--provider", "faux"], [g], [cmd], GENERAL);
		assert.equal(r.kind, "run");
		assert.equal(r.result.command, undefined);
		assert.deepEqual(r.result.options, { "--provider": ["faux"] });
	});
});

describe("scan: text and --", () => {
	it("plains before and after options join into one text", () => {
		const r = scanArgv(["fake", "hello", "--provider", "faux", "world"], [], [fakeCmd()], GENERAL);
		assert.equal(r.result.text, "hello world");
		assert.deepEqual(r.result.options, { "--provider": ["faux"] });
	});

	it("option takes its following plain before text does", () => {
		const r = scanArgv(["fake", "--provider", "faux"], [], [fakeCmd()], GENERAL);
		assert.deepEqual(r.result.options, { "--provider": ["faux"] });
		assert.equal(r.result.text, undefined);
	});

	it("-- ends options: everything after is text, even -x and --help", () => {
		const r = scanArgv(["fake", "--", "--provider", "--help", "-x"], [], [fakeCmd()], GENERAL);
		assert.equal(r.result.text, "--provider --help -x");
		assert.deepEqual(r.result.options, {});
		assert.equal(r.kind, "run");
	});
});

describe("scan: globals before command", () => {
	const g: Def = { kind: "option", def: { name: "--provider", alias: "-p", repeatable: false } };

	it("global valid before and after the word, same shape", () => {
		const cmd: Command = { name: "c", defs: [], help: CMD_HELP };
		const a = scanArgv(["--provider", "faux", "c", "hi"], [g], [cmd], GENERAL);
		const b = scanArgv(["c", "--provider", "faux", "hi"], [g], [cmd], GENERAL);
		assert.deepEqual(a.result.options, { "--provider": ["faux"] });
		assert.deepEqual(a.result.options, b.result.options);
		assert.equal(a.result.command?.name, "c");
	});

	it("command-owned spelling before its word fails immediately", () => {
		const cmd: Command = { name: "c", defs: [g], help: CMD_HELP };
		expectParseError(
			scanArgv(["--provider", "faux", "c"], [], [cmd], GENERAL),
			"Unknown option: --provider.",
			2,
		);
	});

	it("command referencing the same global entry works after the word", () => {
		const cmd: Command = { name: "c", defs: [g], help: CMD_HELP };
		const r = scanArgv(["c", "--provider", "faux"], [g], [cmd], GENERAL);
		assert.deepEqual(r.result.options, { "--provider": ["faux"] });
	});
});

describe("scan: help arms (union)", () => {
	it("--help with no command returns general-help with parsed globals", () => {
		const g: Def = { kind: "option", def: { name: "--provider", alias: "-p", repeatable: false } };
		const cmd: Command = { name: "other", defs: [], help: CMD_HELP };
		const r = scanArgv(["--provider", "faux", "--help"], [g], [cmd], GENERAL);
		assert.equal(r.kind, "general-help");
		assert.equal(r.result.help, GENERAL);
		assert.deepEqual(r.result.options, { "--provider": ["faux"] });
	});

	it("-h before and after the word return the identical command-help", () => {
		const a = scanArgv(["-h", "fake"], [], [fakeCmd()], GENERAL);
		const b = scanArgv(["fake", "-h"], [], [fakeCmd()], GENERAL);
		assert.equal(a.kind, "command-help");
		assert.equal(b.kind, "command-help");
		if (a.kind !== "command-help" || b.kind !== "command-help") return;
		assert.equal(a.result.command.name, "fake");
		assert.deepEqual(a, b);
	});

	it("command-help carries parsed options and text", () => {
		const r = scanArgv(["fake", "--provider", "faux", "hi", "-h"], [], [fakeCmd()], GENERAL);
		assert.equal(r.kind, "command-help");
		if (r.kind !== "command-help") return;
		assert.equal(r.result.command.name, "fake");
		assert.equal(r.result.help, CMD_HELP);
		assert.deepEqual(r.result.options, { "--provider": ["faux"] });
		assert.equal(r.result.text, "hi");
	});


	it("repeated -h is harmless, not too-many", () => {
		const r = scanArgv(["fake", "-h", "-h"], [], [fakeCmd()], GENERAL);
		assert.equal(r.kind, "command-help");
	});


	it("error beats help in either order", () => {
		expectParseError(
			scanArgv(["--help", "--bogus"], [], [fakeCmd()], GENERAL),
			"Unknown option: --bogus.",
			2,
		);
	});

	it("help beside an option never fills its value slot", () => {
		expectParseError(
			scanArgv(["fake", "--provider", "-h"], [], [fakeCmd()], GENERAL),
			"Missing value for --provider.",
			2, "fake",
		);
	});


	it("--help=x fails; --no-help is unknown", () => {
		expectParseError(
			scanArgv(["--help=x"], [], [fakeCmd()], GENERAL),
			"Unexpected value for --help.",
			2,
		);
		expectParseError(
			scanArgv(["fake", "--no-help"], [], [fakeCmd()], GENERAL),
			"Unknown option: --no-help.",
			2, "fake",
		);
	});
});

describe("scan: errors carry the relevant help", () => {
	it("unknown global option carries general help", () => {
		expectParseError(
			scanArgv(["--bogus"], [], [fakeCmd()], GENERAL),
			"Unknown option: --bogus.",
			2,
		);
	});

	it("unknown command-option carries command help", () => {
		expectParseError(
			scanArgv(["fake", "--bogus"], [], [fakeCmd()], GENERAL),
			"Unknown option: --bogus.",
			2, "fake",
		);
	});

	it("unknown command word exits 1 with general help", () => {
		expectParseError(
			scanArgv(["badcmd"], [], [fakeCmd()], GENERAL),
			"Unknown command: badcmd.",
			1,
		);
	});
});

describe("scan: empty argv", () => {
	it("is a run with no command, no options, no text", () => {
		const r = scanArgv([], [], [fakeCmd()], GENERAL);
		assert.equal(r.kind, "run");
		assert.equal(r.result.command, undefined);
		assert.deepEqual(r.result.options, {});
		assert.equal(r.result.text, undefined);
	});
});
