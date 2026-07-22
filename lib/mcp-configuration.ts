function validHttpUrl(value: string, requireTls: boolean) {
  if (!value) return false;
  try {
    const url = new URL(value);
    if (!new Set(["http:", "https:"]).has(url.protocol)) return false;
    if (url.username || url.password) return false;
    if (requireTls && url.protocol !== "https:" && !new Set(["127.0.0.1", "localhost"]).has(url.hostname)) return false;
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
  const accessToken = env.MCP_SERVER_ACCESS_TOKEN?.trim() || "";
  const organizationId = env.PROPERTY_OS_ORG_ID?.trim() || "sample-org";
  const origin = env.MCP_SERVER_ORIGIN?.trim() || "";
  const requireTls = env.NODE_ENV === "production";
  const urlValid = validHttpUrl(url, requireTls);
  const tokenValid = accessToken.length >= 24;
  const originValid = !origin || validHttpUrl(origin, requireTls);
  const configured = Boolean(url && accessToken && urlValid && tokenValid && originValid);
  const partial = Boolean(url || accessToken || origin) && !configured;
  const issues = [
    ...(!url ? [] : urlValid ? [] : ["MCP_SERVER_URL must be a valid HTTP endpoint and use TLS outside localhost in production."]),
    ...(!accessToken ? [] : tokenValid ? [] : ["MCP_SERVER_ACCESS_TOKEN must contain at least 24 characters."]),
    ...(!origin ? [] : originValid ? [] : ["MCP_SERVER_ORIGIN must be a valid HTTP origin and use TLS outside localhost in production."]),
    ...(url && !accessToken ? ["MCP_SERVER_ACCESS_TOKEN is required when MCP_SERVER_URL is set."] : []),
    ...(accessToken && !url ? ["MCP_SERVER_URL is required when MCP_SERVER_ACCESS_TOKEN is set."] : [])
  ];

  return {
    configured,
    partial,
    issues,
    url,
    accessToken,
    organizationId,
    origin,
    timeoutMs: requestTimeout(env.MCP_REQUEST_TIMEOUT_MS)
  };
}
