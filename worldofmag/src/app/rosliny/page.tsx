export const dynamic = "force-dynamic";

import { getSpaces } from "@/modules/rosliny/actions/przestrzenie";
import { getCareAgenda } from "@/modules/rosliny/actions/opieka";
import { RoslinyPage } from "@/modules/rosliny/ui/RoslinyPage";

export default async function RoslinyRootPage() {
  const [przestrzenie, agenda] = await Promise.all([getSpaces(), getCareAgenda({ dni: 7 })]);
  return <RoslinyPage przestrzenie={przestrzenie} agenda={agenda} />;
}
