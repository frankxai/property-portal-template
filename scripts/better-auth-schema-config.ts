import { getOidcAuth } from "../lib/oidc-auth.ts";

// Better Auth CLI entrypoint. Supply non-secret placeholder env values for schema generation.
export const auth = getOidcAuth();
