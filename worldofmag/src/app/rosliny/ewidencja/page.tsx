export const dynamic = "force-dynamic";

import { getTreatmentRegister } from "@/modules/rosliny/actions/ewidencja";
import { Ewidencja } from "@/modules/rosliny/ui/Ewidencja";

export default async function EwidencjaPage() {
  return <Ewidencja pozycje={await getTreatmentRegister()} />;
}
