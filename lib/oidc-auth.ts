import { betterAuth } from "better-auth";
import { genericOAuth } from "better-auth/plugins";
import { Pool, type PoolClient } from "pg";
import { evaluateOidcIdentity, type OwnerRole } from "./identity-policy.ts";
import { secureServiceUrlError } from "./network-security.ts";
import { verifyOidcIdToken } from "./oidc-token.ts";

export { verifyOidcIdToken } from "./oidc-token.ts";

export const defaultOidcProviderId = "property-os-oidc";

export type OidcConfiguration = {
  appBaseUrl: string;
  databaseUrl: string;
  secret: string;
  organizationId: string;
  issuer: string;
  authorizationUrl: string;
  tokenUrl: string;
  jwksUrl: string;
  clientId: string;
  clientSecret: string;
  providerId: string;
  organizationClaim: string;
  roleClaim: string;
};

type OidcMembership = {
  role: OwnerRole;
  email: string;
  subject: string;
};

declare global {
  var __propertyPortalAuthPool: Pool | undefined;
  var __propertyPortalOidcAuth: ReturnType<typeof createOidcAuth> | undefined;
}

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for OIDC owner authentication.`);
  return value;
}

function secureUrl(name: string, value: string, expectedOrigin?: string) {
  const url = new URL(value);
  const error = secureServiceUrlError(name, value);
  if (error) throw new Error(`${error}.`);
  if (expectedOrigin && url.origin !== expectedOrigin) throw new Error(`${name} must share the configured issuer origin.`);
  return url.toString();
}

function issuerIdentifier(value: string) {
  secureUrl("PROPERTY_OS_OIDC_ISSUER", value);
  return value;
}

function secretHasThirtyTwoBytes(value: string) {
  return /^[A-Za-z0-9_-]{43,}$/.test(value) && Buffer.from(value, "base64url").byteLength >= 32;
}

export function oidcConfiguration(): OidcConfiguration {
  const issuer = issuerIdentifier(required("PROPERTY_OS_OIDC_ISSUER"));
  const issuerOrigin = new URL(issuer).origin;
  const secret = required("BETTER_AUTH_SECRET");
  if (!secretHasThirtyTwoBytes(secret)) {
    throw new Error("BETTER_AUTH_SECRET must contain at least 32 random base64url bytes.");
  }
  const databaseUrl = required("DATABASE_URL");
  if (!["postgres:", "postgresql:"].includes(new URL(databaseUrl).protocol)) {
    throw new Error("DATABASE_URL must use PostgreSQL.");
  }
  return {
    appBaseUrl: new URL(secureUrl("APP_BASE_URL", required("APP_BASE_URL"))).origin,
    databaseUrl,
    secret,
    organizationId: required("PROPERTY_OS_ORG_ID"),
    issuer,
    authorizationUrl: secureUrl(
      "PROPERTY_OS_OIDC_AUTHORIZATION_URL",
      required("PROPERTY_OS_OIDC_AUTHORIZATION_URL"),
      issuerOrigin
    ),
    tokenUrl: secureUrl("PROPERTY_OS_OIDC_TOKEN_URL", required("PROPERTY_OS_OIDC_TOKEN_URL"), issuerOrigin),
    jwksUrl: secureUrl("PROPERTY_OS_OIDC_JWKS_URL", required("PROPERTY_OS_OIDC_JWKS_URL"), issuerOrigin),
    clientId: required("PROPERTY_OS_OIDC_CLIENT_ID"),
    clientSecret: required("PROPERTY_OS_OIDC_CLIENT_SECRET"),
    providerId: process.env.PROPERTY_OS_OIDC_PROVIDER_ID?.trim() || defaultOidcProviderId,
    organizationClaim: process.env.PROPERTY_OS_OIDC_ORGANIZATION_CLAIM?.trim() || "organization_id",
    roleClaim: process.env.PROPERTY_OS_OIDC_ROLE_CLAIM?.trim() || "role"
  };
}

function authPool() {
  const config = oidcConfiguration();
  globalThis.__propertyPortalAuthPool ??= new Pool({
    connectionString: config.databaseUrl,
    max: 3,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 10_000
  });
  return globalThis.__propertyPortalAuthPool;
}

async function inOrganizationTransaction<T>(run: (client: PoolClient, config: OidcConfiguration) => Promise<T>) {
  const config = oidcConfiguration();
  const client = await authPool().connect();
  try {
    await client.query("begin");
    await client.query("select set_config('property_os.organization_id', $1, true)", [config.organizationId]);
    const result = await run(client, config);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function authorizePreboundProfile(profile: Record<string, unknown>) {
  const config = oidcConfiguration();
  const decision = evaluateOidcIdentity(profile, {
    organizationId: config.organizationId,
    organizationClaim: config.organizationClaim,
    roleClaim: config.roleClaim
  });
  if (!decision.ok) return null;

  const identity = decision.identity;
  const membership = await inOrganizationTransaction(async (client) => {
    const result = await client.query<{ id: string; role: OwnerRole; email: string }>(
      `select id, role, email
       from organization_members
       where organization_id = $1
         and identity_issuer = $2
         and identity_subject = $3
         and lower(email) = $4
         and status = 'active'
       for update`,
      [config.organizationId, config.issuer, identity.subject, identity.email]
    );
    const member = result.rows[0];
    if (!member || member.role !== identity.role) return null;
    await client.query(
      `update organization_members
       set last_authenticated_at = now(), updated_at = now()
       where id = $1 and organization_id = $2`,
      [member.id, config.organizationId]
    );
    return member;
  });
  if (!membership) return null;

  return {
    id: identity.subject,
    email: identity.email,
    emailVerified: true,
    name: identity.name
  };
}

async function verifiedOidcUser(tokens: { idToken?: string }) {
  if (!tokens.idToken) return null;
  try {
    const config = oidcConfiguration();
    const claims = await verifyOidcIdToken(tokens.idToken, config);
    return authorizePreboundProfile(claims as Record<string, unknown>);
  } catch {
    return null;
  }
}

function createOidcAuth() {
  const config = oidcConfiguration();
  return betterAuth({
    appName: "Property Intelligence OS",
    baseURL: config.appBaseUrl,
    basePath: "/api/auth",
    secret: config.secret,
    database: authPool(),
    trustedOrigins: [config.appBaseUrl],
    emailAndPassword: { enabled: false },
    session: {
      modelName: "auth_sessions",
      fields: {
        userId: "user_id",
        expiresAt: "expires_at",
        ipAddress: "ip_address",
        userAgent: "user_agent",
        createdAt: "created_at",
        updatedAt: "updated_at"
      },
      expiresIn: 60 * 60,
      updateAge: 60 * 60 * 24,
      freshAge: 60 * 15,
      cookieCache: { enabled: false }
    },
    user: {
      modelName: "auth_users",
      fields: {
        emailVerified: "email_verified",
        image: "image_url",
        createdAt: "created_at",
        updatedAt: "updated_at"
      }
    },
    account: {
      modelName: "auth_accounts",
      fields: {
        userId: "user_id",
        accountId: "account_id",
        providerId: "provider_id",
        accessToken: "access_token",
        refreshToken: "refresh_token",
        idToken: "id_token",
        accessTokenExpiresAt: "access_token_expires_at",
        refreshTokenExpiresAt: "refresh_token_expires_at",
        createdAt: "created_at",
        updatedAt: "updated_at"
      },
      encryptOAuthTokens: true,
      accountLinking: {
        enabled: false,
        disableImplicitLinking: true,
        allowDifferentEmails: false,
        allowUnlinkingAll: false
      }
    },
    verification: {
      modelName: "auth_verifications",
      fields: {
        expiresAt: "expires_at",
        createdAt: "created_at",
        updatedAt: "updated_at"
      },
      storeIdentifier: "hashed"
    },
    advanced: {
      useSecureCookies: process.env.NODE_ENV === "production",
      database: { generateId: () => globalThis.crypto.randomUUID() }
    },
    disabledPaths: [
      "/sign-up/email",
      "/sign-in/email",
      "/change-email",
      "/change-password",
      "/set-password",
      "/request-password-reset",
      "/reset-password",
      "/send-verification-email",
      "/verify-email",
      "/update-user",
      "/delete-user",
      "/link-social",
      "/unlink-account",
      "/oauth2/link"
    ],
    rateLimit: {
      enabled: true,
      storage: "database",
      modelName: "auth_rate_limits",
      fields: { lastRequest: "last_request" },
      window: 60,
      max: 30,
      customRules: {
        "/sign-in/oauth2": { window: 60, max: 10 },
        "/oauth2/callback/:providerId": { window: 60, max: 20 }
      }
    },
    telemetry: { enabled: false },
    plugins: [
      genericOAuth({
        config: [{
          providerId: config.providerId,
          clientId: config.clientId,
          clientSecret: config.clientSecret,
          authorizationUrl: config.authorizationUrl,
          tokenUrl: config.tokenUrl,
          issuer: config.issuer,
          requireIssuerValidation: true,
          responseType: "code",
          scopes: ["openid", "profile", "email"],
          pkce: true,
          disableImplicitSignUp: true,
          overrideUserInfo: false,
          getUserInfo: verifiedOidcUser
        }]
      })
    ]
  });
}

export function getOidcAuth() {
  globalThis.__propertyPortalOidcAuth ??= createOidcAuth();
  return globalThis.__propertyPortalOidcAuth;
}

export async function oidcMembershipForUser(userId: string): Promise<OidcMembership | null> {
  return inOrganizationTransaction(async (client, config) => {
    const result = await client.query<OidcMembership>(
      `select om.role, om.email, om.identity_subject as subject
       from auth_accounts aa
       join organization_members om
         on om.identity_issuer = $1
        and om.identity_subject = aa.account_id
        and om.organization_id = $2
        and om.status = 'active'
       where aa.user_id = $3
         and aa.provider_id = $4
       limit 1`,
      [config.issuer, config.organizationId, userId, config.providerId]
    );
    return result.rows[0] ?? null;
  });
}

export async function revokeOidcMembership(subject: string, actorSubject: string) {
  return inOrganizationTransaction(async (client, config) => {
    const actor = await client.query<{ role: OwnerRole }>(
      `select role
       from organization_members
       where organization_id = $1
         and identity_issuer = $2
         and identity_subject = $3
         and status = 'active'
         and role in ('owner', 'agency-admin')
       for share`,
      [config.organizationId, config.issuer, actorSubject]
    );
    if (!actor.rows[0]) throw new Error("The revocation actor is no longer authorized.");
    const result = await client.query<{ id: string }>(
      `update organization_members
       set status = 'revoked', updated_at = now()
       where organization_id = $1
         and identity_issuer = $2
         and identity_subject = $3
         and status = 'active'
       returning id`,
      [config.organizationId, config.issuer, subject]
    );
    if (!result.rows[0]) return { revoked: false, sessionsDeleted: 0 };
    const sessions = await client.query(
      `delete from auth_sessions
       where user_id in (
         select user_id from auth_accounts where provider_id = $1 and account_id = $2
       )`,
      [config.providerId, subject]
    );
    await client.query(
      `insert into audit_events (id, organization_id, actor, event_type, subject_type, subject_id, metadata)
       values ($1, $2, $3, 'identity.membership_revoked', 'organization_member', $4, $5::jsonb)`,
      [
        `audit-${globalThis.crypto.randomUUID()}`,
        config.organizationId,
        `oidc:${actorSubject}`,
        result.rows[0].id,
        JSON.stringify({ sessionsDeleted: sessions.rowCount ?? 0 })
      ]
    );
    return { revoked: true, sessionsDeleted: sessions.rowCount ?? 0 };
  });
}
