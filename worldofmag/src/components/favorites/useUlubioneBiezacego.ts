"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/ui/Toast";
import { addFavoriteView, removeFavoriteViewByPath } from "@/actions/favoriteViews";
import { normalizeFavoritePath, suggestFavoriteLabel, type FavoriteViewDTO } from "@/platform/favorites/favoriteViews";

/**
 * 103: GWIAZDKA JAKO INTELIGENTNA IKONA — jedno tapnięcie zapisuje albo odpisuje bieżący widok.
 *
 * Zgłoszenie właściciela: „Ikona do ulubionych powinna także działać analogicznie jak te inne
 * inteligentne ikony a nie tym dialogiem który był do tej pory". Dialog zostaje na komputerze
 * (`FavoriteStarButton` z wariantem `chrome`); na telefonie gwiazdka jest pozycją dolnego paska
 * i zachowuje się jak każda inna: krótko = jedna czynność, przytrzymanie = wachlarz.
 *
 * Trzy rzeczy, które łatwo tu zepsuć:
 *
 * 1. **Bieżący adres czytamy z `window.location` w efekcie, NIGDY przez `useSearchParams`.**
 *    Ten hook żyje w powłoce, która opakowuje każdą stronę; `useSearchParams` wymusza tam granicę
 *    Suspense i potrafi zepchnąć całą aplikację w renderowanie po stronie klienta (lekcja z 042).
 * 2. **Brak `confirmDialog`** — i to jest zgodne z C-34, nie wyjątek od niego. Potwierdzenie należy
 *    się czynności nieodwracalnej; ta odwraca się tym samym tapnięciem, a wykonywana jest
 *    kilkadziesiąt razy dziennie. Okno przy każdym zapisie zamieniłoby jeden gest w trzy.
 * 3. **Stan optymistyczny wraca przy błędzie.** Gwiazdka pokazuje wynik od razu (inaczej wygląda na
 *    zepsutą, bo akcja serwerowa idzie kilkaset milisekund), ale odmowa zapisu — limit 30 ulubionych
 *    albo adres, którego nie wolno zapisać — musi ten stan cofnąć, a nie zostawić kłamstwa na ikonie.
 */
export function useUlubioneBiezacego(favorites: FavoriteViewDTO[], moduleLabel?: string) {
  const t = useTranslations("components.favorites.useUlubioneBiezacego");
  const router = useRouter();
  const pathname = usePathname();
  const { showToast } = useToast();
  const [zapisujemy, startTransition] = useTransition();

  const [adres, setAdres] = useState<string | null>(null);
  useEffect(() => {
    setAdres(normalizeFavoritePath(window.location.pathname + window.location.search));
  }, [pathname]);

  const zapisanyServer = !!adres && favorites.some((f) => f.path === adres);
  /**
   * `null` = „idziemy za serwerem". Wartość ustawiamy wyłącznie na czas trwania zapisu i zaraz po
   * nim czyścimy — inaczej po `router.refresh()` mielibyśmy dwa źródła prawdy o tym samym fakcie
   * i to lokalne, nieaktualizowane, wygrywałoby z bazą.
   */
  const [wstepny, setWstepny] = useState<boolean | null>(null);
  useEffect(() => { setWstepny(null); }, [zapisanyServer, adres]);

  const zapisany = wstepny ?? zapisanyServer;

  const przelacz = useCallback(() => {
    if (!adres) {
      showToast(t("adresNieDoZapisania"), "error");
      return;
    }
    const dodajemy = !zapisany;
    const etykieta = suggestFavoriteLabel(adres, moduleLabel);
    setWstepny(dodajemy);

    startTransition(async () => {
      try {
        if (dodajemy) {
          await addFavoriteView({ path: adres, label: etykieta });
          showToast(t("zapisano", { nazwa: etykieta }), "success");
        } else {
          await removeFavoriteViewByPath(adres);
          showToast(t("usunieto", { nazwa: etykieta }), "info");
        }
        router.refresh();
      } catch (e) {
        setWstepny(null);
        showToast(e instanceof Error ? e.message : t("nieUdaloSie"), "error");
      }
    });
  }, [adres, zapisany, moduleLabel, router, showToast, t]);

  return { zapisany, przelacz, zapisujemy, adres };
}
