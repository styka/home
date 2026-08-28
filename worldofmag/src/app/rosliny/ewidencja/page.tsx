export const dynamic = "force-dynamic";

import { getTreatmentRegister } from "@/modules/rosliny/actions/ewidencja";
import { getSpaces } from "@/modules/rosliny/actions/przestrzenie";
import { Ewidencja } from "@/modules/rosliny/ui/Ewidencja";
import { trybZawodowy } from "@/modules/rosliny/lib/tryb";

export default async function EwidencjaPage() {
  const [pozycje, przestrzenie] = await Promise.all([getTreatmentRegister(), getSpaces()]);
  // Formularz zabiegu proponujemy wyłącznie dla przestrzeni zawodowych — parapet w mieszkaniu
  // nie podlega ewidencji, a wciągnięcie go do listy wyboru sugerowałoby, że podlega.
  return <Ewidencja pozycje={pozycje} przestrzenie={przestrzenie.filter((p) => trybZawodowy(p.kind))} />;
}
