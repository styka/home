"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { isPathLocked } from "@/lib/pathPermissions";
import { MODULES, type ModuleDef, type PozycjaPaska, type Reka } from "@/lib/modules";
import { celeGlebiej } from "@/lib/nawigacja/celeModulu";
import type { GalazNawigacji } from "@/lib/nawigacja/szukajCelow";
import { filterAccessibleFavorites, type FavoriteViewDTO } from "@/platform/favorites/favoriteViews";
import { useUlubioneBiezacego } from "@/components/favorites/useUlubioneBiezacego";
import { useHistoriaNawigacji } from "./useHistoriaNawigacji";
import { PasekKciuka } from "./PasekKciuka";
import { PanelNawigacji } from "./PanelNawigacji";

/**
 * 103/104: warstwa pośrednia między powłoką a paskiem — z **powodu konstrukcyjnego**, nie dla porządku.
 *
 * `AppShell` sam RENDERUJE `ToastProvider`, więc hook czytający ten kontekst wywołany w jego ciele
 * dostałby wartość domyślną — czyli `showToast`, które nic nie robi. Gwiazdka zapisywałaby widok
 * poprawnie i **milczała**, a błąd (limit ulubionych, adres nie do zapisania) nie dotarłby do
 * użytkownika w ogóle. Dlatego wszystko, co potrzebuje powiadomień, mieszka WEWNĄTRZ dostawców.
 *
 * 104 dokłada tu drugi powód: stan otwarcia panelu szybkiej nawigacji i referencja do jego kotwicy.
 * Trzymanie ich piętro wyżej znaczyłoby, że każde otwarcie panelu przerenderowuje całą powłokę.
 */
export function PasekKciukaPolaczony({
  dalekie,
  bliskie,
  reka,
  pathname,
  favoriteViews,
  userPermissions,
  moduly,
}: {
  dalekie: PozycjaPaska[];
  bliskie: PozycjaPaska[];
  reka: Reka;
  pathname: string;
  favoriteViews: FavoriteViewDTO[];
  userPermissions: string[];
  /** Moduły dostępne dla roli — powłoka podaje je parametrem, pasek nie liczy uprawnień sam. */
  moduly: ModuleDef[];
}) {
  const t = useTranslations("components.shell.PasekKciuka");
  const router = useRouter();
  const { showToast } = useToast();

  const [panelOtwarty, setPanelOtwarty] = useState(false);
  const kotwicaRef = useRef<HTMLButtonElement>(null);

  const modulBiezacy = MODULES.find((m) => (m.exact ? pathname === m.href : pathname.startsWith(m.href)));
  const { zapisany, przelacz } = useUlubioneBiezacego(favoriteViews, modulBiezacy?.label);

  const historia = useHistoriaNawigacji(favoriteViews);
  /**
   * Historia i ulubione przechodzą przez ten sam filtr uprawnień co reszta powłoki. Filtrujemy przy
   * ODCZYCIE, nie przy zapisie: uprawnienie może wrócić i wtedy wpis ma znowu działać.
   */
  const historiaDostepna = filterAccessibleFavorites(
    historia.map((w) => ({ ...w, path: w.sciezka })),
    userPermissions,
    isPathLocked,
  );
  const ulubioneDostepne = filterAccessibleFavorites(favoriteViews, userPermissions, isPathLocked);

  /** Drzewo dla panelu: moduł + jego szybkie cele scalone z ulubionymi tego modułu (run 103). */
  const galezie: GalazNawigacji[] = moduly.map((m) => ({
    id: m.id,
    etykieta: m.label,
    href: m.href,
    kolor: m.color,
    cele: celeGlebiej(m, favoriteViews, userPermissions, isPathLocked),
  }));

  const idz = useCallback((href: string) => router.push(href), [router]);

  return (
    <>
      <PasekKciuka
        dalekie={dalekie}
        bliskie={bliskie}
        reka={reka}
        pathname={pathname}
        onModul={idz}
        ulubione={{ zapisany, przelacz }}
        nawigacja={{ otwarty: panelOtwarty, otworz: () => setPanelOtwarty(true), kotwicaRef }}
        historia={{
          // Krok wstecz oddajemy przeglądarce, zamiast kierować pod adres poprzedniej pozycji:
          // `push` rozbudowywałby stos historii przy każdym powrocie, więc systemowe „wstecz"
          // przestałoby po chwili robić to, czego użytkownik oczekuje.
          wstecz: () =>
            historiaDostepna.length === 0 ? showToast(t("historiaPusta"), "info") : router.back(),
          pusta: historiaDostepna.length === 0,
        }}
      />
      <PanelNawigacji
        kotwicaRef={kotwicaRef}
        otwarty={panelOtwarty}
        onClose={() => setPanelOtwarty(false)}
        onWybor={idz}
        galezie={galezie}
        ostatnie={historiaDostepna.map((w) => ({ id: w.sciezka, etykieta: w.etykieta, href: w.sciezka }))}
        ulubione={ulubioneDostepne.map((f) => ({ id: f.id, etykieta: f.label, href: f.path }))}
        hrefUstawien="/settings/nawigacja"
      />
    </>
  );
}
