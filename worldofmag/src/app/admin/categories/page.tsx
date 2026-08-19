import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/platform/auth/session";
import { hasPermission, PERMISSIONS } from "@/platform/auth/permissions";
import { getSystemCategories } from "@/actions/adminCategories";
import { SystemCategoryManager } from "@/components/admin/SystemCategoryManager";
import { ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function AdminCategoriesPage() {
  const t = await getTranslations("app.admin.categories.page");
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
