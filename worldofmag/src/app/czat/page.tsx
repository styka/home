export const dynamic = "force-dynamic";

import { getRozmowy } from "@/modules/czat/actions/rozmowy";
import { getRozmowcy } from "@/modules/czat/actions/rozmowy";
import { CzatPage } from "@/modules/czat/ui/CzatPage";

export default async function CzatRootPage({
  searchParams,
}: {
  // Wybrana rozmowa żyje w ADRESIE (`?r=<id>`), więc rozmowa jest odnośnikiem, wraca przyciskiem
  // „wstecz" i da się ją zapisać w ulubionych. Wartość startowa MUSI przyjść propsem z serwera —
  // czytanie adresu na kliencie w pierwszym renderze to rozjazd hydratacji (wpis z 2026-08-02).
  searchParams?: { r?: string };
}) {
  const [rozmowy, rozmowcy] = await Promise.all([getRozmowy(), getRozmowcy()]);
  return <CzatPage poczatkowe={rozmowy} rozmowcy={rozmowcy} wybranaId={searchParams?.r ?? null} />;
}
