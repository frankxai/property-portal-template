import Link from "next/link";
import { ownerAccessFromCookies, ownerAuthStatus, safePath } from "@/lib/auth";
import { StatusBadge } from "@/components/StatusBadge";
import { OidcSignInButton } from "@/components/OidcSignInButton";
import { OwnerSignOutButton } from "@/components/OwnerSignOutButton";

type PageProps = {
  searchParams?: Promise<{
    next?: string;
    error?: string;
  }>;
};

export default async function OwnerSignInPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const nextPath = safePath(params?.next);
  const status = ownerAuthStatus();
  const access = await ownerAccessFromCookies();

  return (
    <main className="page">
      <div className="shell narrow-shell">
        <section className="work-header">
          <span className="eyebrow">Owner access</span>
          <h1 className="page-title">Protect the owner cockpit before real renter data enters the system.</h1>
          <p className="lede">
            Public property pages stay open. Owner dashboards, runtime snapshots, agent logs, approvals, and listing dry-runs require a revocable owner session.
          </p>
        </section>

        <section className="panel stack">
          <div className="row">
            <h2>Access posture</h2>
            <StatusBadge tone={status.productionSafe ? undefined : "warning"}>{status.mode}</StatusBadge>
          </div>
          <p className="muted">{status.detail}</p>

          {access.ok ? (
            <div className="stack">
              <div className="notice">Owner access is active for this browser session.</div>
              <Link className="button" href={nextPath}>Continue</Link>
              {access.mode === "oidc" ? (
                <OwnerSignOutButton />
              ) : (
                <form method="post" action="/api/auth/owner/sign-out">
                  <button className="button-secondary" type="submit">Sign out</button>
                </form>
              )}
            </div>
          ) : status.mode === "static-private-pilot" ? (
            <form className="stack" method="post" action="/api/auth/owner/sign-in">
              <input type="hidden" name="next" value={nextPath} />
              <label className="stack">
                <span className="label">Owner passcode</span>
                <input name="passcode" type="password" autoComplete="current-password" required />
              </label>
              {params?.error ? <p className="error-text">Access was not approved. Check the passcode and try again.</p> : null}
              <button className="button" type="submit">Open owner cockpit</button>
            </form>
          ) : status.mode === "oidc" && status.providerId ? (
            <div className="stack">
              <p className="muted">Your identity provider confirms organization membership and operating role before the cockpit opens.</p>
              {params?.error ? <p className="error-text">Secure sign-in was not approved. Contact the property administrator if access should be active.</p> : null}
              <OidcSignInButton providerId={status.providerId} nextPath={nextPath} />
            </div>
          ) : (
            <div className="stack">
              <div className="notice">
                Configure owner auth before using the admin or owner cockpit in production.
              </div>
              <div>
                <span className="label">Missing environment</span>
                <ul>
                  {status.missingEnv.map((item) => <li key={item}>{item}</li>)}
                  {status.invalidEnv.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
              {status.requiredEnv.includes("OWNER_PORTAL_PASSCODE_HASH") ? (
                <code className="code-block">npm run auth:hash -- "replace-with-a-private-passcode"</code>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
