export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCategories } from "@/actions/categories";
import { CategoryManager } from "@/components/shopping/CategoryManager";
import { ShoppingCatalogNav } from "@/components/shopping/ShoppingCatalogNav";

export default async function CategoriesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const categories = await getCategories();

  return (
    <div className="flex flex-col flex-1 overflow-y-auto" style={{ backgroundColor: "var(--bg-base)" }}>
      <ShoppingCatalogNav />
      <div style={{ maxWidth: 720, margin: "0 auto", width: "100%", padding: "24px 20px" }}>
        <CategoryManager categories={categories} />
      </div>
    </div>
  );
}
