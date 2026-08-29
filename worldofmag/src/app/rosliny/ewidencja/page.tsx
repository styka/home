export const dynamic = "force-dynamic";

import { auth } from "@/platform/auth/session";
import { hasPermission } from "@/platform/auth/permissions";
import magazynowanieModule from "@/modules/magazynowanie/module";
import { getStorageItems } from "@/modules/magazynowanie/contract";
import { getTreatmentRegister } from "@/modules/rosliny/actions/ewidencja";
import { getSpaces } from "@/modules/rosliny/actions/przestrzenie";
import { Ewidencja } from "@/modules/rosliny/ui/Ewidencja";
import { trybZawodowy } from "@/modules/rosliny/lib/tryb";

export default async function EwidencjaPage() {
  const [pozycje, przestrzenie] = await Promise.all([getTreatmentRegister(), getSpaces()]);
  // 115 (Z-INT-18): pozycje Magazynu do zdjęcia środka ze stanu — tylko z uprawnieniem do modułu,
  // a awaria Magazynu nie może zabrać ewidencji (try/catch → pusta lista = sekcji po prostu nie ma).
  const session = await auth();
  const magazyn = hasPermission(session, magazynowanieModule.permission)
    ? await getStorageItems()
        .then((items) => items.map((i) => ({ id: i.id, name: i.name, quantity: i.quantity, unit: i.unit })))
        .catch(() => [])
    : [];
  // Formularz zabiegu proponujemy wyłącznie dla przestrzeni zawodowych — parapet w mieszkaniu
  // nie podlega ewidencji, a wciągnięcie go do listy wyboru sugerowałoby, że podlega.
  return <Ewidencja pozycje={pozycje} przestrzenie={przestrzenie.filter((p) => trybZawodowy(p.kind))} magazyn={magazyn} />;
}
