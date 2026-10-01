import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { getAuthTables } from "better-auth/db";
import { getOidcAuth } from "../lib/oidc-auth.ts";

const [schema, migration] = await Promise.all([
  readFile(new URL("../db/schema.sql", import.meta.url), "utf8"),
  readFile(new URL("../db/004-tenant-oidc.sql", import.meta.url), "utf8")
]);

const authEnv = {
  NODE_ENV: "development",
  DATABASE_URL: "postgres://schema:contract@127.0.0.1:5432/property_os",
  APP_BASE_URL: "http://127.0.0.1:3000",
  BETTER_AUTH_SECRET: randomBytes(32).toString("base64url"),
  PROPERTY_OS_ORG_ID: "schema-contract-org",
  PROPERTY_OS_OIDC_ISSUER: "http://127.0.0.1:4100/issuer",
  PROPERTY_OS_OIDC_AUTHORIZATION_URL: "http://127.0.0.1:4100/authorize",
  PROPERTY_OS_OIDC_TOKEN_URL: "http://127.0.0.1:4100/token",
  PROPERTY_OS_OIDC_JWKS_URL: "http://127.0.0.1:4100/jwks",
  PROPERTY_OS_OIDC_CLIENT_ID: "schema-contract-client",
  PROPERTY_OS_OIDC_CLIENT_SECRET: "schema-contract-fixture"
};
const originalEnv = Object.fromEntries(Object.keys(authEnv).map((name) => [name, process.env[name]]));
Object.assign(process.env, authEnv);

let authTables;
try {
  authTables = getAuthTables(getOidcAuth().options);
} finally {
  for (const [name, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

const expectedModels = ["auth_users", "auth_sessions", "auth_accounts", "auth_verifications", "auth_rate_limits"];
assert.deepEqual(Object.values(authTables).map((table) => table.modelName).sort(), expectedModels.sort());
for (const table of Object.values(authTables)) {
  const escapedModel = table.modelName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const [label, sql] of [["fresh schema", schema], ["OIDC migration", migration]]) {
    const tableDefinition = sql.match(new RegExp(`create table if not exists ${escapedModel} \\(([\\s\\S]*?)\\n\\);`, "i"))?.[1];
    assert.ok(tableDefinition, `${label} is missing Better Auth model ${table.modelName}`);
    for (const field of Object.values(table.fields)) {
      assert.match(tableDefinition, new RegExp(`\\b${field.fieldName}\\b`, "i"), `${label} ${table.modelName} is missing ${field.fieldName}`);
    }
  }
}

for (const required of [
  "auth_users",
  "auth_sessions",
  "auth_accounts",
  "auth_verifications",
  "auth_rate_limits",
  "property_os_schema_versions",
  "property_os_bind_oidc_member",
  "organization_id, identity_issuer, identity_subject",
  "1.6.23-property-os.1"
]) {
  assert.ok(schema.includes(required), `Fresh schema is missing ${required}`);
  assert.ok(migration.includes(required), `OIDC migration is missing ${required}`);
}

assert.match(migration, /^--[\s\S]*\nbegin;/);
assert.match(migration, /lock table organization_members/i);
assert.match(migration, /raise exception 'Duplicate organization\/issuer\/subject memberships/i);
assert.match(migration, /revoke all on function property_os_bind_oidc_member/i);
assert.match(migration, /commit;\s*$/);

console.log("Pinned Better Auth model and transactional identity schema contract passed.");
