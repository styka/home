import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { listAvailableSkins } from "@/actions/skins";
import { SystemSkinManager } from "@/components/admin/SystemSkinManager";
import { ChevronLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminSkinsPage() {
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.ADMIN)) redirect("/");

  const skins = (await listAvailableSkins()).filter((s) => s.isSystem);

  return (
    <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "var(--bg-base)", padding: "32px 24px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <Link
          href="/admin"
          style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-muted)", textDecoration: "none", marginBottom: 24 }}
        >
          <ChevronLeft size={14} />
          Panel admina
        </Link>

        <SystemSkinManager skins={skins} />
      </div>
    </div>
  );
}
