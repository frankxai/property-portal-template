import type { OwnerRole } from "./identity-policy.ts";

export const ownerCapabilities = [
  "operations:read",
  "operations:write",
  "approvals:decide",
  "identity:revoke",
  "renter-access:create",
  "renter-access:revoke",
  "owner-inbox:read",
  "owner-inbox:write",
  "owner-inbox:close"
] as const;

export type OwnerCapability = (typeof ownerCapabilities)[number];

type CapabilityRole = OwnerRole | "operator" | "viewer";

const capabilitiesByRole: Record<CapabilityRole, ReadonlySet<OwnerCapability>> = {
  owner: new Set(ownerCapabilities),
  "agency-admin": new Set(ownerCapabilities),
  manager: new Set([
    "operations:read",
    "operations:write",
    "renter-access:create",
    "owner-inbox:read",
    "owner-inbox:write"
  ]),
  operator: new Set(["operations:read", "operations:write"]),
  viewer: new Set()
};

export function ownerRoleHasCapability(role: CapabilityRole, capability: OwnerCapability) {
  return capabilitiesByRole[role].has(capability);
}
