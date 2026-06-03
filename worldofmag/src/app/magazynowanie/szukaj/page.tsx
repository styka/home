export const dynamic = "force-dynamic";

import { getStorageItems } from "@/actions/storage";
import { StorageSearch } from "@/components/magazynowanie/StorageSearch";

export default async function SzukajPage({ searchParams }: { searchParams: { loc?: string } }) {
  const items = await getStorageItems();
  return <StorageSearch items={items} initialLocation={searchParams.loc} />;
}
