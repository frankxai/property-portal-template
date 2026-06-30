export function StatusBadge({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "warning" }) {
  return <span className={tone === "warning" ? "status status-warning" : "status"}>{children}</span>;
}

