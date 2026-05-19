import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { FlaskConical, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { ComponentPlayground } from "@/components/admin/ComponentPlayground";

export default async function PlaygroundPage() {
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.ADMIN)) redirect("/");

  return (
    <div
      style={{
        flex: 1,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--bg-base)",
      }}
    >
      <div
        style={{
          padding: "12px 24px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        <Link href="/admin" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-muted)", textDecoration: "none", marginBottom: 8 }}>
          <ChevronLeft size={14} />
          Admin
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <FlaskConical size={16} style={{ color: "var(--accent-purple)" }} />
        <div>
          <h1 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
            Component Playground
          </h1>
          <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
            Interaktywne demo komponentów UI
          </p>
        </div>
        </div>
      </div>
      <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
        <ComponentPlayground />
      </div>
    </div>
  );
}
