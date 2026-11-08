import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	scanArgv,
	ParseError,
	type Option,
	type Command,
} from "../src/args.js";

const GENERAL = "GENERAL_HELP";
const ASK_HELP = "ASK_HELP";

const provider: Option = { name: "--provider", alias: "-p", arity: 1, min: 0, max: 1 };
const key: Option = { name: "--key", alias: "-k", arity: 1, min: 0, max: 1 };
const model: Option = { name: "--model", alias: "-m", arity: 1, min: 0, max: 1 };
const flag: Option = { name: "--flag", alias: "-f", arity: 0, min: 0, max: 1 };
const pair: Option = { name: "--pair", alias: "-2", arity: 2, min: 0, max: 1 };

function askCmd(): Command {
	return { name: "ask", options: [provider, key, model], help: ASK_HELP, run: () => {} };
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

describe("single scan: activation and values", () => {
	it("collects an option once with its raw string value", () => {
		const r = scanArgv(["ask", "--provider", "faux", "Hi"], [], [askCmd()], GENERAL);
		assert.deepEqual(r.options, { "--provider": ["faux"] });
		assert.equal(r.text, "Hi");
	});

	it("= form stores one value", () => {
		const r = scanArgv(["ask", "--provider=faux", "Hi"], [], [askCmd()], GENERAL);
		assert.deepEqual(r.options, { "--provider": ["faux"] });
	});

	it("short alias stores under the long name", () => {
		const r = scanArgv(["ask", "-p", "faux", "Hi"], [], [askCmd()], GENERAL);
		assert.deepEqual(r.options, { "--provider": ["faux"] });
	});

	it("arity 0 stores an empty array", () => {
		const cmd: Command = { name: "c", options: [flag], help: "H", run: () => {} };
		const r = scanArgv(["c", "--flag", "Hi"], [], [cmd], GENERAL);
		assert.deepEqual(r.options, { "--flag": [] });
	});

	it("arity 2 consumes two values in order", () => {
		const cmd: Command = { name: "c", options: [pair], help: "H", run: () => {} };
		const r = scanArgv(["c", "--pair", "a", "b", "Hi"], [], [cmd], GENERAL);
		assert.deepEqual(r.options, { "--pair": ["a", "b"] });
	});

	it("= form plus one more token fills arity 2", () => {
		const cmd: Command = { name: "c", options: [pair], help: "H", run: () => {} };
		const r = scanArgv(["c", "--pair=a", "b", "Hi"], [], [cmd], GENERAL);
		assert.deepEqual(r.options, { "--pair": ["a", "b"] });
	});

	it("last occurrence wins", () => {
		const multi: Option = { ...provider, max: Infinity };
		const cmd: Command = { name: "ask", options: [multi, key, model], help: ASK_HELP, run: () => {} };
		const r = scanArgv(
			["ask", "--provider", "a", "--provider", "b", "Hi"],
			[],
			[cmd],
			GENERAL,
		);
		assert.deepEqual(r.options, { "--provider": ["a", "b"] });
	});

	it("second occurrence of max-1 fails instead of last-wins", () => {
		expectParseError(
			() => scanArgv(["ask", "--provider", "a", "--provider", "b", "Hi"], [], [askCmd()], GENERAL),
			"Too many occurrences of --provider.",
			ASK_HELP,
			2,
		);
	});

	it("repeatable option accumulates across occurrences", () => {
		const attach: Option = { name: "--attach", alias: "-a", arity: 1, min: 0, max: Infinity };
		const cmd: Command = { name: "c", options: [attach], help: "H", run: () => {} };
		const r = scanArgv(["c", "--attach", "a.txt", "--attach", "b.txt", "Hi"], [], [cmd], GENERAL);
		assert.deepEqual(r.options, { "--attach": ["a.txt", "b.txt"] });
	});

	it("missing required option fails after the scan", () => {
		const req: Option = { name: "--token", alias: "-t", arity: 1, min: 1, max: 1 };
		const cmd: Command = { name: "c", options: [req], help: "H", run: () => {} };
		expectParseError(
			() => scanArgv(["c", "Hi"], [], [cmd], GENERAL),
			"Missing required option: --token.",
			"H",
			2,
		);
	});

	it("options work before and after the text", () => {
		const a = scanArgv(["ask", "--provider", "faux", "Hi"], [], [askCmd()], GENERAL);
		const b = scanArgv(["ask", "Hi", "--provider", "faux"], [], [askCmd()], GENERAL);
		assert.deepEqual(a.options, b.options);
		assert.equal(a.text, b.text);
	});
});

describe("single scan: errors carry the relevant help", () => {
	it("unknown global option carries general help", () => {
		expectParseError(
			() => scanArgv(["--porvider", "faux", "Hi"], [], [askCmd()], GENERAL),
			"Unknown option: --porvider.",
			GENERAL,
			2,
		);
	});

	it("unknown command option carries command help", () => {
		expectParseError(
			() => scanArgv(["ask", "--name", "x", "Hi"], [], [askCmd()], GENERAL),
			"Unknown option: --name.",
			ASK_HELP,
			2,
		);
	});

	it("missing value carries the side help", () => {
		expectParseError(
			() => scanArgv(["ask", "--provider"], [], [askCmd()], GENERAL),
			"Missing value for --provider.",
			ASK_HELP,
			2,
		);
	});

	it("= with empty value fails", () => {
		expectParseError(
			() => scanArgv(["ask", "--provider="], [], [askCmd()], GENERAL),
			"Missing value for --provider.",
			ASK_HELP,
			2,
		);
	});

	it("value on arity 0 fails", () => {
		expectParseError(
			() => scanArgv(["--help=x"], [], [askCmd()], GENERAL),
			"Unexpected value for --help.",
			GENERAL,
			2,
		);
	});

	it("unknown command word carries general help", () => {
		expectParseError(
			() => scanArgv(["badcmd", "Hi"], [], [askCmd()], GENERAL),
			"Unknown command: badcmd.",
			GENERAL,
			1,
		);
	});

	it("first text word as command with empty table carries general help", () => {
		expectParseError(
			() => scanArgv(["ask", "Hi"], [], [], GENERAL),
			"Unknown command: ask.",
			GENERAL,
			1,
		);
	});

	it("second text token fails naming it", () => {
		expectParseError(
			() => scanArgv(["ask", "Hi", "there"], [], [askCmd()], GENERAL),
			'Unexpected extra text: "there". Did you forget quotes?',
			ASK_HELP,
			2,
		);
	});

	it("-- ends option processing", () => {
		const r = scanArgv(["ask", "--", "--provider"], [], [askCmd()], GENERAL);
		assert.equal(r.text, "--provider");
		assert.deepEqual(r.options, {});
	});
});

describe("single scan: help short-circuit", () => {
	it("--help with no command returns general help", () => {
		const r = scanArgv(["--help"], [], [], GENERAL);
		assert.equal(r.help, GENERAL);
	});

	it("-h after a command returns that command help", () => {
		const r = scanArgv(["ask", "-h"], [], [askCmd()], GENERAL);
		assert.equal(r.help, ASK_HELP);
	});

	it("help before an error wins", () => {
		const r = scanArgv(["--help", "--porvider"], [], [askCmd()], GENERAL);
		assert.equal(r.help, GENERAL);
	});

	it("error before help wins", () => {
		expectParseError(
			() => scanArgv(["--porvider", "--help"], [], [askCmd()], GENERAL),
			"Unknown option: --porvider.",
			GENERAL,
			2,
		);
	});

	it("unknown command before help wins", () => {
		expectParseError(
			() => scanArgv(["badcmd", "--help"], [], [askCmd()], GENERAL),
			"Unknown command: badcmd.",
			GENERAL,
			1,
		);
	});
});
