"use client";

// 085 (AC-8..AC-11) — TRYB ADMINISTRATORA: czy w zwykłych widokach pokazujemy to, co widzi
// wyłącznie administrator.
//
// Poprzednik (083, `kosztWidocznosc`) sterował JEDNĄ rzeczą — wskaźnikiem kosztu AI. Zgłoszenie
// właściciela: „chcę, żeby admin widział strony tak jak widzi użytkownik", czyli żeby jeden
// przełącznik chował całą warstwę dodatków (koszty, powiadomienia o koszcie, pływający przycisk
// zgłaszania, administracyjny eksport listy zadań), a nie jej jedną czwartą.
//
// Dlaczego `localStorage`, a nie kolumna w bazie: to nie są dane użytkownika, tylko sposób
// oglądania aplikacji przez jedną osobę na jednej maszynie. Kolumna oznaczałaby migrację, akcję
// serwerową i odczyt przy każdym renderze powłoki — za coś, co nie musi przeżyć zmiany urządzenia.
//
// Co NIE jest tutaj rozstrzygane: czy administrator w ogóle DOSTAJE dane o koszcie. To decyduje
// serwer (`visibleUsage`: uprawnienie administratora ∧ `Config.ai_cost_badge_enabled`) i ta decyzja
// zostaje strukturalna — konto bez `module.admin` nie dostaje modeli ani tokenów na drut. Ten
// przełącznik steruje wyłącznie RYSOWANIEM tego, co administrator i tak już ma. Dlatego jego
// DOSTĘPNOŚĆ zależy od samego `isAdmin`, a nie od systemowego wyłącznika kosztów: inaczej zgaszenie
// kosztów zabierałoby administratorowi możliwość ukrycia wszystkiego pozostałego.

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

// Nowy klucz, świadomie: `omnia.pokazKoszty` znaczyło „pokaż koszty", a nie „pokaż wszystko dla
// administratora". Start od wartości domyślnej (wyłączone) jest tu właściwy — o taki stan wyjściowy
// prosi zgłoszenie.
const KLUCZ = "omnia.trybAdmina";

interface Kontekst {
  /** Czy przełącznik jest w ogóle dostępny (konto administratora). */
  dostepne: boolean;
  /** Czy dodatki dla administratora mają być rysowane. */
  wlaczony: boolean;
  przelacz: () => void;
}

const TrybKontekst = createContext<Kontekst>({ dostepne: false, wlaczony: false, przelacz: () => {} });

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

export function TrybAdminaProvider({ dostepne, children }: { dostepne: boolean; children: ReactNode }) {
  const [wlaczony, setWlaczony] = useState(false);

  // Odczyt dopiero po zamontowaniu — serwer nie zna `localStorage`, a rozbieżność między
  // renderem serwera a klienta zrywałaby hydratację.
  useEffect(() => {
    if (dostepne) setWlaczony(odczytaj());
  }, [dostepne]);

  const przelacz = useCallback(() => {
    setWlaczony((poprzednio) => {
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
    <TrybKontekst.Provider value={{ dostepne, wlaczony: dostepne && wlaczony, przelacz }}>
      {children}
    </TrybKontekst.Provider>
  );
}

export function useTrybAdmina(): Kontekst {
  return useContext(TrybKontekst);
}
