export const dynamic = "force-dynamic";

import { getWarsztatSettings } from "@/actions/warsztat";
import { WarsztatSettingsForm } from "@/components/warsztaty/WarsztatSettingsForm";

export default async function WarsztatUstawieniaPage() {
  const { mode } = await getWarsztatSettings();
  return <WarsztatSettingsForm mode={mode} />;
}
