export const dynamic = "force-dynamic";

import { getPurchaseOrders, getSuppliers, getLowStock } from "@/actions/storage";
import { PurchaseOrders } from "@/components/magazynowanie/PurchaseOrders";

export default async function ZamowieniaPage() {
  const [orders, suppliers, low] = await Promise.all([getPurchaseOrders(), getSuppliers(), getLowStock()]);
  const lowStock = low.map((i) => ({
    name: i.name,
    deficit: i.minQuantity != null ? Math.max(i.minQuantity - (i.quantity ?? 0), i.minQuantity) : 1,
    unit: i.unit,
  }));
  return <PurchaseOrders orders={orders} suppliers={suppliers} lowStock={lowStock} />;
}
