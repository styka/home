"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { DEFAULT_USD_PLN_RATE } from "@/lib/usdPln";
import { withPln } from "@/lib/usdPln";

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

export function AiCostBadge({
  usage,
  rate = DEFAULT_USD_PLN_RATE,
  align = "right",
}: {
  usage?: AiCostUsage;
  rate?: number;
  /** Z której strony rozwija się panel rozbicia. */
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
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
    <div style={{ marginLeft: align === "right" ? "auto" : undefined, position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Szczegóły kosztu i modelu (kliknij, by rozwinąć)"
        aria-expanded={open}
        style={{
          display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10.5,
          color: "var(--text-muted)", background: "none", border: "none",
          cursor: "pointer", padding: 0, opacity: 0.85,
        }}
      >
        {label} {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>
      {open && (
        <div
          style={{
            position: "absolute", bottom: "calc(100% + 6px)", zIndex: 5,
            ...(align === "right" ? { right: 0 } : { left: 0 }),
            minWidth: 260, maxWidth: "min(360px, calc(100vw - 32px))",
            padding: "8px 10px", background: "var(--bg-elevated)",
            border: "1px solid var(--border)", borderRadius: 8,
            boxShadow: "0 6px 20px rgba(0,0,0,0.35)",
            fontSize: 11, color: "var(--text-secondary)", overflowX: "auto",
          }}
        >
          <p style={{ margin: "0 0 6px", fontWeight: 600, color: "var(--text-primary)" }}>Rozbicie kosztu</p>
          {calls.length > 0 ? (
            calls.map((c, i) => (
              <div key={i} style={{ marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, whiteSpace: "nowrap" }}>
                  <span style={{ color: "var(--text-primary)" }}>
                    {c.label ? `${c.label} · ` : ""}{c.model}
                  </span>
                  <span style={{ color: "var(--text-primary)" }}>
                    {amountLabel(c.costUsd, c.costKnown, rate)}
                  </span>
                </div>
                <div style={{ color: "var(--text-muted)", fontSize: 10.5 }}>
                  {tokenParts(c)} · razem {billableTokens(c)} tok.
                </div>
              </div>
            ))
          ) : (
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 3 }}>
              <span>{usage.model ?? "?"}{usage.tokens ? ` · ${usage.tokens} tok.` : ""}</span>
              <span style={{ color: "var(--text-primary)" }}>{amountLabel(usage.costUsd, usage.costKnown, rate)}</span>
            </div>
          )}
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
