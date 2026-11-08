import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	keySpecFromOptions,
	missingKeyMessage,
	parseDotenv,
	stdEnvName,
	readDotenvVar,
	resolveExplicitKey,
	resolveKey,
	type KeySources,
} from "../src/keys.js";

function src(over: Partial<KeySources> = {}): KeySources {
	return {
		env: () => undefined,
		readFile: () => undefined,
		fileExists: () => false,
		keychainGet: async () => undefined,
		cwd: () => "/work",
		home: () => "/home/u",
		...over,
	};
}

describe("keySpecFromOptions (spec 007 handoff)", () => {
	it("forwards the raw string byte-for-byte", () => {
		assert.equal(keySpecFromOptions({ "--key": ["env:MY_KEY"] }), "env:MY_KEY");
	});

	it("keeps spaces as-is, no trimming", () => {
		assert.equal(keySpecFromOptions({ "--key": ["  sk-123  "] }), "  sk-123  ");
	});

	it("keeps : = / ? characters untouched", () => {
		assert.equal(
			keySpecFromOptions({ "--key": ["dotenv:/x.env?VAR=K=V"] }),
			"dotenv:/x.env?VAR=K=V",
		);
	});

	it("absent --key maps to undefined, never empty string", () => {
		assert.equal(keySpecFromOptions({}), undefined);
	});

	it("reads index 0 only, never joins", () => {
		assert.equal(keySpecFromOptions({ "--key": ["a", "b"] }), "a");
	});
});

describe("missingKeyMessage (spec 007 handoff)", () => {
	it("echoes the exact spec", () => {
		assert.equal(
			missingKeyMessage("env:NOPE"),
			"Key source yielded no key: env:NOPE",
		);
	});
});

describe("parseDotenv", () => {
	it("parses KEY=value, quotes, export, comments", () => {
		const r = parseDotenv(
			'# c\nA=1\nB="two"\nC=\'three\'\nexport D=4\nE=\nnoeq\n',
		);
		assert.deepEqual(r, { A: "1", B: "two", C: "three", D: "4", E: "" });
	});
});

describe("stdEnvName", () => {
	it("builds {PROVIDER}_API_KEY, non-alnum to _", () => {
		assert.equal(stdEnvName("openrouter"), "OPENROUTER_API_KEY");
		assert.equal(stdEnvName("openai-codex"), "OPENAI_CODEX_API_KEY");
		assert.equal(stdEnvName("cloudflare-ai-gateway"), "CLOUDFLARE_AI_GATEWAY_API_KEY");
	});
});

describe("readDotenvVar", () => {
	it("checks cwd .env then home .env", () => {
		const s = src({
			fileExists: (p) => p === "/work/.env",
			readFile: (p) => (p === "/work/.env" ? "K=v-cwd" : undefined),
		});
		assert.equal(readDotenvVar(s, "K"), "v-cwd");
	});
	it("explicit path only", () => {
		const s = src({
			fileExists: () => true,
			readFile: () => "K=v-file",
		});
		assert.equal(readDotenvVar(s, "K", "/x/.env"), "v-file");
	});
	it("missing everywhere", () => {
		assert.equal(readDotenvVar(src(), "K"), undefined);
	});
});

describe("resolveExplicitKey", () => {
	it("literal passes through", () => {
		assert.equal(resolveExplicitKey(src(), "sk-123", "STD"), "sk-123");
	});
	it("env:NAME from env, missing is undefined", () => {
		const s = src({ env: (n) => (n === "MY_K" ? "v" : undefined) });
		assert.equal(resolveExplicitKey(s, "env:MY_K", "STD"), "v");
		assert.equal(resolveExplicitKey(s, "env:NOPE", "STD"), undefined);
	});
	it("bare env uses std name", () => {
		const s = src({ env: (n) => (n === "STD" ? "v" : undefined) });
		assert.equal(resolveExplicitKey(s, "env", "STD"), "v");
	});
	it("file: first non-empty line", () => {
		const s = src({ readFile: () => "\n  k1\nk2\n" });
		assert.equal(resolveExplicitKey(s, "file:/x", "STD"), "k1");
	});
	it("file: missing is undefined", () => {
		assert.equal(resolveExplicitKey(src(), "file:/x", "STD"), undefined);
	});
	it("dotenv:PATH?VAR=NAME", () => {
		const s = src({ readFile: () => "A=1\nB=2\n" });
		assert.equal(resolveExplicitKey(s, "dotenv:/x?VAR=B", "STD"), "2");
	});
	it("dotenv:PATH defaults var to std", () => {
		const s = src({ readFile: () => "STD=s\n" });
		assert.equal(resolveExplicitKey(s, "dotenv:/x", "STD"), "s");
	});
	it("dotenv default files", () => {
		const s = src({
			fileExists: (p) => p === "/work/.env",
			readFile: () => "STD=s\n",
		});
		assert.equal(resolveExplicitKey(s, "dotenv", "STD"), "s");
	});
	it("keychain default service/account", async () => {
		let got: string[] = [];
		const s = src({
			keychainGet: async (sv, ac) => {
				got = [sv, ac];
				return "kc";
			},
		});
		assert.equal(await resolveExplicitKey(s, "keychain", "STD"), "kc");
		assert.deepEqual(got, ["dchat", "STD"]);
	});
	it("keychain:SERVICE:ACCOUNT", async () => {
		let got: string[] = [];
		const s = src({
			keychainGet: async (sv, ac) => {
				got = [sv, ac];
				return "kc";
			},
		});
		assert.equal(await resolveExplicitKey(s, "keychain:s:a:b", "STD"), "kc");
		assert.deepEqual(got, ["s", "a:b"]);
	});
});

describe("resolveKey", () => {
	it("explicit literal wins over implicit", async () => {
		const s = src({ env: () => "implicit" });
		assert.deepEqual(
			await resolveKey(s, { provider: "openrouter", keySpec: "lit" }),
			{ key: "lit", missing: false },
		);
	});
	it("explicit missing source flags missing", async () => {
		assert.deepEqual(await resolveKey(src(), { provider: "o", keySpec: "env:NOPE" }), {
			key: undefined,
			missing: true,
		});
	});
	it("implicit priority: env, dotenv, keychain", async () => {
		const s = src({
			env: (n) => (n === "O_API_KEY" ? "from-env" : undefined),
			fileExists: () => true,
			readFile: () => "O_API_KEY=from-file",
			keychainGet: async () => "from-kc",
		});
		const r = await resolveKey(s, { provider: "o" });
		assert.equal(r.key, "from-env");
		const s2 = src({
			fileExists: () => true,
			readFile: () => "O_API_KEY=from-file",
			keychainGet: async () => "from-kc",
		});
		assert.equal((await resolveKey(s2, { provider: "o" })).key, "from-file");
		const s3 = src({ keychainGet: async () => "from-kc" });
		assert.equal((await resolveKey(s3, { provider: "o" })).key, "from-kc");
	});
	it("no key and no source: no error, undefined", async () => {
		assert.deepEqual(await resolveKey(src(), { provider: "openai" }), {
			key: undefined,
			missing: false,
		});
	});
	it("faux never errors", async () => {
		assert.deepEqual(await resolveKey(src(), { provider: "faux" }), {
			key: undefined,
			missing: false,
		});
	});
});
