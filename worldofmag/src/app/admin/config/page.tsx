export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getConfigMasked } from "@/actions/config";
import { AdminConfigForm } from "./AdminConfigForm";
import { ChevronLeft, Cpu, ChevronRight } from "lucide-react";
import Link from "next/link";

export default async function AdminConfigPage() {
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.ADMIN)) redirect("/");

  // A2: do klienta trafia tylko maska + flaga, nigdy surowy klucz.
  const groqKey = await getConfigMasked("groq_api_key");
  const braveKey = await getConfigMasked("brave_search_api_key");

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

        <Link
          href="/admin/llm"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 16px",
            marginBottom: 24,
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: "var(--bg-surface)",
            textDecoration: "none",
          }}
        >
          <Cpu size={18} style={{ color: "var(--accent-purple)", flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, color: "var(--text-primary)" }}>Modele LLM</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Dostawcy i przypisanie modeli do typów operacji (dispatch, myślenie, obrazy, generowanie)
            </div>
          </div>
          <ChevronRight size={16} style={{ color: "var(--text-muted)" }} />
        </Link>

        <AdminConfigForm groqKey={groqKey} braveKey={braveKey} />
      </div>
    </div>
  );
}
