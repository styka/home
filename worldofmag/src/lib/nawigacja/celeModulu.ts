import type { ModuleDef } from "@/lib/modules";
import type { SzybkiCelModulu } from "@/platform/registry";
import { filterAccessibleFavorites, type FavoriteViewDTO } from "@/platform/favorites/favoriteViews";

/** Pozycja drugiego poziomu wachlarza — kształt wspólny dla celu modułu i zapisanego widoku. */
export interface CelGlebiej {
  id: string;
  etykieta: string;
  href: string;
  Icon?: SzybkiCelModulu["Icon"];
}

/**
 * 103: DRUGI POZIOM wachlarza — szybkie cele modułu scalone z zapisanymi widokami użytkownika.
 *
 * Do run 100 drugi poziom brał się WYŁĄCZNIE z ulubionych, więc u konta, które niczego nie
 * zapisało, po prostu nie istniał — połowa gestu była niewidoczna do czasu, aż użytkownik sam się
 * domyśli, że ma coś zapisać. Deklarowane cele odwracają tę kolejność: gest działa od pierwszego
 * dnia, a ulubione go **personalizują**.
 *
 * Trzy decyzje:
 *
 * 1. **Cele modułu idą pierwsze**, bo są stałe — pozycja, która nie skacze po liście przy każdym
 *    nowym ulubionym, daje się zapamiętać mięśniowo, a o to w geście chodzi.
 * 2. **Duplikat adresu wygrywa po stronie UŻYTKOWNIKA.** Gdy ktoś zapisał `/kitchen/plan` pod
 *    własną nazwą, to jest nazwa, po której to miejsce rozpozna — ale zostaje na pozycji celu
 *    modułu, żeby kolejność nie zależała od tego, co akurat zapisał.
 * 3. **Filtr uprawnień na końcu, na całości** (`filterAccessibleFavorites`) — ta sama funkcja, co
 *    w reszcie powłoki. Cel modułu też przez niego przechodzi: uprawnienie do modułu nie znaczy
 *    uprawnienia do każdej jego trasy, a wachlarz nie ma prawa być obejściem RBAC.
 */
export function celeGlebiej(
  modul: ModuleDef | undefined,
  ulubione: FavoriteViewDTO[],
  permissions: string[],
  isLocked: (permissions: string[], path: string) => boolean,
): CelGlebiej[] {
  if (!modul) return [];

  /**
   * Moduł o adresie „/" (Strona główna) jest PREFIKSEM każdej ścieżki, więc dopasowanie po
   * prefiksie przypisałoby mu wszystkie zapisane widoki w aplikacji. Pułapka rozpoznana w recenzji
   * run 100 — zostaje zamknięta także tutaj, bo od 103 kotwica domu znów trafia do paska.
   */
  const wlasneUlubione =
    modul.href === "/"
      ? []
      : ulubione.filter(
          (f) => f.path === modul.href || f.path.startsWith(`${modul.href}/`) || f.path.startsWith(`${modul.href}?`),
        );

  const wynik: CelGlebiej[] = [];
  const widziane = new Set<string>();

  for (const cel of modul.szybkieCele ?? []) {
    const nadpisanie = wlasneUlubione.find((f) => f.path === cel.href);
    wynik.push({
      id: `${modul.id}:${cel.id}`,
      etykieta: nadpisanie?.label ?? cel.etykieta,
      href: cel.href,
      Icon: cel.Icon,
    });
    widziane.add(cel.href);
  }

  for (const f of wlasneUlubione) {
    if (widziane.has(f.path)) continue;
    wynik.push({ id: f.id, etykieta: f.label, href: f.path });
    widziane.add(f.path);
  }

  return filterAccessibleFavorites(
    wynik.map((c) => ({ ...c, path: c.href })),
    permissions,
    isLocked,
  ).map(({ path: _path, ...c }) => c);
}
