export const dynamic = "force-dynamic";

import { getCareAgenda } from "@/modules/rosliny/actions/opieka";
import { AgendaOpieki } from "@/modules/rosliny/ui/AgendaOpieki";

export default async function OpiekaPage() {
  return <AgendaOpieki pozycje={await getCareAgenda({ dni: 14 })} />;
}
