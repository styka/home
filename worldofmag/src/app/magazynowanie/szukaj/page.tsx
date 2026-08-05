export const dynamic = "force-dynamic";

import { getStorageItems } from "@/modules/magazynowanie/actions/storage";
import { StorageSearch } from "@/modules/magazynowanie/ui/StorageSearch";

export default async function SzukajPage({ searchParams }: { searchParams: { loc?: string } }) {
  const items = await getStorageItems();
  return <StorageSearch items={items} initialLocation={searchParams.loc} />;
}
