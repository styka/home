export const dynamic = "force-dynamic";

import { getStorageAnalytics, getStorageItems } from "@/actions/storage";
import { StorageAnalytics } from "@/components/magazynowanie/StorageAnalytics";

export default async function AnalitykaPage() {
  const [analytics, items] = await Promise.all([getStorageAnalytics(), getStorageItems()]);
  const exportRows = items.map((i) => ({
    name: i.name,
    warehouse: i.warehouse,
    location: i.location,
    quantity: i.quantity ?? 0,
    unit: i.unit,
    unitPrice: i.unitPrice,
  }));
  return <StorageAnalytics analytics={analytics} exportRows={exportRows} />;
}
