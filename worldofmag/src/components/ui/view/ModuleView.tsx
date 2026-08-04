"use client";

import type { ReactNode, RefObject } from "react";
import { PageHeader } from "@/components/ui/home/PageHeader";
import { ViewBar } from "./ViewBar";
import { ChromeFrame } from "./ChromeFrame";
import { ViewEmpty, ViewError, ViewLoading, ViewNoAccess, type ViewStateKind } from "./ViewState";
import type { ViewResource } from "./ViewChrome";

/**
 * 045 — KONTRAKT WIDOKU. Moduł **deklaruje** widok; powłoka **rysuje ramę**.
 *
 * Problem, który to rozwiązuje, jest kosztowy, nie estetyczny: nagłówek, pasek narzędzi
 * i stany brzegowe były pisane od nowa w każdym z 21 modułów, każdy trochę inaczej, więc
 * jedna poprawka UX wymagała obejścia dwudziestu jeden miejsc (rozdz. 10.4 architektury
 * docelowej).
 *
 * Nagłówek renderuje wewnętrznie istniejący `PageHeader` — używany już w ~30 komponentach.
 * To celowe: migracja modułu jest wtedy PODMIANĄ OPAKOWANIA, a nie przepisaniem nagłówka,
 * więc „zero zmian zachowania" jest sprawdzalne wzrokiem, a nie obietnicą.
 *
 * `state` jest jedyną drogą do stanów brzegowych. Dzięki temu bramka `check:ui-contract`
 * ma co sprawdzać: moduł, który zapomniał o stanie pustym, nie przechodzi builda.
 */

export interface ModuleViewProps {
  // ── nagłówek ──
  icon: ReactNode;
  iconColor?: string;
  title: string;
  subtitle?: string;
  /** Gdy podane — tytuł staje się linkiem do strony głównej działu. */
  href?: string;
  /** Prawy górny róg nagłówka (np. przycisk główny modułu). */
  headerAction?: ReactNode;

  /**
   * Link powrotny nad nagłówkiem („‹ Portfel", „‹ Wszystkie usługi").
   *
   * Trafił do kontraktu, bo powtarzał się w ośmiu widokach podrzędnych, za każdym razem
   * z lekko innym odstępem i rozmiarem ikony. Skoro rama i tak zna miejsce nad tytułem,
   * niech pilnuje go w jednym miejscu.
   */
  breadcrumb?: ReactNode;

  // ── pasek widoku ──
  filters?: ReactNode;
  actions?: ReactNode;
  /** Ukryj chrom powłoki (widok osadzony, playground). */
  hideChrome?: boolean;

  // ── stany brzegowe ──
  /**
   * `ready` renderuje `children`. Pozostałe wartości renderują wspólny stan brzegowy
   * ZAMIAST treści — moduł nie rysuje ich samodzielnie.
   */
  state?: ViewStateKind;
  empty?: { title?: string; description?: string; icon?: ReactNode; action?: { label: string; onClick?: () => void; href?: string } };
  error?: { title?: string; description?: string; onRetry?: () => void };
  noAccess?: { title?: string; description?: string };
  loadingRows?: number;

  /**
   * Zasób, którego dotyczy widok. **Zarezerwowany, dziś nieaktywny** (plan §5.2) —
   * istnieje po to, żeby udostępnianie, okno konfliktu i awatary obecności (Fazy 2 i 4
   * przebudowy) dało się dołożyć bez wracania do 21 modułów.
   */
  resource?: ViewResource;

  /** Szerokość treści; `narrow` = kolumna czytelnicza (jak `pageInnerStyle`). */
  width?: "full" | "narrow";

  /**
   * Układ treści.
   *
   * `column` (domyślny) — treść płynie w pionie, rama przewija całość. Tak działa
   * większość widoków listowych.
   *
   * `fill` — treść dostaje CAŁĄ pozostałą wysokość i przewija się sama. Potrzebne
   * modułom wielopanelowym (Zadania, Notatki, Zakupy, Wiadomości, Pogoda,
   * Magazynowanie), gdzie panel boczny i lista mają osobne przewijanie. Bez tego
   * wariantu rama musiałaby narzucić im jeden scroll na całość — czyli przebudowę
   * układu, a nie migrację nagłówka.
   *
   * To jest odpowiedź na punkt kontrolny z planu: kontrakt ma unieść najbardziej
   * nietypowe widoki, a jeśli nie unosi — poszerzamy kontrakt, nie obchodzimy go
   * w module.
   */
  layout?: "column" | "fill";

  /**
   * Gęstość nagłówka.
   *
   * `comfortable` (domyślna) — tytuł 22 px w osobnym wierszu, jak dotąd.
   *
   * `compact` — tytuł wchodzi INLINE do paska widoku, w jednym wierszu z filtrami
   * i akcjami. Dla widoków, które mają własny gęsty pasek narzędzi (Zadania, Zakupy,
   * Notatki): tam duży nagłówek dołożyłby drugi wiersz chromu na ekranie, na którym
   * liczy się każdy piksel listy. Kontrakt ma bronić UX, a nie narzucać jeden rozmiar
   * wszystkim — stąd wariant zamiast wyjątku.
   */
  density?: "comfortable" | "compact";

  /**
   * Odstęp między blokami treści. Domyślnie 24 px — dokładnie tyle, ile miał
   * `pageInnerStyle`, z którego migrują moduły. Dzięki temu podmiana opakowania nie
   * przesuwa ani jednego piksela, a „zero zmian zachowania" jest sprawdzalne wzrokiem.
   */
  contentGap?: number;

  /**
   * Referencja do kontenera PRZEWIJANIA widoku.
   *
   * Potrzebna modułom, które wirtualizują długie listy (Kontakty, Magazynowanie):
   * `@tanstack/react-virtual` musi znać element, który faktycznie się przewija, a od
   * kontraktu widoku należy on do ramy, nie do modułu. Bez tego moduł musiałby
   * zbudować własny kontener przewijania wewnątrz ramy — czyli dwa zagnieżdżone
   * scrolle i sklejony pasek na telefonie.
   */
  scrollRef?: RefObject<HTMLDivElement>;

  children?: ReactNode;
}

export function ModuleView({
  icon,
  iconColor,
  title,
  subtitle,
  href,
  headerAction,
  breadcrumb,
  filters,
  actions,
  hideChrome,
  state = "ready",
  empty,
  error,
  noAccess,
  loadingRows,
  width = "full",
  layout = "column",
  density = "comfortable",
  contentGap = 24,
  scrollRef,
  children,
}: ModuleViewProps) {
  const fill = layout === "fill";
  const compact = density === "compact";

  return (
    <div
      ref={scrollRef}
      style={{
        position: "relative",
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        // W układzie `fill` przewijanie należy do TREŚCI, nie do ramy — inaczej
        // panel boczny modułu przewijałby się razem z listą.
        overflowY: fill ? "hidden" : "auto",
        backgroundColor: "var(--bg-base)",
        backgroundImage: "var(--bg-image-base)",
      }}
    >
      {/* Dekoracja skórki. Widoczność rozstrzyga `data-chrome-frame` na <html>, więc dla
          większości skórek to jest pusty div bez kosztu. */}
      <ChromeFrame />

      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: width === "narrow" ? 640 : undefined,
          margin: width === "narrow" ? "0 auto" : undefined,
          padding: compact ? "0 12px" : fill ? "8px var(--view-padding) 0" : "var(--view-padding)",
          display: "flex",
          flexDirection: "column",
          gap: fill ? 8 : 12,
          flexShrink: 0,
        }}
      >
        {breadcrumb && <div style={{ marginBottom: -4 }}>{breadcrumb}</div>}

        {!compact && (
          <PageHeader
            icon={icon}
            iconColor={iconColor}
            title={title}
            subtitle={subtitle}
            href={href}
            action={headerAction}
          />
        )}

        <ViewBar
          compact={compact}
          title={compact ? title : undefined}
          titleHref={compact ? href : undefined}
          icon={compact ? icon : undefined}
          iconColor={iconColor}
          filters={filters}
          actions={compact && headerAction ? (
            <>
              {actions}
              {headerAction}
            </>
          ) : actions}
          hideChrome={hideChrome}
        />
      </div>

      {/* Treść. W `fill` dostaje resztę wysokości i własne przewijanie; w `column`
          płynie w ramie razem z nagłówkiem. */}
      <div
        style={
          fill
            ? { flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }
            : {
                position: "relative",
                width: "100%",
                maxWidth: width === "narrow" ? 640 : undefined,
                margin: width === "narrow" ? "0 auto" : undefined,
                padding: "0 var(--view-padding) var(--view-padding)",
              }
        }
      >
        <ViewContent
          state={state}
          empty={empty}
          error={error}
          noAccess={noAccess}
          loadingRows={loadingRows}
          contentGap={fill ? 0 : contentGap}
          fill={fill}
        >
          {children}
        </ViewContent>
      </div>
    </div>
  );
}

function ViewContent({
  state,
  empty,
  error,
  noAccess,
  loadingRows,
  contentGap,
  fill,
  children,
}: Pick<ModuleViewProps, "state" | "empty" | "error" | "noAccess" | "loadingRows" | "contentGap" | "children"> & {
  fill?: boolean;
}) {
  switch (state) {
    case "loading":
      return <ViewLoading rows={loadingRows} />;
    case "error":
      return <ViewError {...error} />;
    case "no-access":
      return <ViewNoAccess {...noAccess} />;
    case "empty":
      return <ViewEmpty {...empty} />;
    default:
      return (
        <div
          style={
            fill
              ? { flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }
              : { display: "flex", flexDirection: "column", gap: contentGap }
          }
        >
          {children}
        </div>
      );
  }
}
