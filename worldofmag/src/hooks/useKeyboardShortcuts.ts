import { useEffect, useMemo } from "react";
import type { ShortcutHandlers } from "@/types";
import { isTypingTarget, matchShortcut } from "@/lib/shortcuts/registry";
import {
  useShortcuts,
  useShortcutsRegistry,
  type RegisteredShortcut,
} from "@/components/shell/ShortcutsProvider";

/**
 * Skróty klawiszowe strony modułu.
 *
 * 043: sygnatura (`ShortcutHandlers`) jest **niezmieniona** — żaden z kilkunastu modułów wołających
 * ten hook nie wymagał zmian (C-53). Zmieniło się wnętrze: zamiast własnego `switch (e.key)` hook
 * **rejestruje skróty w `ShortcutsProvider`**. Powody:
 *
 *  1. Stary `switch` nie sprawdzał modyfikatorów, więc `Alt+1` przełączał zakładkę filtra
 *     RÓWNOCZEŚNIE ze skokiem do ulubionego (błąd zgłoszony przez właściciela). Teraz dopasowanie
 *     idzie przez `matchShortcut`, gdzie goły klawisz wymaga braku Alt/Ctrl/Meta.
 *  2. Skróty strony mają **pierwszeństwo** przed globalnymi — czego dwa niezależne listenery na
 *     `window` nie potrafią zapewnić (strona montuje się po powłoce, więc odpalałaby się druga).
 *  3. Ściągawka (`?`) czyta listę z rejestru, więc pokazuje to, co naprawdę działa.
 *
 * Gdy prowidera nie ma (izolowany render, test jednostkowy), hook degraduje się do własnego
 * nasłuchiwacza z **tą samą** logiką dopasowania — zachowanie nie zależy od obecności powłoki.
 */
export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  const registry = useShortcutsRegistry();

  const entries = useMemo<RegisteredShortcut[]>(() => {
    const out: RegisteredShortcut[] = [];
    const add = (
      id: string,
      keys: string,
      label: string,
      group: string,
      handler: () => boolean | void,
      opts?: { whileTyping?: boolean; hidden?: boolean },
    ) => {
      out.push({ id, keys, label, group, scope: "page", handler, ...opts });
    };

    // Klawisze aktywne także podczas pisania — muszą działać z fokusem w polu tekstowym.
    if (handlers.onEscape) {
      add("esc", "Escape", "Zamknij / anuluj", "Ogólne", () => { handlers.onEscape?.(); }, { whileTyping: true });
    }
    if (handlers.onCommandPalette) {
      add("palette", "Ctrl+K", "Paleta poleceń", "Ogólne", () => { handlers.onCommandPalette?.(); }, { whileTyping: true });
      // macOS — właściciel pracuje na Macu, więc Cmd musi działać tak samo. Ukryte w ściągawce,
      // żeby nie dublować tego samego wiersza.
      add("palette-meta", "Meta+K", "Paleta poleceń", "Ogólne", () => { handlers.onCommandPalette?.(); }, { whileTyping: true, hidden: true });
    }

    if (handlers.onQuickAdd) {
      add("add", "a", "Dodaj nowy element", "Działanie", () => { handlers.onQuickAdd?.(); });
      add("add-n", "n", "Dodaj nowy element", "Działanie", () => { handlers.onQuickAdd?.(); }, { hidden: true });
    }
    if (handlers.onNavigateDown) {
      add("down", "j", "Następny element", "Nawigacja", () => { handlers.onNavigateDown?.(); });
      add("down-arrow", "ArrowDown", "Następny element", "Nawigacja", () => { handlers.onNavigateDown?.(); }, { hidden: true });
    }
    if (handlers.onNavigateUp) {
      add("up", "k", "Poprzedni element", "Nawigacja", () => { handlers.onNavigateUp?.(); });
      add("up-arrow", "ArrowUp", "Poprzedni element", "Nawigacja", () => { handlers.onNavigateUp?.(); }, { hidden: true });
    }
    if (handlers.onToggleStatus) {
      add("toggle", "x", "Zmień status", "Działanie", () => { handlers.onToggleStatus?.(); });
      add("toggle-space", "Space", "Zmień status", "Działanie", () => { handlers.onToggleStatus?.(); }, { hidden: true });
    }
    if (handlers.onDelete) {
      add("delete", "d", "Usuń", "Działanie", () => { handlers.onDelete?.(); });
      add("delete-key", "Delete", "Usuń", "Działanie", () => { handlers.onDelete?.(); }, { hidden: true });
      // Backspace poza polem tekstowym = usuń (pisanie odsiewa `whileTyping`).
      add("delete-back", "Backspace", "Usuń", "Działanie", () => { handlers.onDelete?.(); }, { hidden: true });
    }
    if (handlers.onEdit) {
      add("edit", "e", "Edytuj", "Działanie", () => { handlers.onEdit?.(); });
    }
    if (handlers.onEnter) {
      add("open", "Enter", "Otwórz zaznaczony element", "Nawigacja", () => {
        // Nie przejmujemy Entera, gdy fokus jest na realnej kontrolce — niech zadziała natywnie.
        const ae = document.activeElement;
        const tag = ae?.tagName.toLowerCase();
        const interactive = tag === "button" || tag === "a" || tag === "select" || ae?.getAttribute("role") === "button";
        if (interactive) return false;
        handlers.onEnter?.();
      });
    }
    if (handlers.onSearch) {
      add("search", "/", "Szukaj", "Widok", () => { handlers.onSearch?.(); });
      add("search-f", "f", "Szukaj", "Widok", () => { handlers.onSearch?.(); }, { hidden: true });
    }
    if (handlers.onFilterTab) {
      for (let i = 0; i < 5; i++) {
        add(`tab-${i}`, String(i + 1), `Zakładka filtra ${i + 1}`, "Widok", () => { handlers.onFilterTab?.(i); });
      }
    }

    return out;
  }, [handlers]);

  // Ścieżka podstawowa: rejestracja w powłoce (pierwszeństwo strony + ściągawka).
  // `useShortcuts` trzyma wpisy w referencji i rejestruje je raz, więc niestabilna tablica
  // niczego nie psuje — a bez prowidera hook i tak nic nie robi.
  useShortcuts(entries);

  // Ścieżka awaryjna: brak prowidera → własny nasłuchiwacz z tą samą logiką dopasowania.
  useEffect(() => {
    if (registry) return;
    function onKeyDown(e: KeyboardEvent) {
      const typing = isTypingTarget(document.activeElement);
      for (const entry of entries) {
        if (typing && !entry.whileTyping) continue;
        if (!matchShortcut(e, entry.keys)) continue;
        if (entry.handler(e) === false) continue;
        e.preventDefault();
        return;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [registry, entries]);
}
