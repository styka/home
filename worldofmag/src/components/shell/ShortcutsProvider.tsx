"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { isTypingTarget, matchShortcut, type ShortcutDef } from "@/platform/shortcuts/registry";

/** Handler zwracający `false` = „nie obsłużyłem" → dyspozytor szuka dalej i nie blokuje klawisza. */
export type ShortcutHandler = (e: KeyboardEvent) => boolean | void;

export interface RegisteredShortcut extends ShortcutDef {
  handler: ShortcutHandler;
  /** Czy skrót działa także wtedy, gdy fokus jest w polu tekstowym (Esc, Ctrl+K). */
  whileTyping?: boolean;
  /** Wariant alternatywny (np. `Cmd+K` obok `Ctrl+K`) — działa, ale nie zaśmieca ściągawki. */
  hidden?: boolean;
}

/** Rejestrujemy REFERENCJĘ do tablicy, nie tablicę — patrz komentarz przy `useShortcuts`. */
type EntriesRef = { current: RegisteredShortcut[] };

interface ShortcutsContextValue {
  register: (entries: EntriesRef) => () => void;
  /** Migawka zarejestrowanych skrótów, liczona NA ŻĄDANIE — źródło ściągawki (AC-11). */
  getShortcuts: () => ShortcutDef[];
}

const ShortcutsContext = createContext<ShortcutsContextValue | null>(null);

let nextRegistrationId = 0;

/**
 * 043: JEDEN globalny nasłuchiwacz klawiatury z rejestrem i pierwszeństwem skrótów strony.
 *
 * Dlaczego jeden, a nie dwa listenery na `window`: komponent strony montuje się PO powłoce, więc
 * jego listener odpalałby się jako drugi — pierwszeństwa strony nie da się w ten sposób uzyskać.
 * Przy jednym dyspozytorze kolejność jest jawna: `scope: "page"` przed `scope: "global"`.
 *
 * **Prowider świadomie NIE MA STANU.** Pierwsza wersja trzymała listę skrótów w `useState` i
 * publikowała ją przy każdej (wy)rejestracji — co przy komponencie przekazującym niestabilną
 * tablicę dawało pętlę „rejestracja → nowy stan → render → nowa tablica → rejestracja…". Objaw był
 * mylący: aplikacja renderowała się bez końca i **gubiła kliknięcia** (w klikaczach padał zupełnie
 * niezwiązany test przełącznika ulubionych). Skoro ściągawka potrzebuje listy tylko w momencie
 * otwarcia, liczymy ją na żądanie — i cała klasa błędu znika.
 */
export function ShortcutsProvider({ children }: { children: React.ReactNode }) {
  const registry = useRef(new Map<number, EntriesRef>());

  const register = useCallback((entries: EntriesRef) => {
    const id = nextRegistrationId++;
    registry.current.set(id, entries);
    return () => { registry.current.delete(id); };
  }, []);

  const getShortcuts = useCallback((): ShortcutDef[] => {
    const flat: ShortcutDef[] = [];
    const seen = new Set<string>();
    for (const ref of Array.from(registry.current.values())) {
      for (const entry of ref.current) {
        if (entry.hidden) continue;
        const key = `${entry.scope}:${entry.keys}`;
        if (seen.has(key)) continue;
        seen.add(key);
        flat.push({ id: entry.id, keys: entry.keys, label: entry.label, group: entry.group, scope: entry.scope });
      }
    }
    return flat;
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const typing = isTypingTarget(document.activeElement);

      // Strona przed globalnymi — to jest cała reguła pierwszeństwa.
      const candidates: RegisteredShortcut[] = [];
      const refs = Array.from(registry.current.values());
      for (const ref of refs) for (const entry of ref.current) if (entry.scope === "page") candidates.push(entry);
      for (const ref of refs) for (const entry of ref.current) if (entry.scope === "global") candidates.push(entry);

      for (const entry of candidates) {
        if (typing && !entry.whileTyping) continue;
        if (!matchShortcut(e, entry.keys)) continue;
        if (entry.handler(e) === false) continue;
        e.preventDefault();
        return;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Wartość kontekstu jest STAŁA (obie funkcje z pustą listą zależności) — zmiana rejestru nigdy
  // nie przerysowuje konsumentów.
  const value = useMemo<ShortcutsContextValue>(() => ({ register, getShortcuts }), [register, getShortcuts]);

  return <ShortcutsContext.Provider value={value}>{children}</ShortcutsContext.Provider>;
}

/** `null`, gdy komponent renderuje się poza powłoką (np. w izolowanym teście). */
export function useShortcutsRegistry(): ShortcutsContextValue | null {
  return useContext(ShortcutsContext);
}

/**
 * Rejestruje zestaw skrótów na czas życia komponentu.
 *
 * `entries` **nie musi być stabilne** — trzymamy je w referencji odświeżanej przy każdym renderze,
 * a rejestracja dzieje się raz (przy montowaniu). Dzięki temu handlery zawsze widzą aktualne
 * domknięcia, a niestabilna tablica nie powoduje ani ponownych rejestracji, ani pętli renderów.
 */
export function useShortcuts(entries: RegisteredShortcut[]): void {
  const ctx = useContext(ShortcutsContext);
  const register = ctx?.register;

  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  useEffect(() => {
    if (!register) return;
    return register(entriesRef);
  }, [register]);
}
