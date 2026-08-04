"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * 045 — kontrakt widoku, część „co powłoka wstrzykuje do paska".
 *
 * DLACZEGO KONTEKST, A NIE PASEK RYSOWANY W `AppShell`
 *
 * `AppShell` renderuje `<main>{children}</main>` i **nie zna tytułu modułu** — nagłówek
 * zawsze należał do strony. To jest dokładny powód, dla którego w 043 nie dało się
 * spełnić prośby właściciela („przycisk zapisu widoku wyraźnie widoczny w pasku
 * bieżącego widoku"): wspólnego paska nie było, a dołożenie go w powłoce dałoby
 * PODWÓJNE NAGŁÓWKI w ~20 modułach. Przycisk trafił wtedy na górę nawigacji,
 * a odstępstwo odnotowano w recenzji.
 *
 * Rozwiązanie odwraca zależność: powłoka **udostępnia zawartość** (ten kontekst),
 * a rysuje ją `ModuleView` osadzony w stronie modułu. Moduł nadal nie wie, co
 * w pasku siedzi — i o to chodzi.
 *
 * Brak providera jest poprawnym stanem (np. playground renderujący `ViewBar` poza
 * powłoką): wtedy chrom jest po prostu pusty, bez błędu.
 */

export interface ViewChrome {
  /** Gwiazdka „zapisz ten widok" — ulubione (042/043). */
  favorite?: ReactNode;
  /** Wskaźnik świeżości danych. */
  freshness?: ReactNode;
  /** Wejście do ściągawki skrótów klawiszowych. */
  shortcuts?: ReactNode;
}

const ViewChromeContext = createContext<ViewChrome>({});

export function ViewChromeProvider({ value, children }: { value: ViewChrome; children: ReactNode }) {
  return <ViewChromeContext.Provider value={value}>{children}</ViewChromeContext.Provider>;
}

export function useViewChrome(): ViewChrome {
  return useContext(ViewChromeContext);
}

/**
 * Zasób, którego dotyczy widok.
 *
 * ŚWIADOMIE ZAREZERWOWANY (plan §5.2). Dziś nic nie robi. Istnieje od początku, żeby
 * okno konfliktu edycji, udostępnianie i awatary obecności — wymagające zdolności
 * z Faz 2 i 4 przebudowy — dało się dołożyć **bez wracania do 21 modułów**. Dokładnie
 * o to chodzi w rozdz. 10.5 architektury docelowej.
 */
export interface ViewResource {
  /** np. "tasks.project", "shopping.list" */
  type: string;
  id: string;
}
