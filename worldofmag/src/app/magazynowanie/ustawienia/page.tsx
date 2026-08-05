export const dynamic = "force-dynamic";

import { getStorageSettings } from "@/modules/magazynowanie/actions/storage";
import { StorageSettingsForm } from "@/modules/magazynowanie/ui/StorageSettingsForm";

export default async function StorageSettingsPage() {
  const settings = await getStorageSettings();
  return <StorageSettingsForm mode={settings.mode} currency={settings.currency} />;
}
