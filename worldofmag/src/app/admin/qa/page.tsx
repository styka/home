import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, FlaskConical } from "lucide-react";
import { auth } from "@/platform/auth/session";
import { hasPermission, PERMISSIONS } from "@/platform/auth/permissions";
import { getEpicTreeForAdmin } from "@/modules/qa/contract";
import { QaAdminTree } from "@/components/admin/qa/QaAdminTree";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function QaAdminPage() {
  const t = await getTranslations("app.admin.qa.page");
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.ADMIN)) redirect("/");

  const epics = await getEpicTreeForAdmin();

  return (
    <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "var(--bg-base)", padding: "32px 24px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <Link
          href="/admin"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 12,
            color: "var(--text-muted)",
            textDecoration: "none",
            marginBottom: 20,
          }}
        >
          <ChevronLeft size={14} />
          Admin
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <FlaskConical size={20} style={{ color: "var(--accent-red)" }} />
          <h1 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
            {t("qaZarzadzanieScenariuszami")}
          </h1>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 24px" }}>
          Hierarchia: <strong>{t("modulEpicUserStory")}</strong>{t("kazdyPoziomEdytujeszOsobno")}
        </p>

        <QaAdminTree epics={epics} />
      </div>
    </div>
  );
}
