"use client";

import { Compass } from "lucide-react";
import { useTranslations } from "next-intl";
import { ModuleView } from "@/components/ui/view";
import { SpisUstawien } from "@/components/settings/SpisUstawien";

/**
 * 109: NIEZNANY ADRES SEKCJI — spis z wyjaśnieniem, zamiast `notFound()`.
 *
 * `notFound()` na tej trasie **nie działa jak trzeba**, i to jest pomiar, nie przeczucie: treść
 * strony 404 nie pojawiała się ani w odpowiedzi serwera, ani w przeglądarce w ciągu 10 sekund —
 * użytkownik zostawał na stanie ładowania. Nie pomogła ani własna granica `not-found.tsx` w tym
 * segmencie, ani rzucenie `notFound()` przed pierwszym `await`, ani usunięcie `settings/loading.tsx`
 * (wszystkie trzy sprawdzone osobno). Status odpowiedzi i tak pozostawał 200, więc `notFound()`
 * nie dawał tu nawet tego, po co się go używa.
 *
 * Zwykły render zachowuje się poprawnie — więc odpowiedź na zły adres jest zwykłym widokiem.
 * Wychodzi z tego lepszy UX niż globalna strona 404: użytkownik nie tylko dowiaduje się, że adres
 * jest zły, ale od razu widzi listę sekcji, które istnieją, i wchodzi w tę, o którą mu chodziło.
 */
export function SekcjaNieznaleziona() {
  const t = useTranslations("app.settings.sekcja");
  const tSpis = useTranslations("app.settings.spis");

  return (
    <ModuleView
      state="ready"
      width="narrow"
      icon={<Compass size={22} />}
      title={t("nieZnalezionoTytul")}
      subtitle={t("nieZnalezionoOpis")}
    >
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "14px 18px",
          color: "var(--text-secondary)",
          fontSize: 13,
          lineHeight: 1.5,
        }}
      >
        {tSpis("podtytul")}
      </div>
      <SpisUstawien wariant="kafelki" />
    </ModuleView>
  );
}
