export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getAllUserIconVariants } from "@/actions/categoryIcons";
import { getCategoryNames } from "@/actions/categories";
import { CategoryIconsManager } from "@/components/shopping/CategoryIconsManager";
import { ChevronLeft } from "lucide-react";

export default async function IconCategoriesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const [variants, allCategories] = await Promise.all([
    getAllUserIconVariants(),
    getCategoryNames(),
  ]);

  return (
    <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "var(--bg-base)" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", width: "100%", padding: "24px 20px" }}>
        <Link
          href="/shopping/icons"
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
          Biblioteka ikon
        </Link>
        <CategoryIconsManager variants={variants} allCategories={allCategories} />
      </div>
    </div>
  );
}
