import { redirect } from "next/navigation";
import { auth } from "@/platform/auth/session";
import { MODULES } from "@/lib/modules";
import { isPathLocked } from "@/lib/pathPermissions";
import { moduleZPrzewodnikiem, wszystkiePrzewodniki } from "@/lib/przewodniki";
import {
  PrzewodnikiHub,
  type KafelekPrzewodnika,
  type KafelekWkrotce,
  type WpisIndeksu,
} from "@/components/guide/PrzewodnikiHub";

/**
 * 108 — DZIAŁ PRZEWODNIKÓW, pod adresem, który w tej aplikacji od zawsze znaczy „pomoc".
 *
 * Wcześniej stała tu jedna statyczna strona z przykładami komend asystenta. Jej treść nie zginęła —
 * jest teraz przewodnikiem „Asystent AI" w tym dziale. Drugi adres z pomocą oznaczałby dwa miejsca,
 * które czytelnik musi rozróżniać, a odnośniki ze Strony głównej i tak prowadzą tutaj.
 *
 * Bez uprawnienia modułowego (wystarczy sesja): pomoc to dokumentacja, a nie dane. Uprawnienia
 * czytamy po to, żeby WYGASIĆ kafelek modułu, do którego czytelnik nie ma dostępu — spójnie z tym,
 * jak menu boczne traktuje pozycję bez uprawnienia.
 */
export default async function GuidePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");
  const permissions = session.user.permissions ?? [];

  const przewodniki = wszystkiePrzewodniki();
  const zPrzewodnikiem = moduleZPrzewodnikiem();
  const modul = new Map(MODULES.map((m) => [m.id, m]));

  const gotowe: KafelekPrzewodnika[] = przewodniki.map((p) => {
    const m = p.moduleId ? modul.get(p.moduleId) : undefined;
    return {
      slug: p.slug,
      title: p.title,
      subtitle: p.subtitle,
      summary: p.summary,
      rozdzialow: p.rozdzialy.length,
      moduleId: p.moduleId,
      kolor: m?.color ?? "var(--accent-blue)",
      zablokowany: m ? isPathLocked(permissions, m.href) : false,
    };
  });

  /**
   * „Wkrótce" LICZYMY z rejestru modułów, a nie wypisujemy ręcznie.
   *
   * Druga lista rozjechałaby się przy pierwszym nowym module Omnii — i to w najgorszy sposób:
   * moduł nieobecny na liście „wkrótce" wygląda jak moduł, którego przewodnik już powstał.
   */
  const wkrotce: KafelekWkrotce[] = MODULES.filter((m) => !zPrzewodnikiem.has(m.id)).map((m) => ({
    moduleId: m.id,
    label: m.label,
    kolor: m.color,
    zablokowany: isPathLocked(permissions, m.href),
  }));

  /**
   * Indeks wyszukiwania: sam tekst rozdziałów, bez markdownu.
   *
   * Do przeglądarki idzie ta chuda postać, a nie `PRZEWODNIKI` — inaczej hub wiózłby ze sobą pełną
   * treść wszystkich przewodników tylko po to, żeby dało się w niej szukać.
   */
  const indeks: WpisIndeksu[] = przewodniki.flatMap((p) =>
    p.rozdzialy.map((r) => ({
      przewodnikSlug: p.slug,
      przewodnikTitle: p.title,
      rozdzialSlug: r.slug,
      rozdzialTitle: r.title,
      tekst: r.tekst,
    }))
  );

  return <PrzewodnikiHub gotowe={gotowe} wkrotce={wkrotce} indeks={indeks} />;
}
