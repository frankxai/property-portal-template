export const ownerRoles = ["owner", "agency-admin", "manager"] as const;

export type OwnerRole = (typeof ownerRoles)[number];

export type OidcIdentityPolicy = {
  organizationId: string;
  organizationClaim: string;
  roleClaim: string;
};

export type ApprovedOidcIdentity = {
  subject: string;
  email: string;
  name: string;
  role: OwnerRole;
};

export type OidcIdentityDecision =
  | { ok: true; identity: ApprovedOidcIdentity }
  | {
      ok: false;
      reason:
        | "missing-subject"
        | "missing-email"
        | "unverified-email"
        | "wrong-organization"
        | "ambiguous-organization"
        | "unauthorized-role"
        | "ambiguous-role";
    };

function claimValues(value: unknown) {
  if (typeof value === "string" && value.trim()) return [value.trim()];
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim());
  }
  return [];
}

export function evaluateOidcIdentity(
  profile: Record<string, unknown>,
  policy: OidcIdentityPolicy
): OidcIdentityDecision {
  const subject = typeof profile.sub === "string" ? profile.sub.trim() : "";
  if (!subject) return { ok: false, reason: "missing-subject" };

  const email = typeof profile.email === "string" ? profile.email.trim().toLowerCase() : "";
  if (!email) return { ok: false, reason: "missing-email" };
  if (profile.email_verified !== true) return { ok: false, reason: "unverified-email" };

  const organizations = claimValues(profile[policy.organizationClaim]);
  if (organizations.length > 1) return { ok: false, reason: "ambiguous-organization" };
  if (organizations[0] !== policy.organizationId) {
    return { ok: false, reason: "wrong-organization" };
  }

  const roles = [...new Set(claimValues(profile[policy.roleClaim]))];
  if (roles.length > 1) return { ok: false, reason: "ambiguous-role" };
  const role = roles[0];
  if (!ownerRoles.includes(role as OwnerRole)) return { ok: false, reason: "unauthorized-role" };

  const name = typeof profile.name === "string" && profile.name.trim() ? profile.name.trim() : email;
  return { ok: true, identity: { subject, email, name, role: role as OwnerRole } };
}
