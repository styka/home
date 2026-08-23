"use client";

// 083: przełącznik POKAZYWANIA kosztów AI przy treściach — preferencja widokowa administratora.
//
// Dlaczego `localStorage`, a nie kolumna w bazie: to nie są dane użytkownika, tylko sposób
// oglądania aplikacji przez jedną osobę na jednej maszynie. Kolumna oznaczałaby migrację, akcję
// serwerową i odczyt przy każdym renderze powłoki — za coś, co nie musi przeżyć zmiany urządzenia.
//
// Co NIE jest tutaj rozstrzygane: czy administrator w ogóle dostaje dane o koszcie. To decyduje
// serwer (`visibleUsage`: uprawnienie administratora ∧ `Config.ai_cost_badge_enabled`) i ta decyzja
// zostaje strukturalna — konto bez `module.admin` nie dostaje modeli ani tokenów na drut. Ten
// przełącznik steruje wyłącznie RYSOWANIEM tego, co administrator i tak już ma.

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

const KLUCZ = "omnia.pokazKoszty";

interface Kontekst {
  /** Czy przełącznik jest w ogóle dostępny (administrator + systemowy wyłącznik). */
  dostepne: boolean;
  pokazuj: boolean;
  przelacz: () => void;
}

const KosztKontekst = createContext<Kontekst>({ dostepne: false, pokazuj: false, przelacz: () => {} });

/**
 * Odczyt i zapis w `try/catch`: prywatne okno, wyczyszczone dane witryny i przeglądarka
 * z zablokowanym magazynem to **poprawne stany**, a nie błędy. Brak wartości = wyłączone.
 */
function odczytaj(): boolean {
  try {
    return window.localStorage.getItem(KLUCZ) === "1";
  } catch {
    return false;
  }
}

export function PokazKosztyProvider({ dostepne, children }: { dostepne: boolean; children: ReactNode }) {
  const [pokazuj, setPokazuj] = useState(false);

  // Odczyt dopiero po zamontowaniu — serwer nie zna `localStorage`, a rozbieżność między
  // renderem serwera a klienta zrywałaby hydratację.
  useEffect(() => {
    if (dostepne) setPokazuj(odczytaj());
  }, [dostepne]);

  const przelacz = useCallback(() => {
    setPokazuj((poprzednio) => {
      const nowa = !poprzednio;
      try {
        window.localStorage.setItem(KLUCZ, nowa ? "1" : "0");
      } catch {
        /* brak zapisu nie może przerwać przełączenia — wybór zostaje do końca sesji */
      }
      return nowa;
    });
  }, []);

  return (
    <KosztKontekst.Provider value={{ dostepne, pokazuj: dostepne && pokazuj, przelacz }}>
      {children}
    </KosztKontekst.Provider>
  );
}

export function usePokazKoszty(): Kontekst {
  return useContext(KosztKontekst);
}
