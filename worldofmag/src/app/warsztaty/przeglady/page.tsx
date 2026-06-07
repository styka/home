export const dynamic = "force-dynamic";

import { getMaintenanceOverview } from "@/actions/warsztat";
import { MaintenanceAgenda } from "@/components/warsztaty/MaintenanceAgenda";

export default async function WarsztatPrzegladyPage() {
  const overview = await getMaintenanceOverview();
  return <MaintenanceAgenda overview={overview} />;
}
