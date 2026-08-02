"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { FavoriteViewDTO } from "@/lib/favorites/favoriteViews";

interface FavoritesShortcutsProps {
  /** Ulubione JUŻ przefiltrowane po uprawnieniach (AC-8) — skrót nie może omijać RBAC. */
  favorites: FavoriteViewDTO[];
  /** Otwarcie pełnej listy (Alt+0). */
  onOpenSwitcher: () => void;
}

/** To samo kryterium co `isTypingTarget` w `useKeyboardShortcuts` — nie przechwytujemy pisania. */
function isTypingTarget(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || el.getAttribute("contenteditable") === "true";
}

/**
 * 042: `Alt+1..9` skacze do n-tego ulubionego, `Alt+0` otwiera pełną listę.
 *
 * Listener jest globalny i montowany raz w powłoce — istniejący `useKeyboardShortcuts` jest
 * wołany per strona modułu, więc nie nadaje się do skrótu działającego wszędzie.
 *
 * KLUCZOWY WARUNEK: `!e.ctrlKey`. Na klawiaturze polskiej **AltGr to Ctrl+Alt** i służy do
 * wpisywania `ą ć ę ł ń ó ś ź ż`. Bez wykluczenia `ctrlKey` skrót przechwytywałby wpisywanie
 * polskich znaków — w aplikacji, której cały interfejs jest po polsku (C-32). Dlatego reagujemy
 * wyłącznie na czysty Alt, a dodatkowo milczymy, gdy użytkownik pisze w polu tekstowym.
 */
export function FavoritesShortcuts({ favorites, onOpenSwitcher }: FavoritesShortcutsProps) {
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      if (isTypingTarget(document.activeElement)) return;

      // `e.code` ("Digit1"), nie `e.key` — przy wciśniętym Alt układ klawiatury potrafi zwrócić
      // w `key` znak specjalny zamiast cyfry.
      const match = /^Digit([0-9])$/.exec(e.code);
      if (!match) return;

      const digit = Number(match[1]);
      if (digit === 0) {
        e.preventDefault();
        onOpenSwitcher();
        return;
      }

      const target = favorites[digit - 1];
      if (!target) return;
      e.preventDefault();
      router.push(target.path);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [favorites, router, onOpenSwitcher]);

  return null;
}
