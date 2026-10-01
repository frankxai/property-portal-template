import type { Metadata } from "next";
import "./globals.css";
import { SiteNav } from "@/components/SiteNav";

export const metadata: Metadata = {
  title: "Property Intelligence · Owner Workspace",
  description: "Portfolioanalyse, Finanzierungsszenarien, Belegprüfung und ChatGPT-Werkzeuge für Immobilienentscheidungen."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <SiteNav />
        {children}
      </body>
    </html>
  );
}
