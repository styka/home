"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronUp } from "lucide-react";
import { DEFAULT_USD_PLN_RATE, withPln } from "@/lib/usdPln";
import { AnchoredLayer } from "@/components/ui/AnchoredLayer";
import { zglosKoszt } from "@/platform/ai/kosztBus";
import { usePokazKoszty } from "@/platform/ai/kosztWidocznosc";

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
/** Górna granica szerokości panelu — węższy ekran i tak zetnie go przez `maxWidth` niżej. */
const PANEL_MAX_WIDTH = 360;

export function AiCostBadge({
  usage,
  akcja,
  swiezy = true,
  rate = DEFAULT_USD_PLN_RATE,
  align = "right",
}: {
  usage?: AiCostUsage;
  /**
   * 083: nazwa BIZNESOWEJ czynności użytkownika („Streszczenie wiadomości", „Plan tygodnia").
   *
   * **Wymagana, bez wartości domyślnej** — i to jest decyzja, nie niedopatrzenie. Wariant
   * opcjonalny z „historycznym" domyślnikiem dałby ciche „Nieznana akcja" w połowie z 26 miejsc
   * wołających ten komponent, a właściciel prosił dokładnie o odwrotność: chce wiedzieć, **za co**
   * poleciał koszt, bo na jednej stronie bywa kilka komponentów wołających model. Brak etykiety
   * ma być błędem kompilacji (wzorzec C-36: parametr wymagany zamiast cichego domyślnika).
   *
   * To NIE jest typ operacji LLM — „reasoning" nie odróżnia dwóch sekcji na tej samej stronie.
   */
  akcja: string;
  /**
   * 083 (recenzja): czy to zużycie POWSTAŁO WŁAŚNIE TERAZ, czy jest odczytane z zapisu.
   *
   * Rozróżnienie jest konieczne, bo `usage` przychodzi tu z dwóch źródeł nie do odróżnienia po
   * kształcie: ze świeżego wywołania modelu **i** z pamięci treści (`rememberedContent`) albo
   * z historii przebiegu w kolejce. Bez tego samo wejście na stronę z zapamiętaną sekcją AI
   * wywoływało powiadomienie „ta akcja kosztowała X" o koszcie, który poniesiono dawno temu —
   * czyli dokładny fałszywy alarm, a powtarzalny fałszywy alarm zabija wiarygodność całego
   * mechanizmu, dla której on istnieje (AC-11 mówi „gdy operacja **wygeneruje** koszt").
   *
   * Domyślnie `true`, bo w większości miejsc plakietka stoi zaraz przy wyniku wywołania zrobionego
   * w tym samym geście. Miejsca pokazujące zużycie ODCZYTANE — `AiContentMeta`, stan przebiegu
   * odświeżania, galeria komponentów — podają `false` jawnie.
   *
   * RYSOWANIE nie zależy od tej wartości: zapamiętany koszt nadal wolno pokazać przy treści, bo
   * tam jest opisem tej treści, a nie doniesieniem o zdarzeniu.
   */
  swiezy?: boolean;
  rate?: number;
  /**
   * 037: w bąblu czatu wskaźnik dociska się do prawej (`marginLeft:auto`) i tak zostaje domyślnie.
   * Moduły wpinają go w nagłówki i stopki kafli, gdzie to samo dociskanie rozpychało układ — stąd
   * wariant `left`.
   */
  align?: "left" | "right";
}) {
  const t = useTranslations("ui.cost");
  const { pokazuj } = usePokazKoszty();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  // 035: przesunięcie panelu w poziomie WZGLĘDEM przycisku, policzone z realnych pomiarów.
  // Wcześniej panel był kotwiczony na sztywno do prawej krawędzi przycisku, a `maxWidth` liczył się
  // od szerokości OKNA — więc gdy kwota wypadała blisko lewej krawędzi (krótka odpowiedź), panel
  // wyjeżdżał poza lewą stronę ekranu i jego początek był nieosiągalny.
  // 080 (Z7): pozycjonowanie należy do `AnchoredLayer`.
  //
  // Wcześniej stało tu ~50 linii własnej matematyki, która liczyła WYŁĄCZNIE oś poziomą i miała
  // zaszyte otwieranie w górę (`bottom: calc(100% + 6px)`). Przy przycisku blisko górnej krawędzi
  // panel wychodził ponad ekran — to jest zgłoszenie właściciela z /wiadomosci.
  //
  // Zmiana wobec dawnej wersji, świadoma: panel przycinaliśmy do KONTENERA (arkusza asystenta),
  // bo `position: absolute` dawało się przyciąć jego obszarowi przewijania. Portal do `body`
  // usuwa ten powód — panel nie leży już wewnątrz arkusza, więc nie ma go co przycinać, a jedyną
  // sensowną granicą zostaje okno.

  /**
   * 083: MELDUNEK idzie zawsze, RYSOWANIE zależy od przełącznika.
   *
   * Rozdzielenie tych dwóch rzeczy jest sednem zmiany. Gdyby meldunek siedział za tym samym
   * warunkiem co rysowanie, wyłączenie wskaźnika wyciszyłoby administratora całkowicie — a on ma
   * dowiadywać się o KAŻDYM koszcie; przełącznik decyduje tylko o szczegółach przy treści.
   *
   * Hak stoi PRZED wczesnymi wyjściami, bo kolejność haków nie może zależeć od danych.
   */
  useEffect(() => {
    if (!usage) return;
    if (!swiezy) return;
    if (usage.costUsd === undefined && !usage.tokens) return;
    zglosKoszt({
      akcja,
      usage: { costUsd: usage.costUsd, costKnown: usage.costKnown, tokens: usage.tokens, model: usage.model },
    });
  }, [usage, akcja, swiezy]);

  if (!usage) return null;
  // Przełącznik administratora: wskaźnik przy treści domyślnie NIE ZAJMUJE MIEJSCA (AC-7).
  if (!pokazuj) return null;

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
        title={t("details")}
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
          padding: "12px 6px",
        }}
      >
        {label} {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>
      <AnchoredLayer
        anchorRef={wrapRef}
        open={open}
        onClose={() => setOpen(false)}
        side="gora"
        align="koniec"
        width={PANEL_MAX_WIDTH}
        ariaLabel={t("rozbicieKosztu")}
        style={{ padding: "8px 10px", fontSize: 11, color: "var(--text-secondary)" }}
      >
        <div>
          <p style={{ margin: "0 0 6px", fontWeight: 600, color: "var(--text-primary)" }}>{t("rozbicieKosztu")}</p>
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
              {t("incomplete")}
            </p>
          )}
        </div>
      </AnchoredLayer>
    </div>
  );
}
