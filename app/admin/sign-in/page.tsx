import Link from "next/link";
import { ownerAccessFromCookies, ownerAuthStatus } from "@/lib/auth";
import { StatusBadge } from "@/components/StatusBadge";

type PageProps = {
  searchParams?: Promise<{
    next?: string;
    error?: string;
  }>;
};

export default async function OwnerSignInPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const nextPath = params?.next || "/owner";
  const status = ownerAuthStatus();
  const access = await ownerAccessFromCookies();

  return (
    <main className="page">
      <div className="shell narrow-shell">
        <section className="work-header">
          <span className="eyebrow">Owner access</span>
          <h1 className="page-title">Protect the owner cockpit before real renter data enters the system.</h1>
          <p className="lede">
            Public property pages stay open. Owner dashboards, runtime snapshots, agent logs, approvals, and listing dry-runs require an owner session or approved automation token.
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
              <form method="post" action="/api/auth/owner/sign-out">
                <button className="button-secondary" type="submit">Sign out</button>
              </form>
            </div>
          ) : status.mode === "passcode" ? (
            <form className="stack" method="post" action="/api/auth/owner/sign-in">
              <input type="hidden" name="next" value={nextPath} />
              <label className="stack">
                <span className="label">Owner passcode</span>
                <input name="passcode" type="password" autoComplete="current-password" required />
              </label>
              {params?.error ? <p className="error-text">Access was not approved. Check the passcode and try again.</p> : null}
              <button className="button" type="submit">Open owner cockpit</button>
            </form>
          ) : (
            <div className="stack">
              <div className="notice">
                Configure owner auth before using the admin or owner cockpit in production.
              </div>
              <div>
                <span className="label">Missing environment</span>
                <ul>
                  {status.missingEnv.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
              <code className="code-block">npm run auth:hash -- "replace-with-a-private-passcode"</code>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
