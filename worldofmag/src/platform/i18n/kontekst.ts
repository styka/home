import { prisma } from "@/platform/db/prisma";
import { auth } from "@/platform/auth/session";
import { JEZYK_DOMYSLNY, STREFA_DOMYSLNA, jezykLubDomyslny, strefaLubDomyslna, type Jezyk } from "./jezyki";

/**
 * 089 (zadania 34/37, Faza 7) — SKĄD BIERZE SIĘ JĘZYK ŻĄDANIA.
 *
 * Z **przestrzeni osobistej** zalogowanego użytkownika. Nie z nagłówka `Accept-Language` i nie
 * z ciasteczka: rozdz. 8.2 umieszcza język w ustawieniach przestrzeni, bo zasób należy do
 * przestrzeni. Nagłówek przeglądarki zmieniałby wygląd tych samych danych w zależności od tego,
 * z czyjego komputera się je ogląda.
 *
 * **Dla treści konkretnego zasobu właściwy jest język JEGO przestrzeni**, nie oglądającego — od tego
 * jest `jezykPrzestrzeni(workspaceId)` niżej. Zwykłe chrome aplikacji (menu, przyciski, komunikaty)
 * używa języka przestrzeni osobistej, bo należy do użytkownika, a nie do oglądanego zasobu.
 */
export type UstawieniaJezykowe = { locale: Jezyk; timezone: string };

const DOMYSLNE: UstawieniaJezykowe = { locale: JEZYK_DOMYSLNY, timezone: STREFA_DOMYSLNA };

/**
 * Ustawienia dla bieżącego żądania. **Nigdy nie rzuca** — strona logowania, feed iCal autoryzowany
 * tokenem i zadania w tle nie mają sesji, a tłumaczenia muszą działać także tam. Brak sesji albo
 * niedostępna baza to po prostu wartości domyślne.
 */
export async function ustalJezykZadania(): Promise<UstawieniaJezykowe> {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return DOMYSLNE;
    const ws = await prisma.workspace.findUnique({
      where: { personalUserId: userId },
      select: { locale: true, timezone: true },
    });
    if (!ws) return DOMYSLNE;
    return { locale: jezykLubDomyslny(ws.locale), timezone: strefaLubDomyslna(ws.timezone) };
  } catch {
    return DOMYSLNE;
  }
}

/**
 * Ustawienia KONKRETNEJ przestrzeni — do treści, które w niej mieszkają (raport zespołu, plan
 * tygodnia, streszczenie wygenerowane przez model). Nie mylić z językiem oglądającego: raport
 * zespołu ma jeden język, niezależnie od tego, kto go otworzy.
 */
export async function jezykPrzestrzeni(workspaceId: string | null | undefined): Promise<UstawieniaJezykowe> {
  if (!workspaceId) return DOMYSLNE;
  try {
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { locale: true, timezone: true },
    });
    if (!ws) return DOMYSLNE;
    return { locale: jezykLubDomyslny(ws.locale), timezone: strefaLubDomyslna(ws.timezone) };
  } catch {
    return DOMYSLNE;
  }
}
