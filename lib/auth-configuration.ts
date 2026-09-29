import { secureServiceUrlError } from "./network-security.ts";

export type OwnerAuthMode = "static-private-pilot" | "oidc" | "demo-open" | "locked";

export type OwnerAuthStatus = {
  mode: OwnerAuthMode;
  configured: boolean;
  productionSafe: boolean;
  scope: "private-single-owner" | "agency" | "local-demo" | "none";
  providerId: string | null;
  requiredEnv: string[];
  missingEnv: string[];
  invalidEnv: string[];
  detail: string;
};

export const staticPrivatePilotAuthEnv = ["APP_BASE_URL", "OWNER_PORTAL_SECRET", "OWNER_PORTAL_PASSCODE_HASH"] as const;
export const oidcAuthEnv = [
  "DATABASE_URL",
  "APP_BASE_URL",
  "BETTER_AUTH_SECRET",
  "PROPERTY_OS_ORG_ID",
  "PROPERTY_OS_OIDC_ISSUER",
  "PROPERTY_OS_OIDC_AUTHORIZATION_URL",
  "PROPERTY_OS_OIDC_TOKEN_URL",
  "PROPERTY_OS_OIDC_JWKS_URL",
  "PROPERTY_OS_OIDC_CLIENT_ID",
  "PROPERTY_OS_OIDC_CLIENT_SECRET"
] as const;

function secretHasThirtyTwoBytes(value: string | undefined) {
  if (!value || !/^[A-Za-z0-9_-]{43,}$/.test(value)) return false;
  try {
    return Buffer.from(value, "base64url").byteLength >= 32;
  } catch {
    return false;
  }
}

function oidcConfigurationErrors() {
  const errors: string[] = [];
  if (!secretHasThirtyTwoBytes(process.env.BETTER_AUTH_SECRET)) {
    errors.push("BETTER_AUTH_SECRET must be at least 32 random base64url bytes");
  }

  const urlNames = [
    "APP_BASE_URL",
    "PROPERTY_OS_OIDC_ISSUER",
    "PROPERTY_OS_OIDC_AUTHORIZATION_URL",
    "PROPERTY_OS_OIDC_TOKEN_URL",
    "PROPERTY_OS_OIDC_JWKS_URL"
  ];
  for (const name of urlNames) {
    const error = secureServiceUrlError(name, process.env[name]);
    if (error) errors.push(error);
  }

  try {
    const issuer = new URL(process.env.PROPERTY_OS_OIDC_ISSUER || "");
    for (const name of [
      "PROPERTY_OS_OIDC_AUTHORIZATION_URL",
      "PROPERTY_OS_OIDC_TOKEN_URL",
      "PROPERTY_OS_OIDC_JWKS_URL"
    ]) {
      const endpoint = new URL(process.env[name] || "");
      if (endpoint.origin !== issuer.origin) errors.push(`${name} must share the configured issuer origin`);
    }
  } catch {
    // URL-specific errors above are more useful.
  }

  try {
    const database = new URL(process.env.DATABASE_URL || "");
    if (!["postgres:", "postgresql:"].includes(database.protocol)) {
      errors.push("DATABASE_URL must use PostgreSQL");
    }
  } catch {
    errors.push("DATABASE_URL must be a valid PostgreSQL URL");
  }

  if (!/^[a-z0-9][a-z0-9._-]{1,79}$/i.test(process.env.PROPERTY_OS_ORG_ID || "")) {
    errors.push("PROPERTY_OS_ORG_ID must be a stable 2-80 character identifier");
  }
  if (!/^[a-z0-9][a-z0-9._-]{1,79}$/i.test(process.env.PROPERTY_OS_OIDC_PROVIDER_ID || "property-os-oidc")) {
    errors.push("PROPERTY_OS_OIDC_PROVIDER_ID must be a stable 2-80 character identifier");
  }
  for (const [name, fallback] of [
    ["PROPERTY_OS_OIDC_ORGANIZATION_CLAIM", "organization_id"],
    ["PROPERTY_OS_OIDC_ROLE_CLAIM", "role"]
  ] as const) {
    if (!/^[A-Za-z_][A-Za-z0-9_.:-]{0,127}$/.test(process.env[name]?.trim() || fallback)) {
      errors.push(`${name} is not a valid claim name`);
    }
  }
  return [...new Set(errors)];
}

function lockedStatus(requiredEnv: string[], missingEnv: string[], invalidEnv: string[], detail: string): OwnerAuthStatus {
  return {
    mode: "locked",
    configured: false,
    productionSafe: false,
    scope: "none",
    providerId: null,
    requiredEnv,
    missingEnv,
    invalidEnv,
    detail
  };
}

export function ownerAuthStatus(): OwnerAuthStatus {
  const selectedMode = process.env.PROPERTY_OS_AUTH_MODE?.trim();

  if (!selectedMode) {
    if (process.env.NODE_ENV !== "production" && process.env.PROPERTY_OS_DEMO_AUTH === "true") {
      return {
        mode: "demo-open",
        configured: false,
        productionSafe: false,
        scope: "local-demo",
        providerId: null,
        requiredEnv: ["PROPERTY_OS_AUTH_MODE"],
        missingEnv: ["PROPERTY_OS_AUTH_MODE"],
        invalidEnv: [],
        detail: "Explicit local demo access is open. Production always locks when PROPERTY_OS_AUTH_MODE is absent."
      };
    }
    return lockedStatus(
      ["PROPERTY_OS_AUTH_MODE"],
      ["PROPERTY_OS_AUTH_MODE"],
      [],
      "Owner access is locked until PROPERTY_OS_AUTH_MODE explicitly selects static-private-pilot or oidc."
    );
  }

  if (selectedMode === "oidc") {
    const requiredEnv = [...oidcAuthEnv];
    const missingEnv = requiredEnv.filter((name) => !process.env[name]?.trim());
    const invalidEnv = missingEnv.length ? [] : oidcConfigurationErrors();
    if (missingEnv.length || invalidEnv.length) {
      return lockedStatus(
        requiredEnv,
        missingEnv,
        invalidEnv,
        "OIDC was selected and is locked until every identity, endpoint, secret, and database setting is valid. No passcode fallback is allowed."
      );
    }
    return {
      mode: "oidc",
      configured: true,
      productionSafe: true,
      scope: "agency",
      providerId: process.env.PROPERTY_OS_OIDC_PROVIDER_ID?.trim() || "property-os-oidc",
      requiredEnv,
      missingEnv: [],
      invalidEnv: [],
      detail: "Pre-bound tenant OIDC is configured with PKCE, signed ID-token validation, fixed server sessions, and local membership checks."
    };
  }

  if (selectedMode === "static-private-pilot") {
    const localProductionTest = process.env.PROPERTY_OS_LOCAL_PRODUCTION_TEST === "true";
    const requiredEnv = [...staticPrivatePilotAuthEnv];
    const missingEnv = requiredEnv.filter((name) => !process.env[name]?.trim());
    const invalidEnv = [
      ...(!missingEnv.includes("OWNER_PORTAL_SECRET") && !secretHasThirtyTwoBytes(process.env.OWNER_PORTAL_SECRET)
        ? ["OWNER_PORTAL_SECRET must be at least 32 random base64url bytes"]
        : []),
      ...(!missingEnv.includes("OWNER_PORTAL_PASSCODE_HASH") && !/^[a-f0-9]{64}$/i.test(process.env.OWNER_PORTAL_PASSCODE_HASH || "")
        ? ["OWNER_PORTAL_PASSCODE_HASH must be a 64-character SHA-256 digest"]
        : []),
      ...(!missingEnv.includes("APP_BASE_URL") && secureServiceUrlError(
        "APP_BASE_URL",
        process.env.APP_BASE_URL,
        { allowProductionLoopbackAppBase: localProductionTest }
      )
        ? [secureServiceUrlError(
            "APP_BASE_URL",
            process.env.APP_BASE_URL,
            { allowProductionLoopbackAppBase: localProductionTest }
          )!]
        : [])
    ];
    if (missingEnv.length || invalidEnv.length) {
      return lockedStatus(
        requiredEnv,
        missingEnv,
        invalidEnv,
        "Private-pilot access is locked until its canonical origin, signing secret, and passcode digest are valid."
      );
    }
    return {
      mode: "static-private-pilot",
      configured: true,
      productionSafe: !localProductionTest,
      scope: localProductionTest ? "local-demo" : "private-single-owner",
      providerId: null,
      requiredEnv,
      missingEnv: [],
      invalidEnv: [],
      detail: localProductionTest
        ? "Explicit localhost production-bundle test access is configured and is never production-safe."
        : "Private single-owner pilot auth is configured. It is not an agency or multi-user identity system."
    };
  }

  return lockedStatus(
    ["PROPERTY_OS_AUTH_MODE"],
    [],
    ["PROPERTY_OS_AUTH_MODE must be static-private-pilot or oidc"],
    "Owner access is locked because PROPERTY_OS_AUTH_MODE is not supported."
  );
}
