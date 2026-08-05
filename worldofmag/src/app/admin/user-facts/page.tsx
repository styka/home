export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { prisma } from "@/platform/db/prisma";
import { hasPermission, PERMISSIONS } from "@/platform/auth/permissions";
import { UserFactsPanel } from "@/components/admin/UserFactsPanel";

// 039: wgląd administratora w wiedzę o użytkowniku — i możliwość jej poprawienia.
export default async function AdminUserFactsPage() {
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.ADMIN)) redirect("/");

  const users = await prisma.user.findMany({
    orderBy: { email: "asc" },
    select: { id: true, email: true, name: true },
  });

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "24px 16px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
          Wiedza o użytkownikach
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
          Fakty, z których korzystają moduły generujące treść „pod użytkownika”. Fakt zapisany tutaj
          ma pochodzenie „administrator” i nie jest nadpisywany automatycznym wnioskowaniem.
        </p>
        <UserFactsPanel users={users} />
      </div>
    </div>
  );
}
