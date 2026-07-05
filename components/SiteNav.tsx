import Link from "next/link";

export function SiteNav() {
  return (
    <header className="nav">
      <Link className="brand" href="/">
        <strong>Property Intelligence OS</strong>
        <span>Owner workspace and renter portal</span>
      </Link>
      <nav className="nav-links" aria-label="Primary navigation">
        <Link href="/properties/urban-haven-sample">Property</Link>
        <Link href="/stay/sample-stay">Renter portal</Link>
        <Link href="/support">Support</Link>
        <Link href="/owner">Owner</Link>
        <Link href="/admin/setup">Setup</Link>
        <Link href="/admin/implementation">Implementation</Link>
        <Link href="/admin/listings">Listings</Link>
        <Link href="/admin/integrations">Integrations</Link>
        <Link href="/admin/agent-runs">Agents</Link>
        <Link href="/admin/ops">Ops</Link>
      </nav>
    </header>
  );
}
