import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getSystemCategories } from "@/actions/adminCategories";
import { SystemCategoryManager } from "@/components/admin/SystemCategoryManager";
import { ChevronLeft } from "lucide-react";

export default async function AdminCategoriesPage() {
  const session = await auth();
  if (!hasPermission(session, PERMISSIONS.ADMIN)) redirect("/");

  const categories = await getSystemCategories();

  return (
    <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "var(--bg-base)", padding: "32px 24px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <Link
          href="/admin"
          style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-muted)", textDecoration: "none", marginBottom: 24 }}
        >
          <ChevronLeft size={14} />
          Panel admina
        </Link>

        <SystemCategoryManager categories={categories} />
      </div>
    </div>
  );
}
