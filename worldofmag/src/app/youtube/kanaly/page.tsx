export const dynamic = "force-dynamic";

import { getKanaly } from "@/modules/youtube/actions/kanaly";
import { czyPolaczony } from "@/modules/youtube/actions/polaczenie";
import { KanalyPage } from "@/modules/youtube/ui/KanalyPage";

export default async function KanalyRootPage() {
  const [kanaly, polaczony] = await Promise.all([getKanaly(), czyPolaczony()]);
  return <KanalyPage poczatkowe={kanaly} polaczony={polaczony} />;
}
