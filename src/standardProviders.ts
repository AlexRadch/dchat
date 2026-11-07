// Standard providers component: returns its own provider array and owns the
// standard provider imports, so the entry point never touches provider
// implementations (ADR-002: dependencies travel as function arguments,
// composition happens in the entry point).
import { builtinProviders } from "@earendil-works/pi-ai/providers/all";
import type {
	AuthContext,
	CredentialStore,
	Provider,
} from "@earendil-works/pi-ai";

export function standardProviders(
	_credentials: CredentialStore,
	_authContext: AuthContext,
): Provider[] {
	return builtinProviders();
}
