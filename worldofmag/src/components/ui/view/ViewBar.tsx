"use client";

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { Settings2 } from "lucide-react";

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
  /** 087 (AC-7, AC-8): wejście do ustawień modułu — ostatnia pozycja strefy akcji. */
  settings?: { onClick?: () => void; href?: string; active?: boolean; label?: string };
  /** Wariant gęsty: tytuł widoku wchodzi do paska zamiast osobnego nagłówka. */
  compact?: boolean;
  title?: string;
  titleHref?: string;
  icon?: ReactNode;
  iconColor?: string;
}

export function ViewBar({ filters, actions, settings, compact, title, titleHref, icon, iconColor }: ViewBarProps) {
  // Pusty pasek nie zajmuje miejsca — moduł bez filtrów i akcji, renderowany poza
  // powłoką, nie powinien dostawać pustej listwy z obramowaniem.
  if (!compact && !filters && !actions && !settings) return null;

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
      {/**
       * 099 (AC-14): wiersz, który na telefonie nie ma CO pokazać, nie może zajmować miejsca.
       *
       * Poniżej `md` tytuł jest ukryty (`hidden md:flex`), więc jedyną treścią tego wiersza są
       * akcje i ustawienia. Widok, który ich nie ma (Zadania: `density="compact"` i same filtry),
       * dostawał pustą listwę 48 px pod nazwą modułu — właściciel zgłosił ją jako „pustą linię na
       * mobile". `hidden md:contents` usuwa wiersz tam, gdzie jest pusty, a od `md` przywraca
       * DOKŁADNIE dotychczasowy układ (AC-15): `display: contents` rozpuszcza opakowanie i jego
       * dzieci wracają na swoje miejsca w pasku.
       */}
      <div
        className={(actions || settings) ? "flex min-w-0 items-center gap-2 md:contents" : "hidden md:contents"}
        style={{ minHeight: compact && (actions || settings) ? 48 : undefined }}
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
        {/**
         * Akcje modułu — na komputerze nie kurczą się, na telefonie zajmują CAŁY wiersz.
         *
         * 087 (AC-6): do 087 ten wiersz miał `ml-auto` i nic więcej, a tytuł jest poniżej `md`
         * ukryty — więc na telefonie stały w nim wyłącznie akcje, dosunięte do prawej krawędzi
         * z pustą lewą połową. Zmierzone przy 360 px: „Nowy temat" zaczynał się na 202 px przy
         * pasku 0..360. Zgłoszenie właściciela: „dziwnie wygląda z dosuniętymi akcjami do prawej,
         * zostawiając dużo miejsca z lewej".
         *
         * Poniżej `md` wiersz i jego dzieci rozciągają się na całą szerokość (przy okazji: większe
         * cele dotyku, C-31). Od `md` wszystko wraca do stanu sprzed zmiany — `md:flex-none`,
         * `md:ml-0` i dzieci bez rozciągania.
         */}
        {(actions || settings) && (
          <div className="ml-auto flex flex-1 items-center gap-1.5 [&>*]:flex-1 md:order-3 md:ml-0 md:flex-none md:shrink-0 md:[&>*]:flex-none">
            {actions}
            {settings && <PrzyciskUstawien {...settings} />}
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

/**
 * 087 (AC-7, AC-8): wejście do ustawień modułu rysowane przez RAMĘ, nie przez moduł.
 *
 * Dzięki temu każdy moduł, który zadeklaruje `settings`, dostaje je w tym samym miejscu i w tym
 * samym kształcie — bez ani jednej linijki u siebie. `aria-pressed` jest tu istotne, a nie
 * ozdobne: ten sam przycisk WCHODZI do ustawień i z nich WYCHODZI, więc jego stan jest jedyną
 * informacją o tym, gdzie jesteś.
 */
function PrzyciskUstawien({ onClick, href, active, label }: NonNullable<ViewBarProps["settings"]>) {
  const styl: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 36,
    minHeight: 36,
    borderRadius: "var(--radius-control)",
    border: "none",
    cursor: "pointer",
    background: active ? "var(--bg-elevated)" : "transparent",
    color: active ? "var(--text-primary)" : "var(--text-muted)",
    textDecoration: "none",
  };
  const wnetrze = <Settings2 size={16} />;
  if (href) {
    return (
      <Link href={href} title={label} aria-label={label} style={styl}>
        {wnetrze}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} aria-pressed={active} style={styl}>
      {wnetrze}
    </button>
  );
}
