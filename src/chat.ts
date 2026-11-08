// Entry point: single left-to-right scan (specs 002 + 006).
// Ask execution is PARKED (commented, not deleted) until the ask command spec
// re-enables it. Until then the command table holds no enabled commands:
// any command word fails as unknown, only global --help works.
import { scanArgv, ParseError, GLOBAL_OPTIONS, COMMANDS } from "./args.js";

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
		const result = scanArgv(argv, GLOBAL_OPTIONS, COMMANDS, GENERAL_HELP);
		if (result.help !== undefined) {
			console.log(result.help);
			return;
		}
		if (!result.command) {
			console.error(GENERAL_HELP);
			process.exitCode = 2;
			return;
		}
		await result.command.run({ options: result.options, text: result.text });
	} catch (e) {
		if (e instanceof ParseError) {
			console.error(`${e.message}\n\n${e.helpBlock}`);
			process.exitCode = e.exitCode;
			return;
		}
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
