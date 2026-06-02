export const dynamic = "force-dynamic";

import {
  getStorageItems,
  getLowStock,
  getStorageSettings,
  getSuppliers,
  getExpiringStorage,
} from "@/actions/storage";
import { getLists } from "@/actions/lists";
import { StorageList } from "@/components/magazynowanie/StorageList";

export default async function MagazynowaniePage() {
  const [items, lowStock, lists, settings, suppliers, expiring] = await Promise.all([
    getStorageItems(),
    getLowStock(),
    getLists(),
    getStorageSettings(),
    getSuppliers(),
    getExpiringStorage(30),
  ]);

  return (
    <StorageList
      items={items}
      lowStock={lowStock}
      expiring={expiring}
      shoppingLists={lists.map((l) => ({ id: l.id, name: l.name }))}
      suppliers={suppliers}
      currency={settings.currency}
      pro={settings.mode === "pro"}
    />
  );
}
