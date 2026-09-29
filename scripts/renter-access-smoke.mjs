import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  createRenterAccessGrant,
  demoRenterAccessAllowed,
  hashRenterAccessCode,
  renterAccessGrantIsUsable,
  resolveRenterStay,
  validRenterAccessCode
} from "../lib/renter-access.ts";
import { ownerRoleHasCapability } from "../lib/owner-capabilities.ts";

const now = new Date("2026-07-22T12:00:00.000Z");
const organizationId = "smoke-org";
const strongCode = Buffer.alloc(32, 7).toString("base64url");
const strongCodeHash = hashRenterAccessCode(strongCode);
const sourceRoot = fileURLToPath(new URL("..", import.meta.url));

function lookupRecord(overrides = {}) {
  return {
    id: "renter-smoke-grant",
    organizationId,
    propertyId: "property-a",
    unitId: "unit-a",
    rentalLabel: "Sample rental",
    expiresAt: "2026-07-23T12:00:00.000Z",
    revokedAt: null,
    createdAt: now.toISOString(),
    propertyName: "Sample property",
    resolvedPropertyId: "property-a",
    resolvedUnitPropertyId: "property-a",
    sections: [],
    ...overrides
  };
}

function lookupDatabase(record, calls) {
  return {
    async createGrant() {
      throw new Error("not used");
    },
    async revokeGrant() {
      throw new Error("not used");
    },
    async resolveGrant(input) {
      calls.push(input);
      return record;
    }
  };
}

assert.equal(strongCode.length, 43);
assert.equal(validRenterAccessCode(strongCode), true);
assert.match(strongCodeHash, /^[a-f0-9]{64}$/);
for (const weakCode of ["sample-stay", "short", "a".repeat(42), "a".repeat(44), `${"a".repeat(42)}!`]) {
  assert.equal(validRenterAccessCode(weakCode), false);
}

const persisted = [];
const creationDatabase = {
  async createGrant(input) {
    persisted.push(input);
    return {
      id: input.id,
      organizationId: input.organizationId,
      propertyId: input.propertyId,
      unitId: input.unitId,
      rentalLabel: input.rentalLabel,
      expiresAt: input.expiresAt,
      revokedAt: null,
      createdAt: input.createdAt
    };
  },
  async revokeGrant() {
    return false;
  },
  async resolveGrant() {
    return null;
  }
};
const created = await createRenterAccessGrant({
  propertyId: "property-a",
  unitId: "unit-a",
  rentalLabel: "Sample rental",
  expiresAt: "2026-07-23T12:00:00.000Z",
  actorId: "oidc:owner-subject",
  actorRole: "owner"
}, {
  database: creationDatabase,
  env: { PROPERTY_OS_ORG_ID: organizationId },
  now,
  codeFactory: () => strongCode
});
assert.equal(created.accessCode, strongCode);
assert.equal(persisted.length, 1);
assert.equal(persisted[0].codeHash, strongCodeHash);
assert.doesNotMatch(JSON.stringify(persisted), new RegExp(strongCode));
assert.equal("accessCode" in persisted[0], false);

assert.equal(renterAccessGrantIsUsable(lookupRecord(), organizationId, now), true);
assert.equal(renterAccessGrantIsUsable(lookupRecord({ expiresAt: now.toISOString() }), organizationId, now), false);
assert.equal(renterAccessGrantIsUsable(lookupRecord({ revokedAt: now.toISOString() }), organizationId, now), false);
assert.equal(renterAccessGrantIsUsable(lookupRecord({ organizationId: "other-org" }), organizationId, now), false);
assert.equal(renterAccessGrantIsUsable(lookupRecord({ resolvedPropertyId: "property-b" }), organizationId, now), false);
assert.equal(renterAccessGrantIsUsable(lookupRecord({ resolvedUnitPropertyId: "property-b" }), organizationId, now), false);

for (const [name, record] of [
  ["expired", lookupRecord({ expiresAt: now.toISOString() })],
  ["revoked", lookupRecord({ revokedAt: now.toISOString() })],
  ["wrong tenant", lookupRecord({ organizationId: "other-org" })],
  ["wrong property", lookupRecord({ resolvedPropertyId: "property-b" })],
  ["wrong unit property", lookupRecord({ resolvedUnitPropertyId: "property-b" })]
]) {
  const calls = [];
  const result = await resolveRenterStay(strongCode, {
    database: lookupDatabase(record, calls),
    env: { PROPERTY_OS_ORG_ID: organizationId, NODE_ENV: "production" },
    now,
    requestIdentifier: `smoke-${name}`
  });
  assert.equal(result, null, `${name} grant must be rejected`);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].codeHash, strongCodeHash);
  assert.equal("accessCode" in calls[0], false);
}

const malformedCalls = [];
assert.equal(await resolveRenterStay("sample-stay", {
  database: lookupDatabase(lookupRecord(), malformedCalls),
  env: { PROPERTY_OS_ORG_ID: organizationId, NODE_ENV: "production", PROPERTY_OS_DEMO_RUNTIME: "true", APP_BASE_URL: "http://localhost:3000" },
  now,
  requestIdentifier: "smoke-malformed"
}), null);
assert.equal(malformedCalls.length, 0);

assert.equal(demoRenterAccessAllowed({
  NODE_ENV: "development",
  PROPERTY_OS_DEMO_RUNTIME: "true",
  APP_BASE_URL: "http://localhost:3000"
}), true);
assert.equal(demoRenterAccessAllowed({
  NODE_ENV: "production",
  PROPERTY_OS_DEMO_RUNTIME: "true",
  APP_BASE_URL: "http://localhost:3000"
}), false);

assert.equal(await resolveRenterStay(strongCode, {
  env: { PROPERTY_OS_ORG_ID: organizationId, NODE_ENV: "production" },
  now,
  requestIdentifier: "smoke-no-database"
}), null);

const logged = [];
const originalConsoleError = console.error;
console.error = (...values) => logged.push(values);
try {
  const unavailable = lookupDatabase(lookupRecord(), []);
  unavailable.resolveGrant = async () => { throw new Error(`database failed for ${strongCode}`); };
  assert.equal(await resolveRenterStay(strongCode, {
    database: unavailable,
    env: { PROPERTY_OS_ORG_ID: organizationId, NODE_ENV: "production" },
    now,
    requestIdentifier: "smoke-db-error"
  }), null);
} finally {
  console.error = originalConsoleError;
}
const serializedLogs = JSON.stringify(logged);
assert.doesNotMatch(serializedLogs, new RegExp(strongCode));
assert.doesNotMatch(serializedLogs, new RegExp(strongCodeHash));

const [schema, rls, migration, service, createRoute, revokeRoute, stayPage] = await Promise.all([
  readFile(`${sourceRoot}/db/schema.sql`, "utf8"),
  readFile(`${sourceRoot}/db/rls.sql`, "utf8"),
  readFile(`${sourceRoot}/db/005-renter-access.sql`, "utf8"),
  readFile(`${sourceRoot}/lib/renter-access.ts`, "utf8"),
  readFile(`${sourceRoot}/app/api/renter-access/route.ts`, "utf8"),
  readFile(`${sourceRoot}/app/api/renter-access/[id]/revoke/route.ts`, "utf8"),
  readFile(`${sourceRoot}/app/stay/[accessCode]/page.tsx`, "utf8")
]);
assert.match(schema, /code_hash text not null unique/);
assert.match(migration, /foreign key \(property_id, organization_id\)/);
assert.match(migration, /foreign key \(unit_id, property_id\)/);
assert.doesNotMatch(`${schema}\n${migration}`, /access_code\s+text/i);
assert.match(rls, /alter table renter_access_grants force row level security/);
assert.match(rls, /organization_id = property_os_current_organization_id\(\)/);
assert.doesNotMatch(service, /exact_address_private/);
assert.match(createRoute, /requireOwnerApiAccess\(request, "renter-access:create"\)/);
assert.match(revokeRoute, /requireOwnerApiAccess\(request, "renter-access:revoke"\)/);
assert.equal(ownerRoleHasCapability("manager", "renter-access:create"), true);
assert.equal(ownerRoleHasCapability("manager", "renter-access:revoke"), false);
assert.equal(ownerRoleHasCapability("manager", "approvals:decide"), false);
assert.equal(ownerRoleHasCapability("manager", "owner-inbox:close"), false);
assert.doesNotMatch(stayPage, /getStaySession|staySessions|generateStaticParams/);

console.log("Renter access smoke passed: strong one-time codes, tenant/property binding, expiry, revocation, fail-closed lookup, capability split, and plaintext exclusion.");
