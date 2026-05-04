export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Package } from "lucide-react";
import { getProducts } from "@/actions/products";
import { ProductManager } from "@/components/shopping/ProductManager";

export default async function ProductsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const products = await getProducts();

  return (
    <div
      className="flex-1 overflow-y-auto"
      style={{ backgroundColor: "var(--bg-base)", padding: "24px 20px" }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div className="flex items-center gap-3 mb-6">
          <Package size={20} style={{ color: "var(--accent-blue)" }} />
          <h1 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
            Katalog produktów
          </h1>
        </div>
        <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
          Zarządzaj swoimi produktami. Domyślna jednostka jest podpowiadana przy dodawaniu do listy zakupów.
        </p>

        <ProductManager products={products} userId={session.user.id} />
      </div>
    </div>
  );
}
