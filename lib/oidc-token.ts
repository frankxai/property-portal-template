import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

export type OidcTokenVerificationConfig = {
  issuer: string;
  clientId: string;
  jwksUrl: string;
};

const jwksByUrl = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function remoteJwks(url: string) {
  let jwks = jwksByUrl.get(url);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(url), {
      timeoutDuration: 6_000,
      cooldownDuration: 30_000,
      cacheMaxAge: 10 * 60_000
    });
    jwksByUrl.set(url, jwks);
  }
  return jwks;
}

export async function verifyOidcIdToken(
  idToken: string,
  config: OidcTokenVerificationConfig
): Promise<JWTPayload> {
  const result = await jwtVerify(idToken, remoteJwks(config.jwksUrl), {
    issuer: config.issuer,
    audience: config.clientId,
    algorithms: ["RS256", "ES256"],
    maxTokenAge: "10 minutes",
    clockTolerance: 5
  });
  const audience = Array.isArray(result.payload.aud) ? result.payload.aud : [result.payload.aud];
  const authorizedParty = typeof result.payload.azp === "string" ? result.payload.azp : null;
  if ((audience.length > 1 || authorizedParty) && authorizedParty !== config.clientId) {
    throw new Error("OIDC ID token authorized party did not match the configured client.");
  }
  return result.payload;
}
