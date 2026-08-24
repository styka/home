"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useViewChrome } from "./ViewChrome";
import { ViewChromeMenu } from "./ViewChromeMenu";

/**
 * 045 — pasek bieżącego widoku. Trzy strefy:
 *
 *   [ filtry modułu ] … [ akcje modułu ] [ chrom powłoki ]
 *
 * Moduł podaje wyłącznie `filters` i `actions`. Chrom (gwiazdka ulubionych, świeżość
 * danych, ściągawka skrótów) przychodzi z kontekstu wypełnianego przez `AppShell` —
 * moduł o nim nie wie i nie musi go przekazywać. To jest cała istota kontraktu widoku.
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
  /** Ukrycie chromu — dla widoków osadzonych, np. w playgroundzie. */
  hideChrome?: boolean;
  /** Wariant gęsty: tytuł widoku wchodzi do paska zamiast osobnego nagłówka. */
  compact?: boolean;
  title?: string;
  titleHref?: string;
  icon?: ReactNode;
  iconColor?: string;
}

export function ViewBar({ filters, actions, hideChrome, compact, title, titleHref, icon, iconColor }: ViewBarProps) {
  const chrome = useViewChrome();
  /**
   * 084: chrom dzieli się na DWIE grupy, i to jest korekta wobec pierwotnego zamysłu.
   *
   * Plan mówił „wszystkie trzy pod jedną ikonę". Implementacja pokazała, dlaczego to nie działa:
   * gwiazdka ulubionych otwiera WŁASNĄ warstwę (okienko z nazwą widoku), a warstwa w warstwie jest
   * krucha — zamknięcie menu odmontowuje okienko w tej samej klatce, w której się pojawia, a gdy
   * menu zostawić otwarte, pochłania ono pierwsze kliknięcie poza sobą. Zmierzone: trzy testy
   * ulubionych stały się niestabilne.
   *
   * Zostaje więc podział wg CZĘSTOŚCI, nie wg rodzaju: gwiazdka (najczęstsza akcja, własna warstwa)
   * zostaje w pasku, a świeżość danych i ściągawka skrótów — rzeczy, po które sięga się raz na
   * jakiś czas i które niczego nie otwierają — chowają się pod „⋯". Chrom kurczy się z trzech
   * elementów do dwóch, a nie do jednego; zapis widoku nadal kosztuje jedno kliknięcie.
   */
  const chromeItems = hideChrome ? [] : [chrome.freshness, chrome.shortcuts].filter(Boolean);
  const gwiazdka = hideChrome ? null : chrome.favorite;

  // Pusty pasek nie zajmuje miejsca — moduł bez filtrów i akcji, renderowany poza
  // powłoką, nie powinien dostawać pustej listwy z obramowaniem.
  if (!compact && !filters && !actions && chromeItems.length === 0 && !gwiazdka) return null;

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

        {/* 084: chrom powłoki zwinięty do JEDNEJ kontrolki. Kolejność w środku zostaje ta sama,
            żeby ręka trafiała bez patrzenia — zmienia się tylko to, ile miejsca odbiera filtrom. */}
        {(chromeItems.length > 0 || gwiazdka) && (
          <div
            className="md:order-4"
            style={{
              display: "flex",
              alignItems: "center",
              flexShrink: 0,
              paddingLeft: 6,
              marginLeft: 2,
              borderLeft: "var(--border-width) var(--border-style) var(--border)",
            }}
          >
            {gwiazdka}
            <ViewChromeMenu pozycje={chromeItems} />
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
