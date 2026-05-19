export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCategories } from "@/actions/categories";
import { getActiveCategoryIconMap } from "@/actions/categoryIcons";
import { CategoryManager } from "@/components/shopping/CategoryManager";
import { ChevronLeft } from "lucide-react";

export default async function CategoriesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const [categories, activeIconMap] = await Promise.all([
    getCategories(),
    getActiveCategoryIconMap(),
  ]);

  return (
    <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "var(--bg-base)" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", width: "100%", padding: "24px 20px" }}>
        <Link
          href="/shopping"
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
          Zakupy
        </Link>
        <CategoryManager categories={categories} activeIconMap={activeIconMap} />
      </div>
    </div>
  );
}
