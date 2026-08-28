"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  oznaczPowrot,
  pozycjaDla,
  zapamietaj,
  zuzyjPowrot,
  zuzyjPowrotDokumentu,
} from "@/platform/nawigacja/przewijanie";

/**
 * 111: POWRÓT „WSTECZ" WRACA TAM, GDZIE BYŁEŚ.
 *
 * Zgłoszenie właściciela: „gdy cofam na poprzednią stronę, to jeśli byłem na tej stronie
 * zescrolowany, nie wraca do tego miejsca, tylko pokazuje stronę od samej góry".
 *
 * Hook siada na kontenerze przewijania RAMY WIDOKU — bo to on się przewija, a nie okno (patrz
 * nagłówek `platform/nawigacja/przewijanie.ts`). Dzięki temu jedno wpięcie obsługuje wszystkie
 * widoki modułów i panel administratora, zamiast dwudziestu kopii w modułach (C-35).
 *
 * Cztery rzeczy, które są tu decyzją, a nie przypadkiem:
 *
 * 1. **Zapis jest dławiony klatką.** `scroll` to najczęstsze zdarzenie w całej aplikacji; zapis
 *    przy każdym z nich sięgałby do pamięci sesji setki razy na sekundę. `requestAnimationFrame`
 *    ścina to do jednego zapisu na klatkę i nie wprowadza opóźnienia widocznego dla użytkownika.
 * 2. **Zapisujemy też PRZY WYJŚCIU z widoku.** Ostatnia klatka przewijania bywa zjedzona przez
 *    nawigację, więc sprzątanie efektu zapisuje pozycję jeszcze raz — to ona jest tą, po którą
 *    użytkownik wróci.
 * 3. **Przywracamy wyłącznie przy POWROCIE W HISTORII** — nigdy przy wejściu z menu czy z odnośnika
 *    (AC-2). Powrót rozpoznajemy DWOMA sposobami, bo przeglądarka robi go dwoma mechanizmami:
 *    `popstate`, gdy cofnięcie zostaje w tym samym dokumencie (nawigacja po aplikacji), oraz wpisem
 *    `back_forward` w pomiarach nawigacji, gdy cofnięcie ładuje dokument OD NOWA (poprzednia strona
 *    weszła odświeżeniem albo z paska adresu). Sam `popstate` obsługiwał tylko pierwszą połowę —
 *    i tego właśnie nie widać w testach jednostkowych, a wyszło w klikaczu.
 * 4. **Przywracanie ma okno ponowień, nie jedną próbę.** Listy dociągane z serwera nie mają swojej
 *    wysokości w pierwszej klatce, więc `scrollTop = 1200` po prostu by się nie przyjęło. Próbujemy
 *    przez chwilę, dopóki treść nie urośnie — i **odpuszczamy po czasie**: skok w trakcie czytania
 *    jest gorszy niż brak skoku.
 */

/** Ile czekamy, aż treść urośnie na tyle, by dało się ustawić zapamiętaną pozycję. */
const OKNO_PRZYWRACANIA_MS = 1000;

/**
 * Nasłuch `popstate` rejestrujemy RAZ na całą aplikację, a nie w każdym wystąpieniu hooka.
 *
 * Rama widoku bywa zamontowana raz, ale sam moduł może ją przemontować przy zmianie trasy —
 * a wtedy dwa nasłuchy zapaliłyby flagę dwa razy i drugie zapalenie nie miałoby już czego dotyczyć.
 */
let nasluchZarejestrowany = false;

function zarejestrujNasluchPowrotu(): void {
  if (nasluchZarejestrowany || typeof window === "undefined") return;
  nasluchZarejestrowany = true;
  window.addEventListener("popstate", oznaczPowrot);
}

/**
 * Referencja przyjmowana jest jako zwykły obiekt z polem `current`, a nie `RefObject`: rama łączy
 * ją z opcjonalnym `scrollRef` modułu, więc musi móc do niej pisać.
 */
export function usePrzywroceniePrzewijania(ref: { current: HTMLElement | null }): void {
  const pathname = usePathname();

  useEffect(() => {
    zarejestrujNasluchPowrotu();

    const el = ref.current;
    if (!el) return;

    // Klucz to adres ZE stanem widoku w `?query`: w Omnii zakładka i filtry żyją w adresie, więc
    // dwa różne widoki tego samego modułu to dwa różne miejsca do zapamiętania.
    const klucz = window.location.pathname + window.location.search;

    let klatka: number | null = null;
    const naPrzewiniecie = () => {
      if (klatka !== null) return;
      klatka = window.requestAnimationFrame(() => {
        klatka = null;
        zapamietaj(klucz, el.scrollTop);
      });
    };
    el.addEventListener("scroll", naPrzewiniecie, { passive: true });

    // ── przywracanie ─────────────────────────────────────────────────────────
    // Flagę zużywamy ZAWSZE przy wejściu na widok, także gdy nie ma czego przywracać: gdyby
    // została zapalona, przywróciłaby pozycję przy najbliższej zwykłej nawigacji.
    // Dwa rodzaje powrotu, bo przeglądarka robi je dwoma mechanizmami: `popstate` przy nawigacji
    // wewnątrz dokumentu i `back_forward` w pomiarach, gdy cofnięcie ładuje dokument od nowa.
    // Kolejność `||` z jawnym drugim wywołaniem, a nie skrót — obie flagi mają się ZUŻYĆ.
    const zPopstate = zuzyjPowrot();
    const zDokumentu = zuzyjPowrotDokumentu();
    const toPowrot = zPopstate || zDokumentu;
    const cel = toPowrot ? pozycjaDla(klucz) : null;
    let przywracanie: number | null = null;

    if (cel !== null && cel > 0) {
      const doKiedy = Date.now() + OKNO_PRZYWRACANIA_MS;
      const sprobuj = () => {
        przywracanie = null;
        if (!ref.current) return;
        ref.current.scrollTop = cel;
        // Przyjęło się (z tolerancją na zaokrąglenie i na treść odrobinę krótszą niż była)?
        if (Math.abs(ref.current.scrollTop - cel) < 4 || Date.now() > doKiedy) return;
        przywracanie = window.requestAnimationFrame(sprobuj);
      };
      // Pierwsza próba po malowaniu — Next ustawia przewijanie na zero przy nawigacji, więc
      // wcześniejsza próba zostałaby przez niego nadpisana.
      przywracanie = window.requestAnimationFrame(sprobuj);
    }

    return () => {
      el.removeEventListener("scroll", naPrzewiniecie);
      if (klatka !== null) window.cancelAnimationFrame(klatka);
      if (przywracanie !== null) window.cancelAnimationFrame(przywracanie);
      // Decyzja 2: ostatnia klatka przewijania bywa zjedzona przez nawigację.
      zapamietaj(klucz, el.scrollTop);
    };
    // `pathname` jest tu po to, żeby przy przejściu między widokami efekt przeszedł pełny cykl:
    // sprzątanie zapisuje pozycję STAREGO widoku, a nowy przebieg przywraca pozycję nowego.
  }, [ref, pathname]);
}
