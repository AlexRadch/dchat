// Key resolution: pure functions over injected sources, so tests can
// drive them without touching env, disk, or the OS keychain.
export interface KeySources {
	env(name: string): string | undefined;
	readFile(path: string): string | undefined;
	fileExists(path: string): boolean;
	keychainGet(service: string, account: string): Promise<string | undefined>;
	cwd(): string;
	home(): string;
}

export function parseDotenv(text: string): Record<string, string> {
	const out: Record<string, string> = {};
	for (const line of text.split("\n")) {
		const t = line.trim();
		if (!t || t.startsWith("#")) continue;
		const eq = t.indexOf("=");
		if (eq < 0) continue;
		let k = t.slice(0, eq).trim();
		let v = t.slice(eq + 1).trim();
		if (k.startsWith("export ")) k = k.slice(7).trim();
		if (
			(v.startsWith('"') && v.endsWith('"')) ||
			(v.startsWith("'") && v.endsWith("'"))
		)
			v = v.slice(1, -1);
		out[k] = v;
	}
	return out;
}

export function stdEnvName(provider: string): string {
	return `${provider.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_API_KEY`;
}

// dotenv lookup: explicit path first, then ./.env, then ~/.env.
export function readDotenvVar(
	src: KeySources,
	name: string,
	explicitPath?: string,
): string | undefined {
	const paths = explicitPath
		? [explicitPath]
		: [`${src.cwd()}/.env`, `${src.home()}/.env`];
	for (const p of paths) {
		try {
			if (!src.fileExists(p)) continue;
			const text = src.readFile(p);
			if (text === undefined) continue;
			const v = parseDotenv(text)[name];
			if (v) return v;
		} catch {
			// unreadable dotenv — skip to next source
		}
	}
	return undefined;
}

// --key SPEC. No prefix = literal key.
//   env:NAME / env = $NAME (bare env: caller fills std name),
//   file:PATH = first non-empty line,
//   dotenv:PATH[?VAR=NAME] / dotenv[?VAR=NAME] = var from dotenv,
//   keychain[:SERVICE] / keychain:SERVICE:ACCOUNT = OS keychain entry
//   (default service dchat, account {provider}).
export function resolveExplicitKey(
	src: KeySources,
	spec: string,
	stdName: string,
): string | undefined | Promise<string | undefined> {
	if (spec.startsWith("env:")) return src.env(spec.slice(4)) || undefined;
	if (spec === "env") return src.env(stdName) || undefined;
	if (spec.startsWith("file:")) {
		const text = src.readFile(spec.slice(5));
		if (text === undefined) return undefined;
		return text.split("\n").map((l) => l.trim()).find(Boolean) || undefined;
	}
	if (spec.startsWith("dotenv:") || spec === "dotenv") {
		const rest = spec === "dotenv" ? "" : spec.slice(7);
		const qi = rest.indexOf("?VAR=");
		const path = qi < 0 ? rest : rest.slice(0, qi);
		const name = qi < 0 ? stdName : rest.slice(qi + 5);
		if (!name) return undefined;
		if (path) {
			const text = src.readFile(path);
			if (text === undefined) return undefined;
			return parseDotenv(text)[name] || undefined;
		}
		return readDotenvVar(src, name);
	}
	if (spec.startsWith("keychain")) {
		const rest = spec === "keychain" ? "" : spec.slice("keychain".length);
		const parts = rest.split(":").filter(Boolean);
		const { service, account } =
			parts.length >= 2
				? { service: parts[0], account: parts.slice(1).join(":") }
				: parts.length === 1
					? { service: parts[0], account: stdName }
					: { service: "dchat", account: stdName };
		return src.keychainGet(service, account);
	}
	return spec; // literal
}

export interface ResolveKeyResult {
	key: string | undefined;
	missing: boolean; // explicit source given but yielded nothing
}

// Full priority: explicit --key, else {PROVIDER}_API_KEY from process
// env, dotenv files, OS keychain. Faux is keyless: no key, no error.
export async function resolveKey(
	src: KeySources,
	opts: { provider: string; keySpec?: string },
): Promise<ResolveKeyResult> {
	const stdName = stdEnvName(opts.provider);
	if (opts.keySpec !== undefined) {
		const r = await resolveExplicitKey(src, opts.keySpec, stdName);
		return r ? { key: r, missing: false } : { key: undefined, missing: true };
	}
	if (opts.provider === "faux") return { key: undefined, missing: false };
	return {
		key:
			src.env(stdName) ||
			readDotenvVar(src, stdName) ||
			(await src.keychainGet("dchat", stdName)) ||
			undefined,
		missing: false,
	};
}
