import postgres from "postgres";
import { ownerAuthStatus } from "../lib/auth-configuration.ts";

const status = ownerAuthStatus();
if (status.mode !== "oidc") {
  console.error("A complete PROPERTY_OS_AUTH_MODE=oidc configuration is required for the identity database smoke.");
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
const organizationId = process.env.PROPERTY_OS_ORG_ID;
const issuer = process.env.PROPERTY_OS_OIDC_ISSUER;
const expectedSubjects = (process.env.PROPERTY_OS_EXPECTED_OIDC_SUBJECTS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
if (!databaseUrl || !organizationId || !issuer || !expectedSubjects.length) {
  console.error("DATABASE_URL, PROPERTY_OS_ORG_ID, PROPERTY_OS_OIDC_ISSUER, and PROPERTY_OS_EXPECTED_OIDC_SUBJECTS are required.");
  process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1, idle_timeout: 20, connect_timeout: 10 });

try {
  const evidence = await sql.begin(async (tx) => {
    await tx`select set_config('property_os.organization_id', ${organizationId}, true)`;
    const duplicateBindings = await tx`
      select identity_subject
      from organization_members
      where organization_id = ${organizationId}
        and identity_issuer = ${issuer}
        and identity_subject is not null
      group by identity_subject
      having count(*) > 1
    `;
    const unboundAuthorizedMembers = await tx`
      select id
      from organization_members
      where organization_id = ${organizationId}
        and role in ('owner', 'agency-admin', 'manager')
        and status = 'active'
        and (identity_issuer is null or identity_subject is null)
    `;
    const boundMembers = await tx`
      select identity_subject, role, status
      from organization_members
      where organization_id = ${organizationId}
        and identity_issuer = ${issuer}
        and identity_subject in ${tx(expectedSubjects)}
    `;
    const revokedSessions = await tx`
      select count(*)::int as count
      from auth_sessions s
      join auth_accounts a on a.user_id = s.user_id
      join organization_members m
        on m.identity_subject = a.account_id
       and m.identity_issuer = ${issuer}
       and m.organization_id = ${organizationId}
      where m.status = 'revoked'
    `;
    const overlongSessions = await tx`
      select count(*)::int as count
      from auth_sessions
      where expires_at > created_at + interval '1 hour 5 seconds'
    `;
    return { duplicateBindings, unboundAuthorizedMembers, boundMembers, revokedSessions, overlongSessions };
  });

  if (evidence.duplicateBindings.length) throw new Error("Duplicate OIDC subject bindings exist in the organization.");
  if (evidence.unboundAuthorizedMembers.length) throw new Error("An active authorized member is not pre-bound to an immutable OIDC identity.");
  const boundSubjects = new Set(evidence.boundMembers.filter((member) => member.status === "active").map((member) => member.identity_subject));
  const missingSubjects = expectedSubjects.filter((subject) => !boundSubjects.has(subject));
  if (missingSubjects.length) throw new Error(`Expected active OIDC subjects are not bound: ${missingSubjects.join(", ")}`);
  if (evidence.revokedSessions[0]?.count !== 0) throw new Error("A revoked OIDC membership still has an active database session.");
  if (evidence.overlongSessions[0]?.count !== 0) throw new Error("An OIDC session exceeds the fixed one-hour lifetime.");

  console.log(`OIDC database boundary passed for ${organizationId}: ${boundSubjects.size} reviewed member(s), zero revoked sessions.`);
} finally {
  await sql.end({ timeout: 5 });
}
