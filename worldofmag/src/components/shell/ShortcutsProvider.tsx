"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { isTypingTarget, matchShortcut, type ShortcutDef } from "@/lib/shortcuts/registry";

/** Handler zwracający `false` = „nie obsłużyłem" → dyspozytor szuka dalej i nie blokuje klawisza. */
export type ShortcutHandler = (e: KeyboardEvent) => boolean | void;

export interface RegisteredShortcut extends ShortcutDef {
  handler: ShortcutHandler;
  /** Czy skrót działa także wtedy, gdy fokus jest w polu tekstowym (Esc, Ctrl+K). */
  whileTyping?: boolean;
  /** Wariant alternatywny (np. `Cmd+K` obok `Ctrl+K`) — działa, ale nie zaśmieca ściągawki. */
  hidden?: boolean;
}

interface ShortcutsContextValue {
  register: (entries: RegisteredShortcut[]) => () => void;
  /** Migawka zarejestrowanych skrótów — źródło ściągawki (AC-11). */
  shortcuts: ShortcutDef[];
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
 * Drugi powód istnienia rejestru: ściągawka (`ShortcutsCheatSheet`) czyta listę stąd, więc
 * nie może się rozjechać z tym, co faktycznie działa.
 */
export function ShortcutsProvider({ children }: { children: React.ReactNode }) {
  const registry = useRef(new Map<number, RegisteredShortcut[]>());
  const [shortcuts, setShortcuts] = useState<ShortcutDef[]>([]);

  /** Migawka do ściągawki — trzymana w stanie, żeby nakładka przerysowała się po zmianie strony. */
  const publish = useCallback(() => {
    const flat: ShortcutDef[] = [];
    const seen = new Set<string>();
    for (const entries of Array.from(registry.current.values())) {
      for (const entry of entries) {
        if (entry.hidden) continue;
        const key = `${entry.scope}:${entry.keys}`;
        if (seen.has(key)) continue;
        seen.add(key);
        flat.push({ id: entry.id, keys: entry.keys, label: entry.label, group: entry.group, scope: entry.scope });
      }
    }
    setShortcuts(flat);
  }, []);

  const register = useCallback((entries: RegisteredShortcut[]) => {
    const id = nextRegistrationId++;
    registry.current.set(id, entries);
    publish();
    return () => {
      registry.current.delete(id);
      publish();
    };
  }, [publish]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const typing = isTypingTarget(document.activeElement);

      // Strona przed globalnymi — to jest cała reguła pierwszeństwa.
      const candidates: RegisteredShortcut[] = [];
      for (const entries of Array.from(registry.current.values())) {
        for (const entry of entries) {
          if (entry.scope === "page") candidates.push(entry);
        }
      }
      for (const entries of Array.from(registry.current.values())) {
        for (const entry of entries) {
          if (entry.scope === "global") candidates.push(entry);
        }
      }

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

  const value = useMemo<ShortcutsContextValue>(() => ({ register, shortcuts }), [register, shortcuts]);

  return <ShortcutsContext.Provider value={value}>{children}</ShortcutsContext.Provider>;
}

/** `null`, gdy komponent renderuje się poza powłoką (np. w izolowanym teście). */
export function useShortcutsRegistry(): ShortcutsContextValue | null {
  return useContext(ShortcutsContext);
}

/**
 * Rejestruje zestaw skrótów na czas życia komponentu.
 *
 * `entries` musi być stabilne między renderami (`useMemo`) — inaczej rejestracja odtwarzałaby się
 * przy każdym renderze. Wszystkie wywołania w repo idą przez `useKeyboardShortcuts`, który już
 * przyjmuje zmemoizowany obiekt handlerów.
 */
export function useShortcuts(entries: RegisteredShortcut[]): void {
  const ctx = useContext(ShortcutsContext);
  const register = ctx?.register;

  useEffect(() => {
    if (!register || entries.length === 0) return;
    return register(entries);
  }, [register, entries]);
}
