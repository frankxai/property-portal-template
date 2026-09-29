const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function isLoopbackHostname(hostname: string) {
  return LOOPBACK_HOSTS.has(hostname.toLowerCase().replace(/^\[|\]$/g, ""));
}

export function isPrivateOrReservedHostname(hostname: string) {
  const value = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (isLoopbackHostname(value) || ["0.0.0.0", "::"].includes(value) || value.endsWith(".local")) return true;
  const octets = value.split(".").map(Number);
  if (octets.length === 4 && octets.every((octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255)) {
    return octets[0] === 10 || octets[0] === 127 || octets[0] === 0 ||
      (octets[0] === 169 && octets[1] === 254) ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168);
  }
  return value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe8") ||
    value.startsWith("fe9") || value.startsWith("fea") || value.startsWith("feb");
}

export function secureServiceUrlError(
  name: string,
  raw: string | undefined,
  options: { allowProductionLoopbackAppBase?: boolean } = {}
) {
  if (!raw) return `${name} is required`;
  try {
    const url = new URL(raw);
    const loopback = isLoopbackHostname(url.hostname);
    const loopbackAppBase = name === "APP_BASE_URL" && loopback;
    const productionLoopbackTest = loopbackAppBase && options.allowProductionLoopbackAppBase === true;
    const localDevelopment = process.env.NODE_ENV !== "production" && loopback;
    if (url.protocol !== "https:" && !((productionLoopbackTest || localDevelopment) && url.protocol === "http:")) {
      return `${name} must use HTTPS outside local development`;
    }
    if (url.username || url.password || url.hash) return `${name} cannot contain credentials or a fragment`;
    if (isPrivateOrReservedHostname(url.hostname) && !productionLoopbackTest && !localDevelopment) {
      return `${name} cannot target a private or reserved host`;
    }
    return null;
  } catch {
    return `${name} must be an absolute URL`;
  }
}
