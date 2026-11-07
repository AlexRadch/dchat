// One-shot console stub on Pi Durable: Harness.open + root + submit + wait.
// Usage:
//   dchat --help                              — general help
//   dchat ask --help                          — help for ask
//   dchat ask [--provider P] [--key K] [--model M] <text>   — one question, answer, exit
//   echo <text> | dchat ask [...]            — same, text via stdin
import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import type { Credential, CredentialStore } from "@earendil-works/pi-ai";
import { createModels } from "@earendil-works/pi-ai";
import {
	AssistantEntry,
	createRegistry,
	Harness,
	MemoryStorage,
} from "@earendil-works/pi-durable";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { createRequire } from "node:module";
import { resolveKey } from "./keys.js";
import { standardProviders } from "./standardProviders.js";
import { fauxProviders } from "./fauxProvider.js";

const DEFAULT_PROVIDER = "openrouter";

const GENERAL_HELP = [
	"Usage: dchat <command> [options]",
	"",
	"Commands:",
	"  ask    Ask a question, print the answer, exit",
	"",
	"Options:",
	"  --help, -h    Show this help",
	"",
	'Run "dchat ask --help" for ask options.',
].join("\n");

const ASK_HELP = [
	"Usage: dchat ask [--provider P] [--key SPEC] [--model MODEL] <text>",
	"   or: echo <text> | dchat ask [--provider P] [--key SPEC] [--model MODEL]",
	"",
	"Ask one question, print the answer, exit.",
	"",
	"Options:",
	"  --provider P     Provider id (default: openrouter)",
	"  --key SPEC       Key, or its source: literal, env:NAME, env,",
	"                   file:PATH, dotenv:PATH[?VAR=NAME], dotenv[:VAR=NAME],",
	"                   keychain[:SERVICE[:ACCOUNT]].",
	"                   Without --key: {PROVIDER}_API_KEY from env, ./.env,",
	"                   ~/.env, OS keychain.",
	"  --model MODEL    Model id (default: first in provider catalog)",
	"  --help, -h       Show this help",
	"",
	"Examples:",
	'  dchat ask --key sk-or-... "What is the capital of France?"',
	'  dchat ask --key env:MY_KEY "Hi"',
	'  dchat ask --provider openai --model gpt-5-mini "Hi"',
	'  echo "Hi" | dchat ask --key sk-or-...',
].join("\n");

function renderText(content: unknown): string {
	if (!Array.isArray(content)) return String(content ?? "");
	return content
		.map((b) =>
			typeof b === "object" && b !== null && "type" in b && b.type === "text"
				? String((b as { text: string }).text)
				: "",
		)
		.filter(Boolean)
		.join("\n");
}

async function readStdin(): Promise<string> {
	if (process.stdin.isTTY) return "";
	let data = "";
	for await (const chunk of process.stdin) data += chunk;
	return data;
}

async function main(): Promise<void> {
	const argv = process.argv.slice(2);
	const first = argv[0] ?? "";

	// dchat --help / dchat -h / dchat (bare, no args)
	if (!first || first === "--help" || first === "-h") {
		if (!first) {
			console.error(GENERAL_HELP);
			process.exitCode = 2;
			return;
		}
		console.log(GENERAL_HELP);
		return;
	}

	if (first !== "ask") {
		console.error(`Unknown command: ${first}. Try "dchat --help".`);
		process.exitCode = 1;
		return;
	}

	// dchat ask --help
	if (argv.includes("--help") || argv.includes("-h")) {
		console.log(ASK_HELP);
		return;
	}

	// Parse: dchat ask [--provider P] [--key K] [--model M] [text...]
	let key: string | undefined;
	let provider = DEFAULT_PROVIDER;
	let model: string | undefined;
	let modelGiven = false;
	const textParts: string[] = [];
	for (let i = 1; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--provider" || a === "-p") {
			const v = argv[++i];
			if (!v) {
				console.error('Missing value for --provider. Try "dchat ask --help".');
				process.exitCode = 2;
				return;
			}
			provider = v;
		} else if (a.startsWith("--provider=")) {
			provider = a.slice("--provider=".length);
		} else if (a === "--key" || a === "-k") {
			key = argv[++i];
			if (!key) {
				console.error('Missing value for --key. Try "dchat ask --help".');
				process.exitCode = 2;
				return;
			}
		} else if (a.startsWith("--key=")) {
			key = a.slice("--key=".length);
		} else if (a === "--model" || a === "-m") {
			const v = argv[++i];
			if (!v) {
				console.error('Missing value for --model. Try "dchat ask --help".');
				process.exitCode = 2;
				return;
			}
			model = v;
			modelGiven = true;
		} else if (a.startsWith("--model=")) {
			model = a.slice("--model=".length);
			modelGiven = true;
		} else if (a.startsWith("-")) {
			console.error(`Unknown option: ${a}. Try "dchat ask --help".`);
			process.exitCode = 2;
			return;
		} else {
			textParts.push(a);
		}
	}

	let text = textParts.join(" ").trim();
	if (!text) text = (await readStdin()).trim();
	if (!text) {
		console.error("No question text.\n\n" + ASK_HELP);
		process.exitCode = 2;
		return;
	}

	const context = BACKGROUND_CONTEXT;

	// Real sources for key resolution: env, disk, OS keychain (lazy —
	// keytar loads only when actually queried). Missing keytar: keychain
	// reads yield undefined instead of crashing.
	const require = createRequire(import.meta.url);
	let keytar: {
		getPassword(svc: string, acc: string): Promise<string | null>;
	} | null = null;
	try {
		keytar = require("keytar");
	} catch {
		keytar = null;
	}
	const sources = {
		env: (name: string) => process.env[name] ?? undefined,
		readFile: (p: string) => {
			// Normalize msys /tmp-style paths on Windows so node agrees.
			const norm =
				p.startsWith("/") && /^[A-Za-z]:\//.test(process.cwd()) ? `C:${p}` : p;
			try {
				if (!existsSync(norm)) return undefined;
				return readFileSync(norm, "utf8");
			} catch {
				return undefined;
			}
		},
		fileExists: (p: string) => {
			try {
				return existsSync(p);
			} catch {
				return false;
			}
		},
		keychainGet: async (service: string, account: string) => {
			if (!keytar) return undefined;
			try {
				return (await keytar.getPassword(service, account)) ?? undefined;
			} catch {
				return undefined;
			}
		},
		cwd: () => process.cwd(),
		home: () => homedir(),
	};
	const { key: finalKey, missing } = await resolveKey(sources, {
		provider,
		keySpec: key,
	});
	if (missing) {
		console.error(`Key source yielded no key: ${key}`);
		process.exitCode = 2;
		return;
	}

	// Explicit key only: env is blocked so nothing is picked up implicitly.
	const credentials: CredentialStore = {
		read: async (_providerId: string): Promise<Credential | undefined> =>
			finalKey ? { type: "api_key", key: finalKey } : undefined,
		list: async () => [],
		modify: async (
			_providerId: string,
			fn: (current: Credential | undefined) => Promise<Credential | undefined>,
		) => (await fn(undefined)) as Credential | undefined,
		delete: async (_providerId: string) => {},
	};
	const authContext = {
		env: async (_name: string) => undefined,
		fileExists: async (_path: string) => false,
	};

	const providers = [
		...standardProviders(credentials, authContext),
		...fauxProviders(credentials, authContext),
	];
	const models = createModels({ credentials, authContext });
	for (const provider of providers) models.setProvider(provider);

	// Unknown provider: fail before touching the network (faux included).
	if (!models.getProvider(provider)) {
		console.error(
			`Unknown provider: "${provider}". Known: ${models.getProviders().map((p) => p.id).join(", ")}.`,
		);
		process.exitCode = 2;
		return;
	}

	// Default: first model in that provider's catalog — no hardcoded ids.
	if (model === undefined) {
		const first = models.getModels(provider)[0];
		if (!first) {
			console.error(
				`Provider "${provider}" has no models in the catalog. Pass --model explicitly.`,
			);
			process.exitCode = 2;
			return;
		}
		model = first.id;
	}

	const harness = await Harness.open(
		new MemoryStorage(),
		{ models, registry: createRegistry() },
		context,
	);
	try {
		// No model check: whatever id the user gave goes straight in.
		const root = await harness.root(context, {
			agent: { model: { provider, modelId: model } },
		});
		const submission = await root.submit(
			{ type: "input", content: text },
			context,
		);
		const settled = await submission.wait(context);
		if (settled.status === "done" && settled.type === "input") {
			const entry = await root.commit(
				(tx) => tx.entry(AssistantEntry, settled.answer),
				context,
			);
			const reply = entry?.model?.[0];
			console.log(
				reply?.role === "assistant" ? renderText(reply.content) : reply,
			);
		} else {
			console.error(
				"unanswered:",
				settled.status,
				settled.status === "unanswered" ? settled.reason : "",
			);
			process.exitCode = 1;
		}
	} finally {
		await harness.close(context);
	}
}

await main();
