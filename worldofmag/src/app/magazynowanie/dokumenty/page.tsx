export const dynamic = "force-dynamic";

import { getDocuments, getSuppliers, getStorageSettings } from "@/modules/magazynowanie/actions/storage";
import { DocumentsPage } from "@/modules/magazynowanie/ui/DocumentsPage";

export default async function DokumentyPage() {
  const [documents, suppliers, settings] = await Promise.all([getDocuments(), getSuppliers(), getStorageSettings()]);
  return <DocumentsPage documents={documents} suppliers={suppliers} currency={settings.currency} />;
}
