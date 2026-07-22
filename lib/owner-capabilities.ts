import type { OwnerRole } from "./identity-policy.ts";

export const ownerCapabilities = [
  "operations:read",
  "operations:write",
  "approvals:decide",
  "identity:revoke"
] as const;

export type OwnerCapability = (typeof ownerCapabilities)[number];

const capabilitiesByRole: Record<OwnerRole | "operator", ReadonlySet<OwnerCapability>> = {
  owner: new Set(ownerCapabilities),
  "agency-admin": new Set(ownerCapabilities),
  manager: new Set(["operations:read", "operations:write"]),
  operator: new Set(["operations:read", "operations:write"])
};

export function ownerRoleHasCapability(role: OwnerRole | "operator", capability: OwnerCapability) {
  return capabilitiesByRole[role].has(capability);
}
