export const dynamic = "force-dynamic";

import { getSuppliers } from "@/actions/storage";
import { SuppliersPage } from "@/components/magazynowanie/SuppliersPage";

export default async function DostawcyPage() {
  const suppliers = await getSuppliers();
  return <SuppliersPage suppliers={suppliers} />;
}
