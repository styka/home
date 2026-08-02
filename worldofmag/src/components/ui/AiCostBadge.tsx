"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { DEFAULT_USD_PLN_RATE, withPln } from "@/lib/usdPln";

/**
 * 034: WSPÓLNY wskaźnik kosztu operacji AI. Wyjęty z okna asystenta, żeby dało się go użyć wszędzie,
 * gdzie moduł woła model (pogoda, kuchnia, magazyn…) — komponent nie wie nic o asystencie, przyjmuje
 * tylko zużycie i przelicznik.
 *
 * Dlaczego rozbicie jest tak szczegółowe: koszt liczy też tokeny PAMIĘCI PODRĘCZNEJ promptu (zapis
 * jest droższy od zwykłego wejścia, odczyt tańszy), a wcześniej UI pokazywało wyłącznie
 * „wejście+wyjście". Efekt: dwa wywołania o podobnej liczbie tokenów na tym samym modelu miały
 * kwoty różniące się dwudziestokrotnie i nie dało się tego z niczego wyliczyć (zgłoszenie Z7).
 */

/** Jedno wywołanie modelu — kształt zgodny z `UsageCall` z `@/lib/ai/usage`. */
export interface AiCostCall {
  model: string;
  label?: string;
  operationType?: string;
  promptTokens: number;
  completionTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  totalTokens: number;
  costUsd: number;
  costKnown?: boolean;
}

/** Zużycie całej operacji — kształt zgodny z `UsageMeter`. */
export interface AiCostUsage {
  model?: string;
  tokens?: number;
  costUsd?: number;
  costKnown?: boolean;
  calls?: AiCostCall[];
}

const UNKNOWN_LABEL = "koszt nieznany";

function money(usd: number, rate: number): string {
  return withPln(`~$${usd.toFixed(4)}`, usd, rate);
}

/** Etykieta kwoty: „koszt nieznany", gdy model nie ma wpisu w cenniku (a nie „0 zł"). */
function amountLabel(usd: number | undefined, known: boolean | undefined, rate: number): string {
  if (known === false) return UNKNOWN_LABEL;
  if (!usd) return "—";
  return money(usd, rate);
}

/** Rozpiska tokenów jednego wywołania — pokazujemy tylko składniki, które faktycznie wystąpiły. */
function tokenParts(call: AiCostCall): string {
  const parts = [`wejście ${call.promptTokens}`, `wyjście ${call.completionTokens}`];
  if (call.cacheWriteTokens) parts.push(`zapis do pamięci ${call.cacheWriteTokens}`);
  if (call.cacheReadTokens) parts.push(`odczyt z pamięci ${call.cacheReadTokens}`);
  return parts.join(" · ");
}

/** Suma WSZYSTKICH tokenów (z pamięcią podręczną) — to ona uzasadnia kwotę. */
function billableTokens(call: AiCostCall): number {
  return call.promptTokens + call.completionTokens + (call.cacheWriteTokens ?? 0) + (call.cacheReadTokens ?? 0);
}

/** Margines, jaki panel zostawia od krawędzi ekranu z każdej strony. */
const PANEL_MARGIN = 8;
/** Górna granica szerokości panelu — węższy ekran i tak zetnie go przez `maxWidth` niżej. */
const PANEL_MAX_WIDTH = 360;

export function AiCostBadge({
  usage,
  rate = DEFAULT_USD_PLN_RATE,
  align = "right",
}: {
  usage?: AiCostUsage;
  rate?: number;
  /**
   * 037: w bąblu czatu wskaźnik dociska się do prawej (`marginLeft:auto`) i tak zostaje domyślnie.
   * Moduły wpinają go w nagłówki i stopki kafli, gdzie to samo dociskanie rozpychało układ — stąd
   * wariant `left`.
   */
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  // 035: przesunięcie panelu w poziomie WZGLĘDEM przycisku, policzone z realnych pomiarów.
  // Wcześniej panel był kotwiczony na sztywno do prawej krawędzi przycisku, a `maxWidth` liczył się
  // od szerokości OKNA — więc gdy kwota wypadała blisko lewej krawędzi (krótka odpowiedź), panel
  // wyjeżdżał poza lewą stronę ekranu i jego początek był nieosiągalny.
  const [offsetLeft, setOffsetLeft] = useState(0);
  // Szerokość dostępna dla panelu — liczona z kontenera (arkusz asystenta), nie z okna.
  const [maxPanelWidth, setMaxPanelWidth] = useState(PANEL_MAX_WIDTH);

  const reposition = useCallback(() => {
    const wrap = wrapRef.current;
    const panel = panelRef.current;
    if (!wrap || !panel) return;
    const anchor = wrap.getBoundingClientRect();

    // Granicą NIE jest okno przeglądarki, tylko kontener, w którym panel faktycznie żyje: na
    // komputerze arkusz asystenta ma `max-w-lg` i stoi pośrodku szerokiego ekranu, a jego obszar
    // przewijania przycina wszystko, co z niego wystaje. Clampowanie do okna przepuściłoby panel
    // poza lewą krawędź arkusza — czyli dokładnie ten błąd, który naprawiamy.
    const host = wrap.closest('[role="dialog"]');
    const bounds = host ? host.getBoundingClientRect() : null;
    const minX = Math.max(PANEL_MARGIN, (bounds?.left ?? 0) + PANEL_MARGIN);
    const maxX = Math.min(window.innerWidth - PANEL_MARGIN, (bounds?.right ?? window.innerWidth) - PANEL_MARGIN);
    const available = Math.max(160, maxX - minX);
    setMaxPanelWidth(available);
    const width = Math.min(panel.offsetWidth, available);

    // Domyślnie wyrównujemy PRAWĄ krawędź panelu do prawej krawędzi przycisku…
    let left = anchor.right - width;
    // …a potem wpychamy go w dozwolony obszar. Gdy kontener jest węższy niż panel, wygrywa lewa
    // krawędź (zawartość panelu i tak jest przewijalna w poziomie).
    if (left + width > maxX) left = maxX - width;
    if (left < minX) left = minX;
    setOffsetLeft(left - anchor.left);
  }, []);

  // Pozycję liczymy PO wyrenderowaniu panelu (wcześniej nie ma czego mierzyć) i przy każdej
  // zmianie rozmiaru okna — obrót telefonu z otwartym panelem nie może go wyrzucić poza ekran.
  useLayoutEffect(() => {
    if (!open) return;
    reposition();
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", reposition);
    window.addEventListener("orientationchange", reposition);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("orientationchange", reposition);
    };
  }, [open, reposition]);

  if (!usage) return null;

  const hasCost = !!(usage.costUsd && usage.costUsd > 0);
  const hasDetail = !!usage.calls?.length || !!usage.model || !!usage.tokens;
  if (!hasCost && !hasDetail) return null;

  const calls = usage.calls ?? [];
  const label = hasCost || usage.costKnown === false
    ? amountLabel(usage.costUsd, usage.costKnown, rate)
    : "szczegóły modelu";
  const totalBillable = calls.reduce((n, c) => n + billableTokens(c), 0) || usage.tokens || 0;

  return (
    <div ref={wrapRef} style={{ marginLeft: align === "right" ? "auto" : undefined, position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Szczegóły kosztu i modelu (kliknij, by rozwinąć)"
        aria-expanded={open}
        style={{
          display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10.5,
          color: "var(--text-muted)", background: "none", border: "none",
          cursor: "pointer", opacity: 0.85,
          // 041: `padding: 0` dawało cel dotyku ~14 px wysokości — poniżej minimum z C-31, a to jest
          // reguła globalna, więc wskaźnik łamał ją wszędzie, nie tylko w pasku sekcji AI. Rośnie
          // WYŁĄCZNIE obszar klikalny: rozmiar i kolor tekstu zostają, więc waga wizualna też.
          // Świadomie bez ujemnego marginesu „kompensującego" — wyciągnięty obszar dotyku zachodziłby
          // wtedy na sąsiedni wiersz, gdy pasek się zawinie, a nakładające się cele dotyku są gorsze
          // od paska wyższego o kilkanaście pikseli.
          padding: "11px 6px",
        }}
      >
        {label} {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>
      {open && (
        <div
          ref={panelRef}
          style={{
            position: "absolute", bottom: "calc(100% + 6px)", zIndex: 5,
            left: offsetLeft,
            minWidth: 0,
            width: `min(${PANEL_MAX_WIDTH}px, ${maxPanelWidth}px)`,
            maxWidth: `${maxPanelWidth}px`,
            padding: "8px 10px", background: "var(--bg-elevated)",
            border: "1px solid var(--border)", borderRadius: 8,
            boxShadow: "0 6px 20px rgba(0,0,0,0.35)",
            fontSize: 11, color: "var(--text-secondary)",
          }}
        >
          <p style={{ margin: "0 0 6px", fontWeight: 600, color: "var(--text-primary)" }}>Rozbicie kosztu</p>
          {/* 035: przewijanie w poziomie należy do LISTY WYWOŁAŃ, a nie do całego panelu. Wcześniej
              `overflow-x` siedział na panelu, ale wiersze miały `white-space: nowrap` przy
              `justify-content: space-between`, więc rozpychały go zamiast się przewijać. */}
          <div style={{ overflowX: "auto", overflowY: "hidden" }}>
            {calls.length > 0 ? (
              calls.map((c, i) => (
                <div key={i} style={{ marginBottom: 6, minWidth: "max-content" }}>
                  <div style={{ display: "flex", gap: 12, whiteSpace: "nowrap" }}>
                    <span style={{ color: "var(--text-primary)" }}>
                      {c.label ? `${c.label} · ` : ""}{c.model}
                    </span>
                    <span style={{ marginLeft: "auto", color: "var(--text-primary)" }}>
                      {amountLabel(c.costUsd, c.costKnown, rate)}
                    </span>
                  </div>
                  <div style={{ color: "var(--text-muted)", fontSize: 10.5, whiteSpace: "nowrap" }}>
                    {tokenParts(c)} · razem {billableTokens(c)} tok.
                  </div>
                </div>
              ))
            ) : (
              <div style={{ display: "flex", gap: 12, marginBottom: 3, minWidth: "max-content", whiteSpace: "nowrap" }}>
                <span>{usage.model ?? "?"}{usage.tokens ? ` · ${usage.tokens} tok.` : ""}</span>
                <span style={{ marginLeft: "auto", color: "var(--text-primary)" }}>{amountLabel(usage.costUsd, usage.costKnown, rate)}</span>
              </div>
            )}
          </div>
          <div
            style={{
              display: "flex", justifyContent: "space-between", gap: 10, marginTop: 6, paddingTop: 6,
              borderTop: "1px solid var(--border)", fontWeight: 600, color: "var(--text-primary)",
            }}
          >
            <span>Suma{totalBillable ? ` · ${totalBillable} tok.` : ""}</span>
            <span>{amountLabel(usage.costUsd, usage.costKnown, rate)}</span>
          </div>
          {usage.costKnown === false && (
            <p style={{ margin: "6px 0 0", fontSize: 10.5, color: "var(--text-muted)", whiteSpace: "normal" }}>
              Któryś z użytych modeli nie ma stawek w cenniku — kwota jest niepełna. Cennik uzupełnia
              administrator w panelu LLM.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
