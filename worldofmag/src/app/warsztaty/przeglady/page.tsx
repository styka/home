export const dynamic = "force-dynamic";

import { getMaintenanceOverview } from "@/modules/warsztaty/actions/warsztat";
import { MaintenanceAgenda } from "@/modules/warsztaty/ui/MaintenanceAgenda";

export default async function WarsztatPrzegladyPage() {
  const overview = await getMaintenanceOverview();
  return <MaintenanceAgenda overview={overview} />;
}
