import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/platform/auth/session";
import { hasPermission, PERMISSIONS } from "@/platform/auth/permissions";
import { FileText, ChevronLeft } from "lucide-react";
import { ADMIN_DOCS, ADMIN_DOCS_GENERATED_AT } from "@/generated/admin-docs";
import { AdminDocsViewer } from "@/components/admin/AdminDocsViewer";
import { getTranslations } from "next-intl/server";

export default async function AdminDocsPage() {
  const t = await getTranslations("app.admin.docs.page");
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.ADMIN)) redirect("/");

  return (
    <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "var(--bg-base)", padding: "32px 24px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>

        <Link href="/admin" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-muted)", textDecoration: "none", marginBottom: 20 }}>
          <ChevronLeft size={14} />
          Admin
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <FileText size={20} style={{ color: "var(--accent-blue)" }} />
          <h1 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
            Dokumentacja projektu
          </h1>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 28, marginTop: 4 }}>
          {t("najnowszaWersjaPlikow")} <code style={{ fontFamily: "monospace" }}>CLAUDE.md</code> oraz{" "}
          <code style={{ fontFamily: "monospace" }}>{t("doswiadczeniaMd")}</code> {t("zKataloguGlownegoRepozytorium")}
        </p>

        <AdminDocsViewer docs={ADMIN_DOCS} generatedAt={ADMIN_DOCS_GENERATED_AT} />
      </div>
    </div>
  );
}
