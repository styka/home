"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { isPathLocked } from "@/lib/pathPermissions";
import { MODULES, type PozycjaPaska, type Reka } from "@/lib/modules";
import { filterAccessibleFavorites, type FavoriteViewDTO } from "@/platform/favorites/favoriteViews";
import { useUlubioneBiezacego } from "@/components/favorites/useUlubioneBiezacego";
import { useHistoriaNawigacji } from "./useHistoriaNawigacji";
import { PasekKciuka } from "./PasekKciuka";

/**
 * 103: warstwa pośrednia między powłoką a paskiem — i jest tu z **powodu konstrukcyjnego**, nie dla
 * porządku.
 *
 * `AppShell` sam RENDERUJE `ToastProvider`, więc hook czytający ten kontekst wywołany w jego ciele
 * dostałby wartość domyślną — czyli `showToast`, które nic nie robi. Efekt byłby najgorszy
 * z możliwych: gwiazdka zapisywałaby widok poprawnie i **milczała**, więc wyglądałaby na zepsutą,
 * a błąd (limit ulubionych, adres nie do zapisania) nie dotarłby do użytkownika w ogóle.
 * Dlatego wszystko, co potrzebuje powiadomień — przełącznik ulubionych i komunikat pustej historii
 * — mieszka w komponencie renderowanym WEWNĄTRZ dostawców.
 *
 * Rejestrator historii siedzi tutaj z tego samego powodu, dla którego siedzi w powłoce, a nie
 * w module: tylko powłoka widzi każdą zmianę adresu w aplikacji.
 */
export function PasekKciukaPolaczony({
  dalekie,
  bliskie,
  reka,
  pathname,
  favoriteViews,
  userPermissions,
}: {
  dalekie: PozycjaPaska[];
  bliskie: PozycjaPaska[];
  reka: Reka;
  pathname: string;
  favoriteViews: FavoriteViewDTO[];
  userPermissions: string[];
}) {
  const t = useTranslations("components.shell.PasekKciuka");
  const router = useRouter();
  const { showToast } = useToast();

  const modulBiezacy = MODULES.find((m) => (m.exact ? pathname === m.href : pathname.startsWith(m.href)));
  const { zapisany, przelacz } = useUlubioneBiezacego(favoriteViews, modulBiezacy?.label);
  const ulubioneDostepne = filterAccessibleFavorites(favoriteViews, userPermissions, isPathLocked);

  const historia = useHistoriaNawigacji(favoriteViews);
  /**
   * Historia przechodzi przez ten sam filtr uprawnień co ulubione (AC-16). Adres zapamiętany, zanim
   * uprawnienie zostało odebrane, nie może zostać drogą na skróty do modułu — filtrujemy przy
   * ODCZYCIE, nie przy zapisie, bo uprawnienie może wrócić i wtedy wpis ma znowu działać.
   */
  const dostepna = filterAccessibleFavorites(
    historia.map((w) => ({ ...w, path: w.sciezka })),
    userPermissions,
    isPathLocked,
  );

  return (
    <PasekKciuka
      dalekie={dalekie}
      bliskie={bliskie}
      reka={reka}
      pathname={pathname}
      ulubione={{
        zapisany,
        przelacz,
        pozycje: () => ulubioneDostepne.map((f) => ({ id: f.id, etykieta: f.label, href: f.path })),
        pusta: ulubioneDostepne.length === 0,
      }}
      historia={{
        pozycje: () => dostepna.map((w) => ({ id: w.sciezka, etykieta: w.etykieta, href: w.sciezka })),
        // Krok wstecz oddajemy przeglądarce, zamiast kierować pod adres poprzedniej pozycji:
        // `push` rozbudowywałby stos historii przy każdym powrocie, więc systemowe „wstecz"
        // przestałoby po chwili robić to, czego użytkownik oczekuje.
        wstecz: () => router.back(),
        pusta: dostepna.length === 0,
        naPustej: () => showToast(t("historiaPusta"), "info"),
      }}
    />
  );
}
