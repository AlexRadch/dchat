// Faux test providers component: returns its own provider set (one entry
// today, may grow) and owns all faux imports. The faux provider answers
// every question by echoing it — taught once at creation via a response
// factory, so no caller ever prepares answers. Same inputs as every other
// component (ignored for now); returns only providers.
import {
	fauxAssistantMessage,
	fauxProvider,
} from "@earendil-works/pi-ai/providers/faux";
import type { Provider } from "@earendil-works/pi-ai";
import type {
	AuthContext,
	CredentialStore,
} from "@earendil-works/pi-ai";

function lastUserText(messages: readonly unknown[]): string {
	for (let i = messages.length - 1; i >= 0; i--) {
		const m = messages[i] as {
			role?: unknown;
			content?: unknown;
		};
		if (m?.role !== "user") continue;
		const c = m.content;
		if (typeof c === "string") return c;
		if (Array.isArray(c))
			return c
				.map((b) =>
					typeof b === "object" &&
					b !== null &&
					"type" in b &&
					(b as { type: unknown }).type === "text"
						? String((b as { text: unknown }).text ?? "")
						: "",
				)
				.filter(Boolean)
				.join("\n");
		return "";
	}
	return "";
}

export function fauxProviders(
	_credentials: CredentialStore,
	_authContext: AuthContext,
): Provider[] {
	const faux = fauxProvider();
	faux.setResponses([
		(context) =>
			fauxAssistantMessage(`echo: ${lastUserText(context.messages)}`),
	]);
	return [faux.provider];
}
