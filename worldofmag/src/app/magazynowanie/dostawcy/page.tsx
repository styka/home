export const dynamic = "force-dynamic";

import { getSuppliers } from "@/modules/magazynowanie/actions/storage";
import { SuppliersPage } from "@/modules/magazynowanie/ui/SuppliersPage";

export default async function DostawcyPage() {
  const suppliers = await getSuppliers();
  return <SuppliersPage suppliers={suppliers} />;
}
