export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Package } from "lucide-react";
import { getProducts } from "@/actions/products";
import { getUnits } from "@/actions/units";
import { ProductManager } from "@/components/shopping/ProductManager";
import { UnitManager } from "@/components/shopping/UnitManager";
import { ProductsPageTabs } from "@/components/shopping/ProductsPageTabs";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const { tab } = await searchParams;
  const activeTab = tab === "units" ? "units" : "products";

  const [products, units] = await Promise.all([
    getProducts(),
    getUnits(),
  ]);

  return (
    <div
      className="flex-1 overflow-y-auto"
      style={{ backgroundColor: "var(--bg-base)", padding: "24px 20px" }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div className="flex items-center gap-3 mb-5">
          <Package size={20} style={{ color: "var(--accent-blue)" }} />
          <h1 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
            Katalog
          </h1>
        </div>

        <ProductsPageTabs activeTab={activeTab} />

        <div className="mt-6">
          {activeTab === "products" ? (
            <ProductManager products={products} userId={session.user.id} />
          ) : (
            <UnitManager units={units} />
          )}
        </div>
      </div>
    </div>
  );
}
