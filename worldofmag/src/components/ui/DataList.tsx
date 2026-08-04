"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * 045 — lista danych z zaznaczaniem i nawigacją klawiaturą.
 *
 * Omnia jest keyboard-first (C-31), ale `j`/`k` były zaimplementowane osobno w Zadaniach
 * i w Zakupach, a pozostałe listy nie miały ich wcale. `DataList` wyprowadza ten wzorzec
 * raz.
 *
 * PAGINACJI TU CELOWO NIE MA. Paginacja kursorowa to zadanie 20 z Fazy 3 przebudowy —
 * wymaga zmiany zapytań w akcjach, a nie tylko w UI. API jest jednak pod nią zaprojektowane:
 * `onEndReached` czeka gotowe, więc dołożenie doczytywania nie zmieni sygnatury komponentu.
 */

export interface DataListProps<T> {
  items: T[];
  keyOf: (item: T) => string;
  renderItem: (item: T, state: { active: boolean; selected: boolean }) => ReactNode;
  /** Włącza zaznaczanie wielokrotne (`x` / kliknięcie w checkbox). */
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  /** Enter na aktywnym elemencie. */
  onActivate?: (item: T) => void;
  /** Zarezerwowane pod paginację kursorową (Faza 3 przebudowy). */
  onEndReached?: () => void;
  /** Wyłącz obsługę klawiatury, gdy strona ma własną. */
  disableKeyboard?: boolean;
  emptyState?: ReactNode;
}

export function DataList<T>({
  items,
  keyOf,
  renderItem,
  selectable,
  selectedIds,
  onSelectionChange,
  onActivate,
  onEndReached,
  disableKeyboard,
  emptyState,
}: DataListProps<T>) {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Zaznaczenie może być sterowane z zewnątrz (gdy moduł trzyma je w adresie) albo
  // lokalnie. Jedno API, dwa zastosowania.
  const [innerSelected, setInnerSelected] = useState<string[]>([]);
  const selected = selectedIds ?? innerSelected;

  const setSelected = useCallback(
    (next: string[]) => {
      if (selectedIds === undefined) setInnerSelected(next);
      onSelectionChange?.(next);
    },
    [selectedIds, onSelectionChange],
  );

  const toggle = useCallback(
    (id: string) => {
      setSelected(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
    },
    [selected, setSelected],
  );

  // Aktywny indeks przycinany do listy — po usunięciu ostatniego elementu kursor nie
  // może zostać poza zakresem.
  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(0, items.length - 1)));
  }, [items.length]);

  useEffect(() => {
    if (disableKeyboard || items.length === 0) return;

    function onKey(e: KeyboardEvent) {
      // Nie przechwytujemy klawiszy, gdy użytkownik pisze — inaczej `j` w polu wyszukiwania
      // przewijałoby listę zamiast wpisać literę.
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return;
      if (el instanceof HTMLElement && el.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, items.length - 1));
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "x" && selectable) {
        e.preventDefault();
        const item = items[activeIndex];
        if (item) toggle(keyOf(item));
      } else if (e.key === "Enter" && onActivate) {
        const item = items[activeIndex];
        if (item) {
          e.preventDefault();
          onActivate(item);
        }
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, activeIndex, selectable, toggle, keyOf, onActivate, disableKeyboard]);

  // Aktywny wiersz przewijany do widoku — nawigacja klawiaturą po liście dłuższej niż
  // ekran jest bez tego bezużyteczna.
  useEffect(() => {
    const node = containerRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  useEffect(() => {
    if (!onEndReached || items.length === 0) return;
    const node = containerRef.current?.querySelector<HTMLElement>(`[data-index="${items.length - 1}"]`);
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) onEndReached();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [onEndReached, items.length]);

  if (items.length === 0) return <>{emptyState}</>;

  return (
    <div ref={containerRef} role="list" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {items.map((item, index) => {
        const id = keyOf(item);
        const isActive = index === activeIndex;
        const isSelected = selected.includes(id);
        return (
          <div
            key={id}
            role="listitem"
            data-index={index}
            onClick={() => setActiveIndex(index)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              borderRadius: "var(--radius)",
              // Aktywny wiersz sygnalizujemy obwódką, nie tłem: tło koliduje ze stanami
              // własnymi wiersza (ukończone, przeterminowane), a obwódka nie.
              outline: isActive ? "var(--focus-ring-width) solid var(--accent-blue)" : "none",
              outlineOffset: -1,
              background: isSelected ? "var(--bg-hover)" : undefined,
            }}
          >
            {selectable && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggle(id)}
                aria-label="Zaznacz pozycję"
                // 20×20 px — minimum dotykowe z C-31.
                style={{ width: 20, height: 20, flexShrink: 0, marginLeft: 8, cursor: "pointer" }}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>{renderItem(item, { active: isActive, selected: isSelected })}</div>
          </div>
        );
      })}
    </div>
  );
}
