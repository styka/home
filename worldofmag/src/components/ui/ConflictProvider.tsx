"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Modal } from "./Modal";

/**
 * 066 (zadanie 16) — OKNO KONFLIKTU (rozdz. 8.5.2).
 *
 * 062 sprawił, że zapis oparty na nieaktualnym odczycie **nie przechodzi**. To rozwiązało
 * poprawność, ale nie użytkownika: dostawał surowy błąd i tracił to, co napisał.
 *
 * Rozdz. 8.5.2 stawia zasadę, którą to okno realizuje: *„konflikt nigdy nie kończy się utratą
 * pracy użytkownika bez jego świadomej decyzji"*. Stąd trzy wyjścia zamiast „OK":
 * **nadpisz moją wersją**, **odrzuć moje zmiany**, **wróć do edycji**. Żadne z nich nie jest
 * domyślne i żadne nie wykonuje się samo.
 *
 * **Dlaczego to nie jest `confirm` z inną treścią.** Potwierdzenie ma dwa wyjścia i jedno
 * z nich jest bezpieczne (anuluj). Tu **każde** wyjście coś kosztuje: nadpisanie kasuje cudzą
 * pracę, odrzucenie — własną. Dlatego przycisk „odrzuć" zapisuje wersję odrzuconą do kosza
 * (rozdz. 8.5.2), a użytkownik dostaje trzecią drogę: wrócić i przeczytać, co się zmieniło.
 *
 * **Czego tu ŚWIADOMIE nie ma:** widoku różnic i scalania ręcznego. Jedno i drugie wymaga
 * porównywania **pól konkretnego modułu** — okno platformy nie wie, czym jest „termin" ani
 * „status", a udawanie, że wie, skończyłoby się mapą pól na typ zasobu wewnątrz platformy
 * (dokładnie tego zakazuje C-36). Rozwiązaniem jest przekazywanie gotowego opisu zmian przez
 * `podsumowanieZmian` — moduł, który je poda, dostanie je w oknie; dopóki nie poda, okno mówi
 * prawdę: „ktoś zmienił ten element".
 */

export interface ConflictOptions {
  /** Co się zmieniło, w słowach modułu. Bez tego okno mówi tylko, ŻE się zmieniło. */
  podsumowanieZmian?: ReactNode;
  /** Etykieta zasobu — „zadanie", „notatka". Trafia do zdania, więc mianownik, małą literą. */
  zasob?: string;
}

/** Decyzja użytkownika. `wroc` = nie robimy nic, użytkownik zostaje w edytorze. */
export type ConflictDecision = "nadpisz" | "odrzuc" | "wroc";

type ConflictFn = (options?: ConflictOptions) => Promise<ConflictDecision>;

const ConflictContext = createContext<ConflictFn | null>(null);

export function ConflictProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConflictOptions | null>(null);
  const resolveRef = useRef<((v: ConflictDecision) => void) | null>(null);

  const askConflict = useCallback<ConflictFn>((opts) => {
    // Ten sam problem, co w `ConfirmProvider`: drugie wywołanie przed rozstrzygnięciem
    // pierwszego zostawiłoby tamtą obietnicę na zawsze — a `await` na niej siedzi w handlerze
    // zapisu. Domykamy poprzednie „powrotem do edycji", bo to jedyne wyjście, które niczego
    // nie niszczy.
    resolveRef.current?.("wroc");
    setOptions(opts ?? {});
    return new Promise<ConflictDecision>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  function settle(v: ConflictDecision) {
    resolveRef.current?.(v);
    resolveRef.current = null;
    setOptions(null);
  }

  return (
    <ConflictContext.Provider value={askConflict}>
      {children}
      {options && (
        <Modal open onClose={() => settle("wroc")} title="Ktoś zmienił to w międzyczasie">
          <div className="flex flex-col gap-4">
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {options.podsumowanieZmian ?? (
                <>
                  Ktoś zmienił {options.zasob ?? "ten element"}, zanim zapisałeś swoje zmiany.
                  Twoja praca nie została utracona — wybierz, co zrobić.
                </>
              )}
            </p>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => settle("wroc")}
                className="w-full text-sm px-3 py-3 rounded text-left"
                style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-primary)" }}
              >
                <span className="font-medium">Wróć do edycji</span>
                <span className="block text-xs" style={{ color: "var(--text-muted)" }}>
                  Nic się nie zapisze. Zobaczysz, co się zmieniło, i zdecydujesz później.
                </span>
              </button>

              <button
                onClick={() => settle("nadpisz")}
                className="w-full text-sm px-3 py-3 rounded text-left"
                style={{ backgroundColor: "var(--accent-amber)", color: "var(--on-accent)" }}
              >
                <span className="font-medium">Nadpisz moją wersją</span>
                <span className="block text-xs" style={{ opacity: 0.85 }}>
                  Cudze zmiany zostaną zastąpione twoimi.
                </span>
              </button>

              <button
                onClick={() => settle("odrzuc")}
                className="w-full text-sm px-3 py-3 rounded text-left"
                style={{ backgroundColor: "var(--bg-hover)", color: "var(--text-secondary)" }}
              >
                <span className="font-medium">Odrzuć moje zmiany</span>
                <span className="block text-xs" style={{ color: "var(--text-muted)" }}>
                  Trafią do kosza — będzie można do nich wrócić.
                </span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </ConflictContext.Provider>
  );
}

/**
 * Zachowanie POZA powłoką — wyprowadzone z hooka, żeby dało się je sprawdzić testem bez Reacta.
 *
 * **Nie** degraduje do „nadpisz" ani do `window.confirm`: cichy wybór za użytkownika łamie zasadę
 * z rozdz. 8.5.2. Degraduje do `"wroc"` — jedynego wyjścia, którego nie trzeba cofać. Gdyby ktoś
 * kiedyś uznał, że „nadpisz" jest wygodniejszym domyślnym, komponent użyty bez providera zacząłby
 * kasować cudzą pracę bez pytania.
 */
export const konfliktPozaPowloka: ConflictFn = () => Promise.resolve<ConflictDecision>("wroc");

/** Zwraca funkcję pytania o konflikt; poza providerem — `konfliktPozaPowloka`. */
export function useConflict(): ConflictFn {
  const ctx = useContext(ConflictContext);
  return ctx ?? konfliktPozaPowloka;
}
