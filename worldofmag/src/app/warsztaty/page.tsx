export const dynamic = "force-dynamic";

import { getWorkshops, getWarsztatSettings } from "@/modules/warsztaty/actions/warsztat";
import { getMyTeams } from "@/actions/teams";
import { WorkshopsList } from "@/modules/warsztaty/ui/WorkshopsList";

export default async function WarsztatyPage() {
  const [workshops, { mode }, teams] = await Promise.all([
    getWorkshops(),
    getWarsztatSettings(),
    getMyTeams(),
  ]);

  return (
    <WorkshopsList
      workshops={workshops}
      mode={mode}
      teams={teams.map((t) => ({ id: t.id, name: t.name }))}
    />
  );
}
