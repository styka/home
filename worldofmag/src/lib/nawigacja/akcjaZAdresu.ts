"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * 103: AKCJA WYRAŻONA ADRESEM — jedna konwencja dla całej aplikacji.
 *
 * Właściciel poprosił, żeby gest w dolnym pasku umiał nie tylko przenieść do modułu, ale też
 * „wywołać akcję która jest głębiej w module" (np. dodanie projektu w Zadaniach), i wybrał wariant,
 * w którym **akcję niesie adres**, a nie kod wykonywany przez powłokę.
 *
 * Dlaczego jedna konwencja `?akcja=<nazwa>`, a nie prywatny parametr per moduł: prywatnych
 * parametrów byłoby dwadzieścia i nikt — ani autor szybkiego celu, ani użytkownik zapisujący
 * ulubiony widok — nie umiałby ich przewidzieć. Przy jednej konwencji adres jest czytelny
 * (`/tasks?akcja=nowy-projekt`), **favouritowalny** i działa z linku dokładnie tak samo jak
 * z gestu — a to jest kryterium AC-20, nie kosmetyka.
 *
 * Dlaczego `zamknij()` czyści parametr: bez tego zapisany w ulubionych adres z akcją odtwarzałby
 * formularz przy każdym wejściu, a zamknięcie okna zostawiałoby widok „zawieszony" w stanie, który
 * mówi co innego niż to, co widać. Stan widoku w adresie ma być prawdziwy — ta sama reguła, którą
 * 084/087 wprowadziły w Wiadomościach.
 *
 * Nazwa zaczyna się od `use` mimo polskiego nazewnictwa reszty — to nie jest niekonsekwencja,
 * tylko wymóg reguły `react-hooks/rules-of-hooks`, która rozpoznaje hooki wyłącznie po tym
 * przedrostku. Ten sam kompromis noszą `useHistoriaNawigacji` i `useUlubioneBiezacego`.
 *
 * `router.replace`, nie `push`: sprzątanie adresu nie jest krokiem nawigacji i nie ma prawa
 * dokładać wpisu do historii przeglądarki (ani do wachlarza historii — zobaczyłoby się tam dwa
 * wpisy na tę samą stronę, różniące się wyłącznie parametrem).
 */
export const PARAM_AKCJI = "akcja";

export function useAkcjaZAdresu(nazwa: string): { aktywna: boolean; zamknij: () => void } {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const aktywna = searchParams.get(PARAM_AKCJI) === nazwa;

  const zamknij = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (!params.has(PARAM_AKCJI)) return;
    params.delete(PARAM_AKCJI);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [router, pathname, searchParams]);

  return { aktywna, zamknij };
}
