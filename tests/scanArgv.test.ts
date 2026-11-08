import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	scanArgv,
	ParseError,
	type Def,
	type Command,
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

function expectParseError(
	fn: () => unknown,
	message: string,
	helpBlock: string,
	exitCode: 1 | 2,
): void {
	try {
		fn();
	} catch (e) {
		assert.ok(e instanceof ParseError);
		assert.equal(e.message, message);
		assert.equal(e.helpBlock, helpBlock);
		assert.equal(e.exitCode, exitCode);
		return;
	}
	assert.fail("expected ParseError");
}

describe("scan: flags", () => {
	it("long and alias both store true under the long name", () => {
		const a = scanArgv(["fake", "--verbose"], [], [fakeCmd()], GENERAL);
		const b = scanArgv(["fake", "-V"], [], [fakeCmd()], GENERAL);
		assert.deepEqual(a.options, { "--verbose": true });
		assert.deepEqual(b.options, { "--verbose": true });
	});

	it("flag without alias works", () => {
		const r = scanArgv(["fake", "--dry"], [], [fakeCmd()], GENERAL);
		assert.deepEqual(r.options, { "--dry": true });
	});

	it("--no- form writes false to the positive key", () => {
		const r = scanArgv(["fake", "--no-verbose"], [], [fakeCmd()], GENERAL);
		assert.deepEqual(r.options, { "--verbose": false });
	});

	it("--flag then --no-flag: last wins, no error", () => {
		const r = scanArgv(["fake", "--verbose", "--no-verbose"], [], [fakeCmd()], GENERAL);
		assert.deepEqual(r.options, { "--verbose": false });
	});

	it("second identical flag fails as too-many", () => {
		expectParseError(
			() => scanArgv(["fake", "--verbose", "--verbose"], [], [fakeCmd()], GENERAL),
			"Too many occurrences of --verbose.",
			CMD_HELP,
			2,
		);
	});

	it("flag with = value fails", () => {
		expectParseError(
			() => scanArgv(["fake", "--verbose=x"], [], [fakeCmd()], GENERAL),
			"Unexpected value for --verbose.",
			CMD_HELP,
			2,
		);
	});

	it("-V=x fails (alias = form is not glued)", () => {
		expectParseError(
			() => scanArgv(["fake", "-V=x"], [], [fakeCmd()], GENERAL),
			"Unexpected value for --verbose.",
			CMD_HELP,
			2,
		);
	});
});

describe("scan: options", () => {
	it("apart and alias forms store one-element arrays", () => {
		const a = scanArgv(["fake", "--provider", "faux"], [], [fakeCmd()], GENERAL);
		const b = scanArgv(["fake", "-p", "faux"], [], [fakeCmd()], GENERAL);
		assert.deepEqual(a.options, { "--provider": ["faux"] });
		assert.deepEqual(b.options, { "--provider": ["faux"] });
	});

	it("option without alias works", () => {
		const r = scanArgv(["fake", "--model", "m1"], [], [fakeCmd()], GENERAL);
		assert.deepEqual(r.options, { "--model": ["m1"] });
	});

	it("--opt=v stores the glued value", () => {
		const r = scanArgv(["fake", "--provider=faux"], [], [fakeCmd()], GENERAL);
		assert.deepEqual(r.options, { "--provider": ["faux"] });
	});

	it("-ovalue stores the glued value", () => {
		const r = scanArgv(["fake", "-pfaux"], [], [fakeCmd()], GENERAL);
		assert.deepEqual(r.options, { "--provider": ["faux"] });
	});

	it("-o=value is an error, not a glued value", () => {
		expectParseError(
			() => scanArgv(["fake", "-p=faux"], [], [fakeCmd()], GENERAL),
			"Unexpected value for --provider.",
			CMD_HELP,
			2,
		);
	});

	it("missing value: end, dash-next, empty =", () => {
		expectParseError(
			() => scanArgv(["fake", "--provider"], [], [fakeCmd()], GENERAL),
			"Missing value for --provider.",
			CMD_HELP,
			2,
		);
		expectParseError(
			() => scanArgv(["fake", "--provider", "--dry"], [], [fakeCmd()], GENERAL),
			"Missing value for --provider.",
			CMD_HELP,
			2,
		);
		expectParseError(
			() => scanArgv(["fake", "--provider="], [], [fakeCmd()], GENERAL),
			"Missing value for --provider.",
			CMD_HELP,
			2,
		);
	});

	it("second occurrence of single-shot fails, repeatable accumulates", () => {
		expectParseError(
			() => scanArgv(["fake", "--provider", "a", "--provider", "b"], [], [fakeCmd()], GENERAL),
			"Too many occurrences of --provider.",
			CMD_HELP,
			2,
		);
		const r = scanArgv(["fake", "--tag", "a", "--tag", "b"], [], [fakeCmd()], GENERAL);
		assert.deepEqual(r.options, { "--tag": ["a", "b"] });
	});
});

describe("scan: text and --", () => {
	it("plains before and after options join into one text", () => {
		const r = scanArgv(["fake", "hello", "--provider", "faux", "world"], [], [fakeCmd()], GENERAL);
		assert.equal(r.text, "hello world");
		assert.deepEqual(r.options, { "--provider": ["faux"] });
	});

	it("option takes its following plain before text does", () => {
		const r = scanArgv(["fake", "--provider", "faux"], [], [fakeCmd()], GENERAL);
		assert.deepEqual(r.options, { "--provider": ["faux"] });
		assert.equal(r.text, undefined);
	});

	it("-- ends options: everything after is text, even -x and --help", () => {
		const r = scanArgv(["fake", "--", "--provider", "--help", "-x"], [], [fakeCmd()], GENERAL);
		assert.equal(r.text, "--provider --help -x");
		assert.deepEqual(r.options, {});
		assert.equal(r.help, undefined);
	});
});

describe("scan: globals before command", () => {
	const g: Def = { kind: "option", def: { name: "--provider", alias: "-p", repeatable: false } };

	it("global valid before and after the word, same shape", () => {
		const cmd: Command = { name: "c", defs: [], help: CMD_HELP };
		const a = scanArgv(["--provider", "faux", "c", "hi"], [g], [cmd], GENERAL);
		const b = scanArgv(["c", "--provider", "faux", "hi"], [g], [cmd], GENERAL);
		assert.deepEqual(a.options, { "--provider": ["faux"] });
		assert.deepEqual(a.options, b.options);
		assert.equal(a.command?.name, "c");
	});

	it("command-owned spelling before its word fails immediately", () => {
		const cmd: Command = { name: "c", defs: [g], help: CMD_HELP };
		expectParseError(
			() => scanArgv(["--provider", "faux", "c"], [], [cmd], GENERAL),
			"Unknown option: --provider.",
			GENERAL,
			2,
		);
	});

	it("command referencing the same global entry works after the word", () => {
		const cmd: Command = { name: "c", defs: [g], help: CMD_HELP };
		const r = scanArgv(["c", "--provider", "faux"], [g], [cmd], GENERAL);
		assert.deepEqual(r.options, { "--provider": ["faux"] });
	});
});

describe("scan: help short-circuit", () => {
	it("--help with no command returns general help", () => {
		const r = scanArgv(["--help"], [], [fakeCmd()], GENERAL);
		assert.equal(r.help, GENERAL);
	});

	it("-h after a command returns that command help", () => {
		const r = scanArgv(["fake", "-h"], [], [fakeCmd()], GENERAL);
		assert.equal(r.help, CMD_HELP);
	});

	it("help before an error wins; error before help wins", () => {
		const h = scanArgv(["--help", "--bogus"], [], [fakeCmd()], GENERAL);
		assert.equal(h.help, GENERAL);
		expectParseError(
			() => scanArgv(["--bogus", "--help"], [], [fakeCmd()], GENERAL),
			"Unknown option: --bogus.",
			GENERAL,
			2,
		);
	});

	it("--help=x fails; --no-help is unknown", () => {
		expectParseError(
			() => scanArgv(["--help=x"], [], [fakeCmd()], GENERAL),
			"Unexpected value for --help.",
			GENERAL,
			2,
		);
		expectParseError(
			() => scanArgv(["fake", "--no-help"], [], [fakeCmd()], GENERAL),
			"Unknown option: --no-help.",
			CMD_HELP,
			2,
		);
	});
});

describe("scan: errors carry the relevant help", () => {
	it("unknown global option carries general help", () => {
		expectParseError(
			() => scanArgv(["--bogus"], [], [fakeCmd()], GENERAL),
			"Unknown option: --bogus.",
			GENERAL,
			2,
		);
	});

	it("unknown command-option carries command help", () => {
		expectParseError(
			() => scanArgv(["fake", "--bogus"], [], [fakeCmd()], GENERAL),
			"Unknown option: --bogus.",
			CMD_HELP,
			2,
		);
	});

	it("unknown command word exits 1 with general help", () => {
		expectParseError(
			() => scanArgv(["badcmd"], [], [fakeCmd()], GENERAL),
			"Unknown command: badcmd.",
			GENERAL,
			1,
		);
	});
});

describe("scan: empty argv", () => {
	it("returns no command, no options, no text, no help", () => {
		const r = scanArgv([], [], [fakeCmd()], GENERAL);
		assert.equal(r.command, undefined);
		assert.deepEqual(r.options, {});
		assert.equal(r.text, undefined);
		assert.equal(r.help, undefined);
	});
});
