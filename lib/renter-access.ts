import { createHash, randomBytes, randomUUID } from "node:crypto";
import postgres from "postgres";

const accessCodePattern = /^[A-Za-z0-9_-]{43}$/;
const stableIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;
const minimumGrantLifetimeMs = 5 * 60_000;
const maximumGrantLifetimeMs = 180 * 24 * 60 * 60_000;
const attemptWindowMs = 15 * 60_000;
const attemptsPerWindow = 30;

export type RenterAccessSection = {
  id: string;
  title: string;
  answer: string;
};

export type RenterStayAccess = {
  grantId: string;
  propertyName: string;
  rentalLabel: string | null;
  expiresAt: string | null;
  sections: RenterAccessSection[];
  demo: boolean;
};

export type RenterAccessGrantRecord = {
  id: string;
  organizationId: string;
  propertyId: string;
  unitId: string | null;
  rentalLabel: string | null;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
};

export type RenterAccessLookupRecord = RenterAccessGrantRecord & {
  propertyName: string;
  resolvedPropertyId: string;
  resolvedUnitPropertyId: string | null;
  sections: RenterAccessSection[];
};

export type PersistedRenterAccessGrant = {
  id: string;
  organizationId: string;
  propertyId: string;
  unitId: string | null;
  rentalLabel: string | null;
  codeHash: string;
  expiresAt: string;
  createdBy: string;
  actorRole: string;
  createdAt: string;
};

export type RenterAccessDatabase = {
  createGrant(input: PersistedRenterAccessGrant): Promise<RenterAccessGrantRecord>;
  revokeGrant(input: {
    id: string;
    organizationId: string;
    revokedBy: string;
    actorRole: string;
    revokedAt: string;
  }): Promise<boolean>;
  resolveGrant(input: {
    organizationId: string;
    codeHash: string;
    now: string;
  }): Promise<RenterAccessLookupRecord | null>;
};

type RenterAccessOptions = {
  database?: RenterAccessDatabase;
  env?: NodeJS.ProcessEnv;
  now?: Date;
};

type CreateRenterAccessOptions = RenterAccessOptions & {
  codeFactory?: () => string;
};

type AttemptState = { count: number; resetAt: number };

declare global {
  var __propertyPortalRenterAccessAttempts: Map<string, AttemptState> | undefined;
}

const accessAttempts = globalThis.__propertyPortalRenterAccessAttempts ??= new Map<string, AttemptState>();
let sqlClient: postgres.Sql | undefined;
let sqlClientUrl = "";

export class RenterAccessError extends Error {
  readonly code: "invalid-input" | "not-found" | "database-unavailable";

  constructor(code: "invalid-input" | "not-found" | "database-unavailable") {
    super(code);
    this.name = "RenterAccessError";
    this.code = code;
  }
}

function iso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function configuredOrganizationId(env: NodeJS.ProcessEnv) {
  const id = env.PROPERTY_OS_ORG_ID?.trim() || "";
  return stableIdPattern.test(id) ? id : null;
}

function cleanOptionalId(value: string | null | undefined) {
  const clean = value?.trim() || "";
  if (!clean) return null;
  if (!stableIdPattern.test(clean)) throw new RenterAccessError("invalid-input");
  return clean;
}

function cleanRentalLabel(value: string | null | undefined) {
  const clean = value?.trim().replace(/\s+/g, " ") || "";
  if (!clean) return null;
  if (clean.length > 160) throw new RenterAccessError("invalid-input");
  return clean;
}

function postgresDatabase(databaseUrl: string): RenterAccessDatabase {
  if (!sqlClient || sqlClientUrl !== databaseUrl) {
    sqlClient = postgres(databaseUrl, { max: 2, idle_timeout: 20, connect_timeout: 10 });
    sqlClientUrl = databaseUrl;
  }
  const sql = sqlClient;

  return {
    async createGrant(input) {
      return sql.begin(async (tx) => {
        await tx`select set_config('property_os.organization_id', ${input.organizationId}, true)`;
        const properties = await tx<{ id: string }[]>`
          select id from properties
          where id = ${input.propertyId} and organization_id = ${input.organizationId}
          limit 1
        `;
        if (!properties[0]) throw new RenterAccessError("not-found");

        if (input.unitId) {
          const units = await tx<{ id: string }[]>`
            select id from units
            where id = ${input.unitId} and property_id = ${input.propertyId}
            limit 1
          `;
          if (!units[0]) throw new RenterAccessError("not-found");
        }

        const rows = await tx<Record<string, unknown>[]>`
          insert into renter_access_grants (
            id, organization_id, property_id, unit_id, rental_label, code_hash,
            expires_at, created_by, created_at, updated_at
          ) values (
            ${input.id}, ${input.organizationId}, ${input.propertyId}, ${input.unitId},
            ${input.rentalLabel}, ${input.codeHash}, ${input.expiresAt}, ${input.createdBy},
            ${input.createdAt}, ${input.createdAt}
          )
          returning id, organization_id, property_id, unit_id, rental_label,
            expires_at, revoked_at, created_at
        `;
        await tx`
          insert into audit_events (
            id, organization_id, actor, event_type, subject_type, subject_id, metadata, created_at
          ) values (
            ${`audit-${randomUUID()}`}, ${input.organizationId}, ${input.createdBy},
            'renter_access.created', 'renter_access_grant', ${input.id},
            ${tx.json({
              propertyId: input.propertyId,
              unitId: input.unitId,
              rentalLabel: input.rentalLabel,
              expiresAt: input.expiresAt,
              actorRole: input.actorRole
            })}, ${input.createdAt}
          )
        `;
        const row = rows[0];
        return {
          id: String(row.id),
          organizationId: String(row.organization_id),
          propertyId: String(row.property_id),
          unitId: row.unit_id ? String(row.unit_id) : null,
          rentalLabel: row.rental_label ? String(row.rental_label) : null,
          expiresAt: iso(row.expires_at as Date | string),
          revokedAt: row.revoked_at ? iso(row.revoked_at as Date | string) : null,
          createdAt: iso(row.created_at as Date | string)
        };
      }) as Promise<RenterAccessGrantRecord>;
    },

    async revokeGrant(input) {
      return sql.begin(async (tx) => {
        await tx`select set_config('property_os.organization_id', ${input.organizationId}, true)`;
        const rows = await tx<{ id: string }[]>`
          update renter_access_grants
          set revoked_at = ${input.revokedAt}, revoked_by = ${input.revokedBy}, updated_at = ${input.revokedAt}
          where id = ${input.id}
            and organization_id = ${input.organizationId}
            and revoked_at is null
          returning id
        `;
        if (!rows[0]) return false;
        await tx`
          insert into audit_events (
            id, organization_id, actor, event_type, subject_type, subject_id, metadata, created_at
          ) values (
            ${`audit-${randomUUID()}`}, ${input.organizationId}, ${input.revokedBy},
            'renter_access.revoked', 'renter_access_grant', ${input.id},
            ${tx.json({ actorRole: input.actorRole })}, ${input.revokedAt}
          )
        `;
        return true;
      }) as Promise<boolean>;
    },

    async resolveGrant(input) {
      return sql.begin(async (tx) => {
        await tx`select set_config('property_os.organization_id', ${input.organizationId}, true)`;
        const rows = await tx<Record<string, unknown>[]>`
          select
            grant_row.id,
            grant_row.organization_id,
            grant_row.property_id,
            grant_row.unit_id,
            grant_row.rental_label,
            grant_row.expires_at,
            grant_row.revoked_at,
            grant_row.created_at,
            property_row.id as resolved_property_id,
            property_row.name as property_name,
            unit_row.property_id as resolved_unit_property_id
          from renter_access_grants grant_row
          join properties property_row
            on property_row.id = grant_row.property_id
           and property_row.organization_id = grant_row.organization_id
          left join units unit_row
            on unit_row.id = grant_row.unit_id
           and unit_row.property_id = grant_row.property_id
          where grant_row.organization_id = ${input.organizationId}
            and grant_row.code_hash = ${input.codeHash}
            and grant_row.revoked_at is null
            and grant_row.expires_at > ${input.now}
          limit 1
          for share of grant_row
        `;
        const row = rows[0];
        if (!row) return null;

        const articleRows = await tx<{ id: string; title: string; body: string }[]>`
          select id, title, body
          from knowledge_articles
          where property_id = ${String(row.property_id)}
            and audience = 'renter'
            and status in ('approved', 'published')
            and contains_private_data = false
          order by created_at asc, id asc
        `;
        await tx`
          insert into audit_events (
            id, organization_id, actor, event_type, subject_type, subject_id, metadata, created_at
          ) values (
            ${`audit-${randomUUID()}`}, ${input.organizationId}, 'renter-access',
            'renter_access.accessed', 'renter_access_grant', ${String(row.id)}, '{}'::jsonb, ${input.now}
          )
        `;

        return {
          id: String(row.id),
          organizationId: String(row.organization_id),
          propertyId: String(row.property_id),
          unitId: row.unit_id ? String(row.unit_id) : null,
          rentalLabel: row.rental_label ? String(row.rental_label) : null,
          expiresAt: iso(row.expires_at as Date | string),
          revokedAt: row.revoked_at ? iso(row.revoked_at as Date | string) : null,
          createdAt: iso(row.created_at as Date | string),
          propertyName: String(row.property_name),
          resolvedPropertyId: String(row.resolved_property_id),
          resolvedUnitPropertyId: row.resolved_unit_property_id ? String(row.resolved_unit_property_id) : null,
          sections: articleRows.map((article) => ({
            id: article.id,
            title: article.title,
            answer: article.body
          }))
        };
      }) as Promise<RenterAccessLookupRecord | null>;
    }
  };
}

function databaseFromOptions(options: RenterAccessOptions) {
  if (options.database) return options.database;
  const databaseUrl = options.env ? options.env.DATABASE_URL : process.env.DATABASE_URL;
  return databaseUrl ? postgresDatabase(databaseUrl) : null;
}

export function generateRenterAccessCode() {
  return randomBytes(32).toString("base64url");
}

export function validRenterAccessCode(code: string) {
  return accessCodePattern.test(code);
}

export function hashRenterAccessCode(code: string) {
  if (!validRenterAccessCode(code)) throw new RenterAccessError("invalid-input");
  return createHash("sha256").update(code, "utf8").digest("hex");
}

export function demoRenterAccessAllowed(env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV === "production" || env.PROPERTY_OS_DEMO_RUNTIME !== "true") return false;
  try {
    const hostname = new URL(env.APP_BASE_URL || "").hostname;
    return ["127.0.0.1", "localhost", "::1"].includes(hostname);
  } catch {
    return false;
  }
}

export function consumeRenterAccessAttempt(identifier: string, now = Date.now()) {
  if (accessAttempts.size > 5_000) {
    for (const [key, value] of accessAttempts) {
      if (value.resetAt <= now) accessAttempts.delete(key);
    }
  }
  const key = createHash("sha256").update(`renter-access:${identifier || "unknown"}`).digest("hex");
  const current = accessAttempts.get(key);
  if (!current || current.resetAt <= now) {
    accessAttempts.set(key, { count: 1, resetAt: now + attemptWindowMs });
    return true;
  }
  current.count += 1;
  return current.count <= attemptsPerWindow;
}

export function renterAccessGrantIsUsable(
  grant: RenterAccessLookupRecord,
  organizationId: string,
  now = new Date()
) {
  if (grant.organizationId !== organizationId) return false;
  if (grant.propertyId !== grant.resolvedPropertyId) return false;
  if (grant.unitId && grant.resolvedUnitPropertyId !== grant.propertyId) return false;
  if (grant.revokedAt) return false;
  return new Date(grant.expiresAt).getTime() > now.getTime();
}

export async function createRenterAccessGrant(
  input: {
    propertyId: string;
    unitId?: string | null;
    rentalLabel?: string | null;
    expiresAt: string | Date;
    actorId: string;
    actorRole: string;
  },
  options: CreateRenterAccessOptions = {}
) {
  const env = options.env ?? process.env;
  const organizationId = configuredOrganizationId(env);
  const database = databaseFromOptions(options);
  if (!organizationId || !database) throw new RenterAccessError("database-unavailable");

  const now = options.now ?? new Date();
  const propertyId = cleanOptionalId(input.propertyId);
  const unitId = cleanOptionalId(input.unitId);
  const rentalLabel = cleanRentalLabel(input.rentalLabel);
  const actorId = input.actorId.trim();
  const actorRole = input.actorRole.trim();
  const expiresAt = new Date(input.expiresAt);
  const lifetime = expiresAt.getTime() - now.getTime();
  if (!propertyId || !actorId || !actorRole || !Number.isFinite(expiresAt.getTime())) {
    throw new RenterAccessError("invalid-input");
  }
  if (lifetime < minimumGrantLifetimeMs || lifetime > maximumGrantLifetimeMs) {
    throw new RenterAccessError("invalid-input");
  }

  const accessCode = (options.codeFactory ?? generateRenterAccessCode)();
  const codeHash = hashRenterAccessCode(accessCode);
  try {
    const grant = await database.createGrant({
      id: `renter-${randomUUID()}`,
      organizationId,
      propertyId,
      unitId,
      rentalLabel,
      codeHash,
      expiresAt: expiresAt.toISOString(),
      createdBy: actorId,
      actorRole,
      createdAt: now.toISOString()
    });
    return { grant, accessCode };
  } catch (error) {
    if (error instanceof RenterAccessError) throw error;
    console.error("Renter access grant creation unavailable", { code: "RENTER_ACCESS_DATABASE_UNAVAILABLE" });
    throw new RenterAccessError("database-unavailable");
  }
}

export async function revokeRenterAccessGrant(
  input: { id: string; actorId: string; actorRole: string },
  options: RenterAccessOptions = {}
) {
  const env = options.env ?? process.env;
  const organizationId = configuredOrganizationId(env);
  const database = databaseFromOptions(options);
  const id = cleanOptionalId(input.id);
  if (!id) throw new RenterAccessError("invalid-input");
  if (!organizationId || !database) throw new RenterAccessError("database-unavailable");
  try {
    return await database.revokeGrant({
      id,
      organizationId,
      revokedBy: input.actorId,
      actorRole: input.actorRole,
      revokedAt: (options.now ?? new Date()).toISOString()
    });
  } catch (error) {
    if (error instanceof RenterAccessError) throw error;
    console.error("Renter access revocation unavailable", { code: "RENTER_ACCESS_DATABASE_UNAVAILABLE" });
    throw new RenterAccessError("database-unavailable");
  }
}

async function demoStay(accessCode: string): Promise<RenterStayAccess | null> {
  const { getProperty, getStaySession } = await import("../data/properties.ts");
  const session = getStaySession(accessCode);
  const property = session ? getProperty(session.propertySlug) : null;
  if (!session || !property) return null;
  return {
    grantId: "local-demo-only",
    propertyName: property.name,
    rentalLabel: session.label,
    expiresAt: null,
    sections: session.sections.map((section) => ({
      id: section.id,
      title: section.title,
      answer: section.answer
    })),
    demo: true
  };
}

export async function resolveRenterStay(
  accessCode: string,
  options: RenterAccessOptions & { requestIdentifier?: string } = {}
): Promise<RenterStayAccess | null> {
  const env = options.env ?? process.env;
  if (!consumeRenterAccessAttempt(options.requestIdentifier || "unknown", options.now?.getTime())) return null;
  if (accessCode === "sample-stay" && demoRenterAccessAllowed(env)) return demoStay(accessCode);
  if (!validRenterAccessCode(accessCode)) return null;

  const organizationId = configuredOrganizationId(env);
  const database = databaseFromOptions(options);
  if (!organizationId || !database) return null;
  try {
    const grant = await database.resolveGrant({
      organizationId,
      codeHash: hashRenterAccessCode(accessCode),
      now: (options.now ?? new Date()).toISOString()
    });
    if (!grant || !renterAccessGrantIsUsable(grant, organizationId, options.now)) return null;
    return {
      grantId: grant.id,
      propertyName: grant.propertyName,
      rentalLabel: grant.rentalLabel,
      expiresAt: grant.expiresAt,
      sections: grant.sections,
      demo: false
    };
  } catch {
    console.error("Renter access lookup unavailable", { code: "RENTER_ACCESS_DATABASE_UNAVAILABLE" });
    return null;
  }
}
