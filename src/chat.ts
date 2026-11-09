// Entry point: single left-to-right scan (specs 002 + 006).
// Ask execution is PARKED (commented, not deleted) until the ask command spec
// re-enables it. Until then the command table holds no enabled commands:
// any command word fails as unknown, only global --help works.
import { scanArgv, type Command, type ArgValues, type WithCommand } from "./args.js";
import { GENERAL_ARGS } from "./generalArgs.js";

const GENERAL_HELP = [
	"Usage: dchat <command> [options]",
	"",
	"Commands:",
	"  (none — no commands registered yet)",
	"",
	"Options:",
	"  --help, -h    Show this help",
].join("\n");

// Execution and help texts live here, above the scan — never in args.ts.
// The scan resolves names/defs/values/chunks; this module adds help
// blocks and dispatch. Undocumented for now; the specs land with the ask spec.
export interface RunCommand extends Command {
	help: string;
	run: (argValues: ArgValues, params: string[]) => void | Promise<void>;
}

// A set help flag means print the block — no handler, exit 0. The scan
// carries the flag in argValues of the normal arm; this module gives it
// meaning: command word resolved → its block, else the general block.
function hasHelpFlag(argValues: ArgValues): boolean {
	return argValues["--help"] === true;
}

function commandHelp(command: Command): string {
	// No per-command blocks registered yet — falls back to general help.
	// Per-command blocks arrive with their command specs.
	void command;
	return GENERAL_HELP;
}

async function main(): Promise<void> {
	const argv = process.argv.slice(2);
	// No pre-scan empty-argv shortcut (spec 002 Story 4): empty input scans
	// to without-command with empty values, the switch below prints help exit 0.
	try {
		const result = scanArgv(argv, GENERAL_ARGS, []);
		switch (result.kind) {
			case "with-command": {
				const payload: WithCommand = result.result;
				// Help flag first: set → block stdout exit 0, handler never called.
				if (hasHelpFlag(payload.argValues)) {
					console.log(commandHelp(payload.command));
					return;
				}
				// No commands registered yet (parked): dispatch arrives with
				// the ask spec. Until then a valid run still has nowhere to go.
				void payload;
				console.error(GENERAL_HELP);
				process.exitCode = 2;
				return;
			}
			case "without-command": {
				const facts = result.result;
				// Help flag first: set → general block stdout exit 0.
				if (hasHelpFlag(facts.argValues)) {
					console.log(GENERAL_HELP);
					return;
				}
				// Words without a command are not scan failures. The entry
				// point owns the meaning: facts present → misplaced content,
				// error with the general block (exit 2); facts empty → plain
				// general help on stdout (exit 0).
				const empty = Object.keys(facts.argValues).length === 0;
				if (empty) {
					console.log(GENERAL_HELP);
					return;
				}
				console.error(`No command.\n\n${GENERAL_HELP}`);
				process.exitCode = 2;
				return;
			}
			case "unknown-command":
			case "unknown-option":
			case "missing-value":
			case "unexpected-value":
			case "too-many":
			case "too-few-params":
			case "too-many-params": {
				// Every scan failure is a usage error: one mapping, exit 2.
				// The block comes from the resolved command, else the general one.
				const failed = result.result;
				const block =
					"command" in failed && failed.command ? commandHelp(failed.command) : GENERAL_HELP;
				console.error(`${failed.message}\n\n${block}`);
				process.exitCode = 2;
				return;
			}
		}
	} catch (e) {
		// Unreachable for expected input failures (they return named arms
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
