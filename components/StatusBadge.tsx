export function StatusBadge({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "warning" | "danger" }) {
  const className = tone === "danger" ? "status status-danger" : tone === "warning" ? "status status-warning" : "status";
  return <span className={className}>{children}</span>;
}
