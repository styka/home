export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getSpace } from "@/modules/rosliny/actions/przestrzenie";
import { getPlant } from "@/modules/rosliny/actions/rosliny";
import { getJournal, getMeasurements } from "@/modules/rosliny/actions/dziennik";
import { getCareHistory } from "@/modules/rosliny/actions/opieka";
import { getHarvests } from "@/modules/rosliny/actions/zbiory";
import { RoslinaSzczegol } from "@/modules/rosliny/ui/RoslinaSzczegol";

export default async function RoslinaPage({ params }: { params: { spaceId: string; plantId: string } }) {
  const roslina = await getPlant(params.plantId);
  if (!roslina) notFound();

  const [przestrzen, dziennik, pomiary, zdarzenia, zbiory] = await Promise.all([
    getSpace(params.spaceId),
    getJournal(params.plantId),
    getMeasurements(params.plantId),
    getCareHistory({ plantId: params.plantId, limit: 30 }),
    getHarvests({ plantId: params.plantId, limit: 30 }),
  ]);

  return (
    <RoslinaSzczegol
      roslina={roslina}
      dziennik={dziennik}
      pomiary={pomiary}
      zdarzenia={zdarzenia}
      zbiory={zbiory}
      tryb={przestrzen?.kind ?? "home"}
    />
  );
}
