export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getSpace, getWeatherOptions } from "@/modules/rosliny/actions/przestrzenie";
import { getPlaces } from "@/modules/rosliny/actions/miejsca";
import { getPlants } from "@/modules/rosliny/actions/rosliny";
import { getSpeciesList } from "@/modules/rosliny/actions/gatunki";
import { getSeasonPlan, getSpaceInsights } from "@/modules/rosliny/actions/analiza";
import { PrzestrzenPage } from "@/modules/rosliny/ui/PrzestrzenPage";

export default async function PrzestrzenRootPage({ params }: { params: { spaceId: string } }) {
  const przestrzen = await getSpace(params.spaceId);
  if (!przestrzen) notFound();

  const [miejsca, rosliny, plan, wnioski, lokalizacje, gatunki] = await Promise.all([
    getPlaces(params.spaceId),
    getPlants({ spaceId: params.spaceId }),
    getSeasonPlan(params.spaceId),
    getSpaceInsights(params.spaceId),
    getWeatherOptions(),
    getSpeciesList(),
  ]);

  return (
    <PrzestrzenPage
      przestrzen={przestrzen}
      miejsca={miejsca}
      rosliny={rosliny}
      plan={plan}
      wnioski={wnioski}
      lokalizacje={lokalizacje}
      gatunki={gatunki}
    />
  );
}
