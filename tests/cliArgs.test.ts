import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readProviderArg, providerHelp } from "../src/providerArg.js";
import { readKeyArg, keyHelp } from "../src/keyArg.js";
import { readModelArg, modelHelp } from "../src/modelArg.js";

// The argument-processing loop from chat.ts, mirrored here so its mechanics
// passes over the readers in order, shrink-to-continue, stop-on-stall.
function runLoop(tokens: string[]): {
	provider?: string;
	key?: string;
	model?: string;
	rest: string[];
} {
	let rest = tokens;
	let provider: string | undefined;
	let key: string | undefined;
	let model: string | undefined;
	for (;;) {
		const n = rest.length;
		if (n === 0) break;
		const p = readProviderArg(rest);
		if (p.provider !== undefined) provider = p.provider;
		const k = readKeyArg(p.rest);
		if (k.key !== undefined) key = k.key;
		const m = readModelArg(k.rest);
		if (m.model !== undefined) model = m.model;
		rest = m.rest;
		if (rest.length === n) break;
	}
	return { provider, key, model, rest };
}

// The inline remainder rule from chat.ts: first leftover token that looks
// like an option is an unknown option; pure positional text is the question.
function findUnknown(rest: string[]): string | undefined {
	return rest.find((t) => t.startsWith("-"));
}

describe("provider reader (lazy)", () => {
	it("consumes the leading flag in all three forms", () => {
		assert.deepEqual(readProviderArg(["--provider", "faux", "Hi"]), {
			provider: "faux",
			rest: ["Hi"],
		});
		assert.deepEqual(readProviderArg(["--provider=faux", "Hi"]), {
			provider: "faux",
			rest: ["Hi"],
		});
		assert.deepEqual(readProviderArg(["-p", "faux", "Hi"]), {
			provider: "faux",
			rest: ["Hi"],
		});
	});

	it("leaves non-leading flags for a later pass", () => {
		assert.deepEqual(readProviderArg(["Hi", "--provider", "faux"]), {
			provider: undefined,
			rest: ["Hi", "--provider", "faux"],
		});
	});

	it("leaves a foreign leading flag untouched", () => {
		const input = ["--key", "k", "Hi"];
		const { provider, rest } = readProviderArg(input);
		assert.equal(provider, undefined);
		assert.deepEqual(rest, input);
		assert.deepEqual(input, ["--key", "k", "Hi"]);
	});
});

describe("key reader (lazy)", () => {
	it("consumes the leading flag in all three forms", () => {
		assert.deepEqual(readKeyArg(["--key", "sk-x", "Hi"]), {
			key: "sk-x",
			rest: ["Hi"],
		});
		assert.deepEqual(readKeyArg(["--key=sk-x", "Hi"]), {
			key: "sk-x",
			rest: ["Hi"],
		});
		assert.deepEqual(readKeyArg(["-k", "sk-x", "Hi"]), {
			key: "sk-x",
			rest: ["Hi"],
		});
	});

	it("leaves non-leading flags for a later pass", () => {
		assert.deepEqual(readKeyArg(["Hi", "--key", "k"]), {
			key: undefined,
			rest: ["Hi", "--key", "k"],
		});
	});

	it("leaves a foreign leading flag untouched", () => {
		const input = ["--provider", "faux", "Hi"];
		const { key, rest } = readKeyArg(input);
		assert.equal(key, undefined);
		assert.deepEqual(rest, input);
		assert.deepEqual(input, ["--provider", "faux", "Hi"]);
	});
});

describe("model reader (lazy)", () => {
	it("consumes the leading flag in all three forms", () => {
		assert.deepEqual(readModelArg(["--model", "m1", "Hi"]), {
			model: "m1",
			rest: ["Hi"],
		});
		assert.deepEqual(readModelArg(["--model=m1", "Hi"]), {
			model: "m1",
			rest: ["Hi"],
		});
		assert.deepEqual(readModelArg(["-m", "m1", "Hi"]), {
			model: "m1",
			rest: ["Hi"],
		});
	});

	it("leaves non-leading flags for a later pass", () => {
		assert.deepEqual(readModelArg(["Hi", "--model", "m1"]), {
			model: undefined,
			rest: ["Hi", "--model", "m1"],
		});
	});

	it("leaves a foreign leading flag untouched", () => {
		const input = ["--provider", "faux", "Hi"];
		const { model, rest } = readModelArg(input);
		assert.equal(model, undefined);
		assert.deepEqual(rest, input);
		assert.deepEqual(input, ["--provider", "faux", "Hi"]);
	});
});

describe("missing values", () => {
	it("flag as last token throws naming the option", () => {
		assert.throws(() => readProviderArg(["--provider"]), /Missing value for --provider/);
		assert.throws(() => readKeyArg(["--key"]), /Missing value for --key/);
		assert.throws(() => readModelArg(["--model"]), /Missing value for --model/);
	});

	it("flag followed by another option throws naming the option", () => {
		assert.throws(
			() => readProviderArg(["--provider", "--key"]),
			/Missing value for --provider/,
		);
		assert.throws(() => readKeyArg(["--key", "--model"]), /Missing value for --key/);
		assert.throws(() => readModelArg(["--model", "--key"]), /Missing value for --model/);
	});

	it("empty = value throws", () => {
		assert.throws(() => readProviderArg(["--provider="]), /Missing value for --provider/);
		assert.throws(() => readKeyArg(["--key="]), /Missing value for --key/);
		assert.throws(() => readModelArg(["--model="]), /Missing value for --model/);
	});
});

describe("argument-processing loop", () => {
	it("collects one flag per pass until the remainder is consumed", () => {
		assert.deepEqual(
			runLoop(["--provider", "faux", "--key", "k", "--model", "m", "Hi"]),
			{ provider: "faux", key: "k", model: "m", rest: ["Hi"] },
		);
	});

	it("resolves repeats across passes to last-wins", () => {
		assert.deepEqual(
			runLoop(["--provider", "a", "--provider", "b", "Hi"]),
			{ provider: "b", key: undefined, model: undefined, rest: ["Hi"] },
		);
	});

	it("stops on a pass that consumes nothing", () => {
		const out = runLoop(["--porvider", "faux", "Hi"]);
		assert.deepEqual(out.rest, ["--porvider", "faux", "Hi"]);
		assert.equal(findUnknown(out.rest), "--porvider");
	});

	it("returns undefined unknown for pure positional text", () => {
		const out = runLoop(["Hi", "there"]);
		assert.deepEqual(out.rest, ["Hi", "there"]);
		assert.equal(findUnknown(out.rest), undefined);
	});
});

describe("detached provider reader", () => {
	it("key+model chain leaves --provider in the remainder", () => {
		const k = readKeyArg(["--provider", "faux", "Hi"]);
		const m = readModelArg(k.rest);
		assert.deepEqual(m.rest, ["--provider", "faux", "Hi"]);
		assert.equal(findUnknown(m.rest), "--provider");
	});

	it("help without the provider spread drops its lines", () => {
		const help = [...keyHelp, ...modelHelp].join("\n");
		assert.ok(!help.includes("--provider"));
		assert.ok(providerHelp.join("\n").includes("--provider"));
	});
});
