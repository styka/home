import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * 125: zapisane zestawy projektów zostały zastąpione OBSZARAMI (migracja 0293 zachowała id
 * wierszy), więc stary adres — zapisany w ulubionych widokach — przekierowuje 1:1 na widok
 * obszaru. Kontrolę dostępu i „nie znaleziono" rozstrzyga trasa docelowa; ta jest tylko mostem.
 * (Adres /tasks/multi?group=<id> przekierowuje na /tasks/zestaw/<id> jak dotąd, więc łańcuch
 * domyka się sam.)
 */
export default function TaskSetPage({ params }: { params: { zestawId: string } }) {
  redirect(`/tasks/obszar/${params.zestawId}`);
}
