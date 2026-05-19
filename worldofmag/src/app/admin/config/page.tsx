export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getConfigValue } from "@/actions/config";
import { AdminConfigForm } from "./AdminConfigForm";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export default async function AdminConfigPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/");

  const groqKey = await getConfigValue("groq_api_key");

  return (
    <div
      className="flex-1 overflow-y-auto"
      style={{ backgroundColor: "var(--bg-base)", padding: "32px 24px" }}
    >
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <Link href="/admin" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-muted)", textDecoration: "none", marginBottom: 20 }}>
          <ChevronLeft size={14} />
          Admin
        </Link>
        <div className="flex items-center gap-3 mb-6">
          <span style={{ fontSize: 20 }}>⚙️</span>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
            Konfiguracja systemu
          </h1>
        </div>

        <AdminConfigForm groqKey={groqKey} />
      </div>
    </div>
  );
}
