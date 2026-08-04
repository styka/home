"use client";

import type { ReactNode } from "react";
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

  children?: ReactNode;
}

export function ModuleView({
  icon,
  iconColor,
  title,
  subtitle,
  href,
  headerAction,
  filters,
  actions,
  hideChrome,
  state = "ready",
  empty,
  error,
  noAccess,
  loadingRows,
  width = "full",
  children,
}: ModuleViewProps) {
  return (
    <div
      style={{
        position: "relative",
        flex: 1,
        minWidth: 0,
        overflowY: "auto",
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
          maxWidth: width === "narrow" ? 640 : undefined,
          margin: width === "narrow" ? "0 auto" : undefined,
          padding: "var(--view-padding)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <PageHeader
          icon={icon}
          iconColor={iconColor}
          title={title}
          subtitle={subtitle}
          href={href}
          action={headerAction}
        />

        <ViewBar filters={filters} actions={actions} hideChrome={hideChrome} />

        <ViewContent
          state={state}
          empty={empty}
          error={error}
          noAccess={noAccess}
          loadingRows={loadingRows}
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
  children,
}: Pick<ModuleViewProps, "state" | "empty" | "error" | "noAccess" | "loadingRows" | "children">) {
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
      return <>{children}</>;
  }
}
