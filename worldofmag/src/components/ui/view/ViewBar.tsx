"use client";

import type { ReactNode } from "react";
import Link from "next/link";

/**
 * 045 — pasek bieżącego widoku. Trzy strefy:
 *
 *   [ filtry modułu ] … [ akcje modułu ] [ chrom powłoki ]
 *
 * Moduł podaje wyłącznie `filters` i `actions`.
 *
 * 085: chromu powłoki (gwiazdka ulubionych, świeżość danych, ściągawka skrótów) TU JUŻ NIE MA.
 * Gwiazdka i ściągawka przeniosły się do rzędu chromu konta — na telefonie do górnego paska obok
 * dzwonka, na komputerze do stopki panelu bocznego — a wskaźnik świeżości został skasowany, bo
 * mierzył moment automatycznego przeładowania strony przez powłokę, a nie świeżość danych modułu.
 * Pasek widoku odzyskał przez to całą swoją szerokość dla zakładek i akcji modułu: to jest
 * zgłoszenie właściciela „ta gwiazdka i info o odświeżeniu zabiera przestrzeń na pasek zakładek".
 *
 * MOBILE (C-31): filtry przewijają się poziomo WE WŁASNYM kontenerze. Przewijanie
 * całej strony w poziomie jest zawsze błędem — a to najczęstszy sposób, w jaki
 * pasek narzędzi je powoduje.
 *
 * Adresu NIE czytamy tu przez `useSearchParams`: w komponencie tak blisko powłoki
 * wymusza on granicę `Suspense` i potrafi zepchnąć aplikację w renderowanie po
 * stronie klienta (lekcja z 042, opisana w `FavoriteStarButton`).
 */

export interface ViewBarProps {
  filters?: ReactNode;
  actions?: ReactNode;
  /** Wariant gęsty: tytuł widoku wchodzi do paska zamiast osobnego nagłówka. */
  compact?: boolean;
  title?: string;
  titleHref?: string;
  icon?: ReactNode;
  iconColor?: string;
}

export function ViewBar({ filters, actions, compact, title, titleHref, icon, iconColor }: ViewBarProps) {
  // Pusty pasek nie zajmuje miejsca — moduł bez filtrów i akcji, renderowany poza
  // powłoką, nie powinien dostawać pustej listwy z obramowaniem.
  if (!compact && !filters && !actions) return null;

  return (
    /**
     * 084: NA TELEFONIE PASEK MA DWA WIERSZE.
     *
     * Zgłoszenie właściciela: „ten pasek z zakładkami to taki wąski jest, że nie widać nazw
     * wszystkich zakładek, a do tego switch wiadomości/linia czasu już nawet rozszerza stronę poza
     * ekran i trzeba scrolować na boki, co jest nieakceptowalne".
     *
     * Przyczyna: w jednym wierszu tytuł, filtry, akcje i chrom dzieliły 360 px, a kurczyć się mogły
     * wyłącznie filtry — więc to one traciły wszystko. Od `md` układ zostaje dokładnie taki jak był
     * (na komputerze miejsca starcza), a niżej filtry dostają WŁASNY wiersz i całą jego szerokość.
     *
     * Świadomie `flex-col md:flex-row`, a nie osobny komponent mobilny: jeden mechanizm na oba
     * ekrany (C-31), więc nie da się poprawić jednego i zapomnieć o drugim.
     */
    <div
      className="flex flex-col md:flex-row md:items-center"
      style={{
        gap: 8,
        minHeight: compact ? 48 : 44,
        paddingTop: compact ? 0 : 8,
        paddingBottom: compact ? 0 : 8,
        borderBottom: "var(--border-width) var(--border-style) var(--border)",
      }}
    >
      {/* Wiersz pierwszy na telefonie: tytuł, akcje modułu i chrom. Na komputerze — po prostu
          początek jedynego wiersza. */}
      {/* `md:contents` rozpuszcza to opakowanie na komputerze, żeby jego dzieci stały się wprost
          elementami paska. Kolejność musi być wtedy podana JAWNIE (`md:order-*`) — bez tego filtry,
          które w drzewie stoją na końcu, wylądowałyby na komputerze za chromem zamiast pośrodku. */}
      <div
        className="flex min-w-0 items-center gap-2 md:contents"
        style={{ minHeight: compact ? 48 : undefined }}
      >
      {/* Wariant gęsty: tytuł w pasku, nie nad nim. */}
      {compact && title && (
        <h1
          className="hidden md:order-1 md:flex items-center gap-2 text-sm font-semibold truncate min-w-0"
          style={{ color: "var(--text-primary)", margin: 0, flexShrink: 0, maxWidth: "40%" }}
        >
          {icon && <span style={{ color: iconColor, display: "flex", flexShrink: 0 }}>{icon}</span>}
          {titleHref ? (
            <Link href={titleHref} className="truncate" style={{ color: "inherit", textDecoration: "none" }}>
              {title}
            </Link>
          ) : (
            <span className="truncate">{title}</span>
          )}
        </h1>
      )}
        {/* Akcje modułu — nie kurczą się. */}
        {actions && (
          <div className="ml-auto md:order-3 md:ml-0" style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {actions}
          </div>
        )}

      </div>

      {/* Filtry — na telefonie WŁASNY wiersz o pełnej szerokości, na komputerze środkowa strefa.
          Przewijanie poziome należy do TEGO kontenera i tylko do niego: przewijanie całej strony
          w bok jest zawsze błędem (C-31), a to jest najczęstszy sposób, w jaki pasek narzędzi je
          powoduje. */}
      <div
        className="order-last md:order-2"
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          alignItems: "center",
          gap: 6,
          overflowX: "auto",
          // Pasek przewijania pod filtrami wyglądałby jak usterka — chowamy go,
          // ale samo przewijanie zostaje (dotyk, trackpad, Shift+kółko).
          scrollbarWidth: "none",
        }}
      >
        {filters}
      </div>
    </div>
  );
}
