export const dynamic = "force-dynamic";

import { getSpaces, getWeatherOptions } from "@/modules/rosliny/actions/przestrzenie";
import { getCareAgenda } from "@/modules/rosliny/actions/opieka";
import { RoslinyPage } from "@/modules/rosliny/ui/RoslinyPage";

export default async function RoslinyRootPage() {
  // 118 (zgł. 6): lokalizacje pogodowe już przy TWORZENIU przestrzeni — passthrough przez
  // kontrakt Pogody; pusta lista niczego nie blokuje (pole po prostu się nie pokaże).
  const [przestrzenie, agenda, lokalizacje] = await Promise.all([
    getSpaces(),
    getCareAgenda({ dni: 7 }),
    getWeatherOptions(),
  ]);
  return <RoslinyPage przestrzenie={przestrzenie} agenda={agenda} lokalizacje={lokalizacje} />;
}
