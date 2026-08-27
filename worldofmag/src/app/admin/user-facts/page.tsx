export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { prisma } from "@/platform/db/prisma";
import { hasPermission, PERMISSIONS } from "@/platform/auth/permissions";
import { UserFactsPanel } from "@/components/admin/UserFactsPanel";
import { getTranslations } from "next-intl/server";
import { PowrotDoPanelu } from "@/components/admin/PowrotDoPanelu";

// 039: wgląd administratora w wiedzę o użytkowniku — i możliwość jej poprawienia.
export default async function AdminUserFactsPage() {
  const t = await getTranslations("app.admin.user-facts.page");
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.ADMIN)) redirect("/");

  const users = await prisma.user.findMany({
    orderBy: { email: "asc" },
    select: { id: true, email: true, name: true },
  });

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "24px 16px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        {/* 110 (AC-12): powrót do panelu. Ta strona go nie miała — z narzędzia wracało się
            menu bocznym albo przyciskiem wstecz. */}
        <PowrotDoPanelu odstep={20} />
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
          {t("wiedzaOUzytkownikach")}
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
          {t("faktyZKtorychKorzystaja")}
        </p>
        <UserFactsPanel users={users} />
      </div>
    </div>
  );
}
