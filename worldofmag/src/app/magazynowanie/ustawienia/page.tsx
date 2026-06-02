export const dynamic = "force-dynamic";

import { getStorageSettings } from "@/actions/storage";
import { StorageSettingsForm } from "@/components/magazynowanie/StorageSettingsForm";

export default async function StorageSettingsPage() {
  const settings = await getStorageSettings();
  return <StorageSettingsForm mode={settings.mode} currency={settings.currency} />;
}
