export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getSpace } from "@/modules/rosliny/actions/przestrzenie";
import { getPlant } from "@/modules/rosliny/actions/rosliny";
import { getJournal, getMeasurements } from "@/modules/rosliny/actions/dziennik";
import { getCareHistory, getPlantCareTasks } from "@/modules/rosliny/actions/opieka";
import { getHarvests } from "@/modules/rosliny/actions/zbiory";
import { RoslinaSzczegol } from "@/modules/rosliny/ui/RoslinaSzczegol";

export default async function RoslinaPage({ params }: { params: { spaceId: string; plantId: string } }) {
  const roslina = await getPlant(params.plantId);
  // Zgodność rośliny z przestrzenią Z ADRESU jest częścią poprawności widoku: `tryb` (widoczność
  // pól BBCH, liczności, ewidencji) brał się z przestrzeni z URL, więc ręcznie sklejony adres
  // renderował roślinę domową w trybie polowym (wbrew AC-2), a niedostępna przestrzeń z adresu
  // kończyła się błędem 500 zamiast 404.
  if (!roslina || roslina.spaceId !== params.spaceId) notFound();

  const [przestrzen, dziennik, pomiary, zdarzenia, zbiory, zadania] = await Promise.all([
    getSpace(params.spaceId),
    getJournal(params.plantId),
    getMeasurements(params.plantId),
    getCareHistory({ plantId: params.plantId, limit: 30 }),
    getHarvests({ plantId: params.plantId, limit: 30 }),
    getPlantCareTasks(params.plantId),
  ]);

  return (
    <RoslinaSzczegol
      roslina={roslina}
      dziennik={dziennik}
      pomiary={pomiary}
      zdarzenia={zdarzenia}
      zbiory={zbiory}
      zadania={zadania}
      tryb={przestrzen?.kind ?? "home"}
    />
  );
}
