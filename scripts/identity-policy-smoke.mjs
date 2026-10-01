import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { evaluateOidcIdentity } from "../lib/identity-policy.ts";
import { oidcAuthEnv, ownerAuthStatus, staticPrivatePilotAuthEnv } from "../lib/auth-configuration.ts";
import { ownerRoleHasCapability } from "../lib/owner-capabilities.ts";

const policy = {
  organizationId: "org-alpha",
  organizationClaim: "organization_id",
  roleClaim: "property_role"
};

const validProfile = {
  sub: "subject-123",
  email: "Owner@Example.test",
  email_verified: true,
  name: "Owner One",
  organization_id: "org-alpha",
  property_role: "manager"
};

const valid = evaluateOidcIdentity(validProfile, policy);
assert.equal(valid.ok, true);
if (valid.ok) {
  assert.equal(valid.identity.email, "owner@example.test");
  assert.equal(valid.identity.role, "manager");
}

for (const [reason, profile] of [
  ["missing-subject", { ...validProfile, sub: "" }],
  ["missing-email", { ...validProfile, email: "" }],
  ["unverified-email", { ...validProfile, email_verified: false }],
  ["wrong-organization", { ...validProfile, organization_id: "org-other" }],
  ["ambiguous-organization", { ...validProfile, organization_id: ["org-alpha", "org-other"] }],
  ["unauthorized-role", { ...validProfile, property_role: "viewer" }],
  ["ambiguous-role", { ...validProfile, property_role: ["manager", "owner"] }],
  ["ambiguous-role", { ...validProfile, property_role: ["manager", "unexpected-role"] }]
]) {
  const decision = evaluateOidcIdentity(profile, policy);
  assert.equal(decision.ok, false);
  if (!decision.ok) assert.equal(decision.reason, reason);
}

assert.equal(ownerRoleHasCapability("owner", "identity:revoke"), true);
assert.equal(ownerRoleHasCapability("agency-admin", "approvals:decide"), true);
assert.equal(ownerRoleHasCapability("manager", "operations:write"), true);
assert.equal(ownerRoleHasCapability("manager", "approvals:decide"), false);
assert.equal(ownerRoleHasCapability("manager", "identity:revoke"), false);

const managedEnv = [
  "NODE_ENV",
  "PROPERTY_OS_AUTH_MODE",
  "PROPERTY_OS_DEMO_AUTH",
  "PROPERTY_OS_LOCAL_PRODUCTION_TEST",
  "PROPERTY_OS_OIDC_PROVIDER_ID",
  "PROPERTY_OS_OIDC_ORGANIZATION_CLAIM",
  "PROPERTY_OS_OIDC_ROLE_CLAIM",
  ...staticPrivatePilotAuthEnv,
  ...oidcAuthEnv
];
const originalEnv = Object.fromEntries(managedEnv.map((name) => [name, process.env[name]]));

function clearAuthEnv() {
  for (const name of managedEnv) delete process.env[name];
}

try {
  clearAuthEnv();
  process.env.NODE_ENV = "production";
  process.env.PROPERTY_OS_DEMO_AUTH = "true";
  assert.equal(ownerAuthStatus().mode, "locked");

  process.env.NODE_ENV = "development";
  assert.equal(ownerAuthStatus().mode, "demo-open");

  clearAuthEnv();
  process.env.NODE_ENV = "production";
  process.env.PROPERTY_OS_AUTH_MODE = "oidc";
  process.env.OWNER_PORTAL_SECRET = randomBytes(32).toString("base64url");
  process.env.OWNER_PORTAL_PASSCODE_HASH = "a".repeat(64);
  const partialOidc = ownerAuthStatus();
  assert.equal(partialOidc.mode, "locked");
  assert.ok(partialOidc.missingEnv.includes("DATABASE_URL"));

  const configured = {
    DATABASE_URL: "postgres://example.invalid/property_os",
    APP_BASE_URL: "https://portal.example.test",
    BETTER_AUTH_SECRET: randomBytes(32).toString("base64url"),
    PROPERTY_OS_ORG_ID: "org-alpha",
    PROPERTY_OS_OIDC_ISSUER: "https://identity.example.test/tenant",
    PROPERTY_OS_OIDC_AUTHORIZATION_URL: "https://identity.example.test/tenant/authorize",
    PROPERTY_OS_OIDC_TOKEN_URL: "https://identity.example.test/tenant/token",
    PROPERTY_OS_OIDC_JWKS_URL: "https://identity.example.test/tenant/jwks",
    PROPERTY_OS_OIDC_CLIENT_ID: "property-os-client",
    PROPERTY_OS_OIDC_CLIENT_SECRET: "provider-issued-secret"
  };
  for (const [name, value] of Object.entries(configured)) process.env[name] = value;
  const configuredOidc = ownerAuthStatus();
  assert.equal(configuredOidc.mode, "oidc");
  assert.equal(configuredOidc.scope, "agency");
  assert.equal(configuredOidc.productionSafe, true);

  process.env.APP_BASE_URL = "http://localhost:3000";
  process.env.PROPERTY_OS_LOCAL_PRODUCTION_TEST = "true";
  const localOidc = ownerAuthStatus();
  assert.equal(localOidc.mode, "locked");
  assert.ok(localOidc.invalidEnv.some((error) => error.includes("APP_BASE_URL")));

  for (const [name, value] of Object.entries(configured)) process.env[name] = value;
  delete process.env.PROPERTY_OS_LOCAL_PRODUCTION_TEST;
  process.env.PROPERTY_OS_OIDC_TOKEN_URL = "https://foreign.example.test/token";
  assert.equal(ownerAuthStatus().mode, "locked");

  for (const [name, value] of Object.entries(configured)) process.env[name] = value;
  process.env.PROPERTY_OS_OIDC_ISSUER = "https://169.254.169.254/tenant";
  process.env.PROPERTY_OS_OIDC_AUTHORIZATION_URL = "https://169.254.169.254/tenant/authorize";
  process.env.PROPERTY_OS_OIDC_TOKEN_URL = "https://169.254.169.254/tenant/token";
  process.env.PROPERTY_OS_OIDC_JWKS_URL = "https://169.254.169.254/tenant/jwks";
  const privateEndpoint = ownerAuthStatus();
  assert.equal(privateEndpoint.mode, "locked");
  assert.ok(privateEndpoint.invalidEnv.some((error) => error.includes("private or reserved host")));

  clearAuthEnv();
  process.env.NODE_ENV = "production";
  process.env.PROPERTY_OS_AUTH_MODE = "static-private-pilot";
  process.env.PROPERTY_OS_DEMO_AUTH = "true";
  assert.equal(ownerAuthStatus().mode, "locked");

  process.env.OWNER_PORTAL_SECRET = randomBytes(32).toString("base64url");
  process.env.OWNER_PORTAL_PASSCODE_HASH = "a".repeat(64);
  assert.equal(ownerAuthStatus().mode, "locked");
  process.env.APP_BASE_URL = "https://portal.example.test";
  const privatePilot = ownerAuthStatus();
  assert.equal(privatePilot.mode, "static-private-pilot");
  assert.equal(privatePilot.scope, "private-single-owner");

  process.env.APP_BASE_URL = "http://localhost:3000";
  assert.equal(ownerAuthStatus().mode, "locked");
  process.env.PROPERTY_OS_LOCAL_PRODUCTION_TEST = "true";
  const localPrivatePilot = ownerAuthStatus();
  assert.equal(localPrivatePilot.mode, "static-private-pilot");
  assert.equal(localPrivatePilot.productionSafe, false);
  assert.equal(localPrivatePilot.scope, "local-demo");

  clearAuthEnv();
  process.env.PROPERTY_OS_AUTH_MODE = "unsupported";
  assert.equal(ownerAuthStatus().mode, "locked");
} finally {
  clearAuthEnv();
  for (const [name, value] of Object.entries(originalEnv)) {
    if (value !== undefined) process.env[name] = value;
  }
}

console.log("OIDC identity and role policy smoke passed.");
