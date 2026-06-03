export const dynamic = "force-dynamic";

import { getDocuments, getSuppliers, getStorageSettings } from "@/actions/storage";
import { DocumentsPage } from "@/components/magazynowanie/DocumentsPage";

export default async function DokumentyPage() {
  const [documents, suppliers, settings] = await Promise.all([getDocuments(), getSuppliers(), getStorageSettings()]);
  return <DocumentsPage documents={documents} suppliers={suppliers} currency={settings.currency} />;
}
