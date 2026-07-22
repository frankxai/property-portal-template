import type { controlPlaneConfiguration } from "./mcp-configuration.ts";

type ControlPlaneConfiguration = ReturnType<typeof controlPlaneConfiguration>;
type CachedCredential = { token: string; expiresAt: number };

let cachedCredential: CachedCredential | null = null;
let credentialRequest: Promise<CachedCredential> | null = null;

async function fetchClientCredential(config: ControlPlaneConfiguration) {
  const basicCredential = `${encodeURIComponent(config.clientId)}:${encodeURIComponent(config.clientSecret)}`;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    audience: config.audience,
    scope: config.scope
  });
  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
      authorization: `Basic ${Buffer.from(basicCredential).toString("base64")}`
    },
    body,
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(Math.min(config.timeoutMs, 8_000))
  });
  if (!response.ok) throw new Error("The MCP identity provider denied the service credential request.");
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > 32_768) throw new Error("The MCP credential response exceeded the size limit.");
  const raw = await response.text();
  if (raw.length > 32_768) throw new Error("The MCP credential response exceeded the size limit.");
  const payload = JSON.parse(raw) as Record<string, unknown>;
  const token = typeof payload.access_token === "string" ? payload.access_token : "";
  const tokenType = typeof payload.token_type === "string" ? payload.token_type.toLowerCase() : "";
  const expiresIn = typeof payload.expires_in === "number" ? payload.expires_in : Number(payload.expires_in);
  if (token.length < 32 || tokenType !== "bearer" || !Number.isFinite(expiresIn) || expiresIn < 60 || expiresIn > 86_400) {
    throw new Error("The MCP credential response did not satisfy the bearer token contract.");
  }
  return { token, expiresAt: Date.now() + expiresIn * 1000 };
}

export async function controlPlaneAccessToken(config: ControlPlaneConfiguration) {
  if (config.authMode === "static") return config.accessToken;
  if (config.authMode !== "oidc-client-credentials") throw new Error("MCP authentication mode is not configured.");
  if (cachedCredential && cachedCredential.expiresAt - Date.now() > 60_000) return cachedCredential.token;

  credentialRequest ??= fetchClientCredential(config);
  try {
    cachedCredential = await credentialRequest;
    return cachedCredential.token;
  } finally {
    credentialRequest = null;
  }
}

export function clearControlPlaneCredentialCacheForTests() {
  cachedCredential = null;
  credentialRequest = null;
}
