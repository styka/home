export const dynamic = "force-dynamic";

import { getWarsztatSettings } from "@/modules/warsztaty/actions/warsztat";
import { WarsztatSettingsForm } from "@/modules/warsztaty/ui/WarsztatSettingsForm";

export default async function WarsztatUstawieniaPage() {
  const { mode } = await getWarsztatSettings();
  return <WarsztatSettingsForm mode={mode} />;
}
