// One-shot console stub on Pi Durable: Harness.open + root + submit + wait.
// Usage: npx tsx src/chat.ts help — prints help via the harness, then exits.
import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { createModels } from "@earendil-works/pi-ai/models";
import {
	fauxAssistantMessage,
	fauxProvider,
} from "@earendil-works/pi-ai/providers/faux";
import {
	AssistantEntry,
	createRegistry,
	Harness,
	MemoryStorage,
} from "@earendil-works/pi-durable";

const HELP_TEXT = ["dchat — commands:", "  help — show this help"].join("\n");

const USAGE = [
	"Usage: dchat <command>",
	"",
	"Commands:",
	"  help — show this help",
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

async function main(): Promise<void> {
	const raw = process.argv[2] ?? "";
	const cmd = raw.trim().toLowerCase();
	if (!cmd) {
		console.error(USAGE);
		process.exitCode = 2;
		return;
	}
	if (cmd !== "help") {
		console.error(`Unknown command: ${raw}. Try "help".`);
		process.exitCode = 1;
		return;
	}

	const context = BACKGROUND_CONTEXT;

	// Faux provider stands in for a real model: canned answers, no API key.
	const faux = fauxProvider();
	const models = createModels();
	models.setProvider(faux.provider);

	const harness = await Harness.open(
		new MemoryStorage(),
		{ models, registry: createRegistry() },
		context,
	);
	try {
		const root = await harness.root(context, {
			agent: { model: { provider: "faux", modelId: "faux-1" } },
		});
		faux.appendResponses([fauxAssistantMessage(HELP_TEXT)]);
		const submission = await root.submit(
			{ type: "input", content: "help" },
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
			console.error("unanswered:", settled.status);
			process.exitCode = 1;
		}
	} finally {
		await harness.close(context);
	}
}

await main();
