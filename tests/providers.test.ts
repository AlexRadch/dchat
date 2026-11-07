import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type {
	AuthContext,
	Credential,
	CredentialStore,
} from "@earendil-works/pi-ai";
import { standardProviders } from "../src/standardProviders.js";
import { fauxProviders } from "../src/fauxProvider.js";

function testCreds(): {
	credentials: CredentialStore;
	authContext: AuthContext;
} {
	return {
		credentials: {
			read: async (_providerId: string): Promise<Credential | undefined> =>
				undefined,
			list: async () => [],
			modify: async (
				_providerId: string,
				fn: (current: Credential | undefined) => Promise<Credential | undefined>,
			) => (await fn(undefined)) as Credential | undefined,
			delete: async (_providerId: string) => {},
		},
		authContext: {
			env: async (_name: string) => undefined,
			fileExists: async (_path: string) => false,
		},
	};
}

describe("standardProviders", () => {
	it("returns a non-empty array, including openrouter", () => {
		const { credentials, authContext } = testCreds();
		const providers = standardProviders(credentials, authContext);
		const ids = providers.map((p) => p.id).sort();
		assert.ok(ids.length > 0, "standard array must not be empty");
		assert.ok(ids.includes("openrouter"), "openrouter must be present");
	});
});

describe("fauxProviders", () => {
	it("takes the same two args and returns its own array", () => {
		const { credentials, authContext } = testCreds();
		const providers = fauxProviders(credentials, authContext);
		const ids = providers.map((p) => p.id);
		assert.ok(ids.includes("faux"), "faux must be present");
	});
});

describe("uniform assembly", () => {
	it("entry point adds every array the same way, knowing no kinds", () => {
		const { credentials, authContext } = testCreds();
		const arrays = [
			standardProviders(credentials, authContext),
			fauxProviders(credentials, authContext),
		];
		const all = new Set(arrays.flat().map((p) => p.id));
		assert.ok(all.has("openrouter"));
		assert.ok(all.has("faux"));
		for (const providers of arrays) assert.ok(Array.isArray(providers));
	});
});
