// 083: magistrala zdarzeń KOSZTU operacji AI.
//
// Po co, skoro koszt już przechodzi przez `AiCostBadge`: bo od 083 ten komponent **nic nie rysuje**,
// dopóki administrator nie włączy pokazywania kosztów — a wiedzieć o koszcie ma zawsze. Meldunek
// musi więc dojechać do miejsca całkiem innego niż treść: do ulotnych powiadomień w rogu ekranu,
// montowanych RAZ w powłoce.
//
// Ten sam wzorzec, co `platform/favorites/favoritesBus.ts` — zdarzenie okna zamiast kontekstu, bo
// nadawcy (26 miejsc w modułach) i odbiorca (jeden komponent powłoki) nie mają wspólnego przodka
// bliżej niż korzeń aplikacji, a przeciąganie kontekstu przez cały ten dystans dokładałoby
// przerysowania wszystkiemu po drodze.
//
// Świadomie BEZ Reacta i BEZ Prismy: plik ma się importować z dowolnego komponentu klienckiego.

export const AI_KOSZT_EVENT = "omnia:ai-koszt";

export interface ZdarzenieKosztu {
  /**
   * Nazwa BIZNESOWEJ czynności użytkownika („Streszczenie wiadomości", „Plan tygodnia"), a nie typ
   * operacji LLM. To jest cała treść pytania właściciela „za co poleciał ten koszt": na jednej
   * stronie bywa kilka komponentów wołających model, a „reasoning" nie odróżnia żadnego z nich.
   */
  akcja: string;
  /**
   * Świadomie WĘŻSZY kształt niż `AiUsageInfo`: powiadomienie pokazuje kwotę i nazwę akcji, więc
   * nie ma powodu przeciągać przez magistralę modeli, tokenów wejścia/wyjścia i rozbicia wywołań.
   * Szczegóły są przy treści, po włączeniu wskaźnika — i tam sięga się po pełne zużycie.
   */
  usage: { costUsd?: number; costKnown?: boolean; tokens?: number; model?: string };
}

export function zglosKoszt(zdarzenie: ZdarzenieKosztu): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AI_KOSZT_EVENT, { detail: zdarzenie }));
}

/** Zwraca funkcję odpinającą — wzorzec `onDataRefreshed`. */
export function onKoszt(handler: (zdarzenie: ZdarzenieKosztu) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (e: Event) => {
    const detail = (e as CustomEvent<ZdarzenieKosztu>).detail;
    if (detail) handler(detail);
  };
  window.addEventListener(AI_KOSZT_EVENT, listener);
  return () => window.removeEventListener(AI_KOSZT_EVENT, listener);
}
