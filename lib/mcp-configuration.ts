export type ControlPlaneAuthMode = "static" | "oidc-client-credentials";

function validHttpUrl(value: string, requireTls: boolean) {
  if (!value) return false;
  try {
    const url = new URL(value);
    if (!new Set(["http:", "https:"]).has(url.protocol)) return false;
    if (url.username || url.password || url.hash) return false;
    if (requireTls && url.protocol !== "https:" && !new Set(["127.0.0.1", "localhost", "::1"]).has(url.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

function requestTimeout(value: string | undefined) {
  const parsed = Number(value || 8000);
  if (!Number.isFinite(parsed)) return 8000;
  return Math.min(30000, Math.max(1000, Math.round(parsed)));
}

export function controlPlaneConfiguration(env: NodeJS.ProcessEnv = process.env) {
  const url = env.MCP_SERVER_URL?.trim() || "";
  const selectedMode = env.MCP_SERVER_AUTH_MODE?.trim() || "";
  const authMode = selectedMode === "static" || selectedMode === "oidc-client-credentials"
    ? selectedMode as ControlPlaneAuthMode
    : null;
  const accessToken = env.MCP_SERVER_ACCESS_TOKEN?.trim() || "";
  const tokenUrl = env.MCP_OIDC_TOKEN_URL?.trim() || "";
  const clientId = env.MCP_OIDC_CLIENT_ID?.trim() || "";
  const clientSecret = env.MCP_OIDC_CLIENT_SECRET?.trim() || "";
  const audience = env.MCP_OIDC_AUDIENCE?.trim() || "";
  const scope = env.MCP_OIDC_SCOPE?.trim() || "";
  const organizationId = env.PROPERTY_OS_ORG_ID?.trim() || "";
  const origin = env.MCP_SERVER_ORIGIN?.trim() || "";
  const requireTls = env.NODE_ENV === "production";
  const urlValid = validHttpUrl(url, requireTls);
  const originValid = !origin || validHttpUrl(origin, requireTls);
  const tokenUrlValid = !tokenUrl || validHttpUrl(tokenUrl, requireTls);
  const staticRequired = ["MCP_SERVER_URL", "MCP_SERVER_AUTH_MODE", "MCP_SERVER_ACCESS_TOKEN", "PROPERTY_OS_ORG_ID"];
  const oidcRequired = [
    "MCP_SERVER_URL",
    "MCP_SERVER_AUTH_MODE",
    "MCP_OIDC_TOKEN_URL",
    "MCP_OIDC_CLIENT_ID",
    "MCP_OIDC_CLIENT_SECRET",
    "MCP_OIDC_AUDIENCE",
    "MCP_OIDC_SCOPE",
    "PROPERTY_OS_ORG_ID"
  ];
  const requiredEnv = authMode === "oidc-client-credentials" ? oidcRequired : staticRequired;
  const missingEnv = url || selectedMode
    ? requiredEnv.filter((name) => !env[name]?.trim())
    : [];
  const modeValid = Boolean(authMode);
  const credentialValid = authMode === "static"
    ? accessToken.length >= 32 && !tokenUrl && !clientId && !clientSecret
    : authMode === "oidc-client-credentials"
      ? tokenUrlValid && Boolean(clientId && clientSecret && audience && scope) && !accessToken
      : false;
  const configured = Boolean(url && modeValid && credentialValid && organizationId && urlValid && originValid && !missingEnv.length);
  const partial = Boolean(
    url || selectedMode || accessToken || tokenUrl || clientId || clientSecret || audience || scope || origin
  ) && !configured;
  const issues = [
    ...(!url ? [] : urlValid ? [] : ["MCP_SERVER_URL must be a valid HTTP endpoint and use TLS outside localhost in production."]),
    ...(!selectedMode || modeValid ? [] : ["MCP_SERVER_AUTH_MODE must be static or oidc-client-credentials."]),
    ...(!origin ? [] : originValid ? [] : ["MCP_SERVER_ORIGIN must be a valid HTTP origin and use TLS outside localhost in production."]),
    ...(!tokenUrl ? [] : tokenUrlValid ? [] : ["MCP_OIDC_TOKEN_URL must be a valid endpoint and use TLS outside localhost in production."]),
    ...(authMode === "static" && accessToken && accessToken.length < 32 ? ["MCP_SERVER_ACCESS_TOKEN must contain at least 32 characters."] : []),
    ...(authMode === "static" && (tokenUrl || clientId || clientSecret) ? ["Static MCP mode cannot also configure OIDC client credentials."] : []),
    ...(authMode === "oidc-client-credentials" && accessToken ? ["OIDC MCP mode cannot use a stored MCP_SERVER_ACCESS_TOKEN."] : []),
    ...missingEnv.map((name) => `${name} is required for the selected MCP auth mode.`)
  ];

  return {
    configured,
    partial,
    issues: [...new Set(issues)],
    requiredEnv,
    missingEnv,
    url,
    authMode,
    accessToken,
    tokenUrl,
    clientId,
    clientSecret,
    audience,
    scope,
    organizationId,
    origin,
    timeoutMs: requestTimeout(env.MCP_REQUEST_TIMEOUT_MS)
  };
}
