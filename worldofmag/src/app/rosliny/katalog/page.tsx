export const dynamic = "force-dynamic";

import { getSpeciesList, searchCatalog } from "@/modules/rosliny/actions/gatunki";
import { KatalogGatunkow } from "@/modules/rosliny/ui/KatalogGatunkow";

export default async function KatalogPage() {
  const [katalog, moje] = await Promise.all([searchCatalog(), getSpeciesList()]);
  return <KatalogGatunkow katalog={katalog} moje={moje} />;
}
