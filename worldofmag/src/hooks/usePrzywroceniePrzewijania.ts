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
 * Pięć rzeczy, które są tu decyzją, a nie przypadkiem:
 *
 * 1. **Zapis jest dławiony klatką.** `scroll` to najczęstsze zdarzenie w całej aplikacji; zapis
 *    przy każdym z nich sięgałby do pamięci sesji setki razy na sekundę. `requestAnimationFrame`
 *    ścina to do jednego zapisu na klatkę i nie wprowadza opóźnienia widocznego dla użytkownika.
 * 2. **Sprzątanie zapisuje ZAPAMIĘTANĄ LICZBĘ, nie odczyt z DOM-u.** React bywa uruchamiany
 *    współbieżnie i kontener potrafi być w tym momencie już odłączony od dokumentu, a odłączony
 *    element zwraca `0` — czyli sprzątanie skasowałoby dokładnie tę pozycję, po którą użytkownik
 *    za chwilę wraca.
 * 3. **Przywracamy wyłącznie przy POWROCIE W HISTORII** — nigdy przy wejściu z menu czy z odnośnika
 *    (AC-2). Powrót rozpoznajemy DWOMA sposobami, bo przeglądarka robi go dwoma mechanizmami:
 *    `popstate`, gdy cofnięcie zostaje w tym samym dokumencie, oraz wpisem `back_forward`
 *    w pomiarach nawigacji, gdy cofnięcie ładuje dokument OD NOWA.
 * 4. **Kluczem jest adres RAZEM Z `?query`, czytany w momencie użycia.** W Omnii zakładka i filtry
 *    żyją w adresie (`useViewState`), a zmiana zakładki nie rusza ścieżki — robi `pushState`. Klucz
 *    przechwycony raz na montażu zapisywałby więc pozycję zakładki „Oś czasu" pod adresem listy
 *    wiadomości, a powrót w obrębie jednej ścieżki nie przywracałby nic (recenzja 111).
 * 5. **Przywrócenie po `popstate` ma WŁASNY nasłuch.** Cofnięcie między zakładkami tego samego
 *    modułu nie zmienia `pathname`, więc efekt Reacta się nie powtarza i nie miałby kiedy zadziałać.
 *    Bez tego flaga powrotu zostawałaby zapalona i zużyłaby ją dopiero **następna zwykła nawigacja**
 *    — przywracając pozycję tam, gdzie nikt o to nie prosił (złamane AC-2).
 */

/** Ile czekamy, aż treść urośnie na tyle, by dało się ustawić zapamiętaną pozycję. */
const OKNO_PRZYWRACANIA_MS = 1000;

/**
 * Nasłuch `popstate` **zapalający flagę** rejestrujemy raz na całą aplikację.
 *
 * Musi stać osobno od nasłuchu przywracającego (niżej): flagę zapala się dokładnie raz na
 * cofnięcie, a przywracać może każda zamontowana rama.
 */
let nasluchZarejestrowany = false;

function zarejestrujNasluchPowrotu(): void {
  if (nasluchZarejestrowany || typeof window === "undefined") return;
  nasluchZarejestrowany = true;
  window.addEventListener("popstate", oznaczPowrot);
}

/** Adres widoku RAZEM ze stanem w `?query` — czytany w momencie użycia, nigdy zapamiętany. */
function kluczWidoku(): string {
  return window.location.pathname + window.location.search;
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

    let klatka: number | null = null;
    let przywracanie: number | null = null;
    /** Ostatnia ZNANA pozycja i adres, pod którym ją widzieliśmy — patrz decyzje 2 i 4. */
    let ostatniaPozycja = el.scrollTop;
    let ostatniKlucz = kluczWidoku();

    const naPrzewiniecie = () => {
      ostatniaPozycja = el.scrollTop;
      ostatniKlucz = kluczWidoku();
      if (klatka !== null) return;
      klatka = window.requestAnimationFrame(() => {
        klatka = null;
        zapamietaj(ostatniKlucz, ostatniaPozycja);
      });
    };
    el.addEventListener("scroll", naPrzewiniecie, { passive: true });

    /**
     * Próba przywrócenia pozycji pod BIEŻĄCYM adresem. Wołana przy wejściu na widok i po każdym
     * cofnięciu w historii; sama sprawdza, czy jest do czego wracać.
     */
    const przywroc = () => {
      if (przywracanie !== null) {
        window.cancelAnimationFrame(przywracanie);
        przywracanie = null;
      }
      const klucz = kluczWidoku();
      const cel = pozycjaDla(klucz);
      if (cel === null || cel <= 0) return;

      const doKiedy = Date.now() + OKNO_PRZYWRACANIA_MS;
      const sprobuj = () => {
        przywracanie = null;
        if (!ref.current) return;
        ref.current.scrollTop = cel;
        // Przywrócona pozycja jest od tej chwili „ostatnią znaną" — inaczej sprzątanie efektu
        // zapisałoby wartość sprzed przywrócenia i pozycja cofnęłaby się przy następnym wyjściu.
        ostatniaPozycja = ref.current.scrollTop;
        ostatniKlucz = klucz;
        // Przyjęło się (z tolerancją na zaokrąglenie i na treść odrobinę krótszą niż była)?
        if (Math.abs(ref.current.scrollTop - cel) < 4 || Date.now() > doKiedy) return;
        przywracanie = window.requestAnimationFrame(sprobuj);
      };
      // Pierwsza próba po malowaniu — Next ustawia przewijanie na zero przy nawigacji, więc
      // wcześniejsza próba zostałaby przez niego nadpisana.
      przywracanie = window.requestAnimationFrame(sprobuj);
    };

    /**
     * Cofnięcie w obrębie tej samej ścieżki (zmiana zakładki, filtra) nie przemontowuje ramy, więc
     * przywrócenie musi mieć własne wejście. Zapisujemy przy tym pozycję adresu, Z KTÓREGO
     * wychodzimy — inaczej przepadłaby, bo nie ma tu ani sprzątania efektu, ani zmiany `pathname`.
     */
    const naPowrocie = () => {
      zapamietaj(ostatniKlucz, ostatniaPozycja);
      zuzyjPowrot();
      przywroc();
    };
    window.addEventListener("popstate", naPowrocie);

    // Wejście na widok: przywracamy tylko wtedy, gdy to POWRÓT. Flagi zużywamy zawsze — zapalona
    // flaga przywróciłaby pozycję przy najbliższej zwykłej nawigacji (AC-2).
    const zPopstate = zuzyjPowrot();
    const zDokumentu = zuzyjPowrotDokumentu();
    if (zPopstate || zDokumentu) przywroc();

    return () => {
      el.removeEventListener("scroll", naPrzewiniecie);
      window.removeEventListener("popstate", naPowrocie);
      if (klatka !== null) window.cancelAnimationFrame(klatka);
      if (przywracanie !== null) window.cancelAnimationFrame(przywracanie);
      // Decyzja 2: ostatnia klatka przewijania bywa zjedzona przez nawigację.
      zapamietaj(ostatniKlucz, ostatniaPozycja);
    };
    // `pathname` jest tu po to, żeby przy przejściu między widokami efekt przeszedł pełny cykl:
    // sprzątanie zapisuje pozycję STAREGO widoku, a nowy przebieg przywraca pozycję nowego.
    // Zmiany samego `?query` obsługuje nasłuch `popstate` i odczyt klucza w momencie użycia.
  }, [ref, pathname]);
}
