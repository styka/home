"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { ConfirmDialog } from "./ConfirmDialog";

/**
 * 045 — `confirm()` aplikacji zamiast `window.confirm()`.
 *
 * Natywne okno przeglądarki było w Omnii w 42 miejscach i ma trzy wady, z których żadna
 * nie jest kosmetyczna: nie zna skórki (pod „Mostkiem" cała aplikacja jest stylizowana,
 * a potwierdzenie usunięcia to szare okno systemowe), etykiety przycisków są w języku
 * SYSTEMU, nie aplikacji, oraz blokuje wątek — więc nie da się przy nim pokazać, co
 * dokładnie zostanie usunięte.
 *
 * Podmiana ma być JEDNOLINIJKOWA w miejscu wywołania, bo inaczej nikt jej nie zrobi
 * w 42 plikach. Stąd API obietnicowe, bliźniaczo podobne do natywnego:
 *
 *     if (!(await confirm("Usunąć listę?"))) return;
 *
 * Okno jest montowane RAZ w powłoce; wywołania z modułów tylko je otwierają.
 */

export interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Domyślnie `true` — najczęstszym potwierdzeniem w aplikacji jest usunięcie. */
  destructive?: boolean;
}

type ConfirmFn = (options: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((input) => {
    const opts: ConfirmOptions = typeof input === "string" ? { title: input } : input;
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  function settle(value: boolean) {
    resolveRef.current?.(value);
    resolveRef.current = null;
    setOptions(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && (
        <ConfirmDialog
          title={options.title}
          description={options.description}
          confirmLabel={options.confirmLabel ?? (options.destructive === false ? "Potwierdź" : "Usuń")}
          cancelLabel={options.cancelLabel}
          destructive={options.destructive !== false}
          onConfirm={() => settle(true)}
          onCancel={() => settle(false)}
        />
      )}
    </ConfirmContext.Provider>
  );
}

/**
 * Zwraca funkcję potwierdzenia. Poza providerem degraduje do `window.confirm`, zamiast
 * rzucać — komponent użyty w oderwaniu od powłoki (test, playground) ma działać, a nie
 * wywalać aplikację przy pierwszym kliknięciu „Usuń".
 */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  return (
    ctx ??
    ((input) => {
      const opts = typeof input === "string" ? { title: input } : input;
      return Promise.resolve(typeof window !== "undefined" && window.confirm(opts.title));
    })
  );
}
