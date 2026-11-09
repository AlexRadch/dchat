// Entry point: single left-to-right scan (specs 002 + 006).
// Ask execution is PARKED (commented, not deleted) until the ask command spec
// re-enables it. Until then the command table holds no enabled commands:
// any command word fails as unknown, only global --help works.
import { scanArgv } from "./args.js";
import { GLOBAL_ARGS } from "./globalArgs.js";

const GENERAL_HELP = [
	"Usage: dchat <command> [options]",
	"",
	"Commands:",
	"  (none — no commands registered yet)",
	"",
	"Options:",
	"  --help, -h    Show this help",
].join("\n");

async function main(): Promise<void> {
	const argv = process.argv.slice(2);
	if (argv.length === 0) {
		console.error(GENERAL_HELP);
		process.exitCode = 2;
		return;
	}
	try {
		const result = scanArgv(argv, GLOBAL_ARGS, [], GENERAL_HELP);
		switch (result.kind) {
			case "general-help":
			case "command-help":
				console.log(result.result.help);
				return;
			case "run":
				console.error(GENERAL_HELP);
				process.exitCode = 2;
				return;
			case "parse-error": {
				const block = result.result.command ? result.result.command.help : GENERAL_HELP;
				console.error(`${result.result.message}\n\n${block}`);
				process.exitCode = result.result.exitCode;
				return;
			}
		}
	} catch (e) {
		// Unreachable for expected input failures (they return the parse-error
		// arm per ADR-004). Only programmer bugs (duplicate registration) land
		// here, as plain Errors.
		console.error(e instanceof Error ? e.message : String(e));
		process.exitCode = 2;
		return;
	}
}

await main();

/* PARKED (ask — re-enable with the ask command spec). Do NOT delete.
 * The whole ask execution path lived here: ask routing, provider/key/model
 * registration + loop, defaulting, key resolution, harness flow.
 * It is parked as a comment so the ask spec can restore it without rewriting.
 * Original code (2026-11-07, commit da89ea6) is preserved in git history:
 *   git show da89ea6:src/chat.ts
 * Ask surface when re-enabled:
 *   dchat ask [--provider P] [--key SPEC] [--model MODEL] <text>
 *   echo <text> | dchat ask [...]
 */
