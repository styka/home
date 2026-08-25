"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Check, Plus, Trash2, Cpu, Sparkles, DollarSign } from "lucide-react";
import {
  createProvider,
  updateProvider,
  deleteProvider,
  setAssignment,
  applyAnthropicProfile,
  setCostAlertThreshold,
  setUsdPlnRate,
  setModelPrice,
  deleteModelPrice,
  setFollowupsEnabled,
  setAiKillSwitch,
  setAiMonthlyBudget,
  type StanBudzetuDTO,
  setCostBadgeEnabled,
  type ProviderDTO,
  type AssignmentDTO,
  type AiCostBreakdown,
  type SpeechConfigDTO,
  type ModelPriceDTO,
} from "@/actions/llmConfig";
import { SpeechAssignmentRow } from "@/components/admin/SpeechAssignmentRow";
import { withPln } from "@/lib/usdPln";
import {
  LLM_EFFORT_LABELS,
  LLM_EFFORT_LEVELS,
  effortSupported,
  supportsTemperature,
  type LlmEffort,
} from "@/platform/llm/effort";
import type { ProviderKind } from "@/platform/llm/resolver";
import {
  CONFIG_LEVELS,
  CONFIG_LEVEL_DESCRIPTIONS,
  CONFIG_LEVEL_LABELS,
  type ConfigLevel,
} from "@/platform/llm/operationTypes";
import {
  AI_SECTION_KINDS,
  AI_SECTION_LABELS,
  AI_SECTION_MODE_LABELS,
  type AiSectionMode,
} from "@/platform/ai/sectionMode";
import { setDefaultSectionModes } from "@/actions/aiSections";

const KIND_LABELS: Record<string, string> = {
  openai_compat: "OpenAI-compatible (Groq, OpenAI, xAI, OpenRouter…)",
  anthropic: "Anthropic (Claude)",
  // 032: dostawcy WYŁĄCZNIE syntezy mowy — konfiguruje się ich w sekcji lektora, nie tutaj.
  elevenlabs: "ElevenLabs (tylko synteza mowy)",
  google_tts: "Google Cloud Text-to-Speech (tylko synteza mowy)",
  azure_tts: "Microsoft Azure Speech (tylko synteza mowy)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--bg-base)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: "7px 10px",
  color: "var(--text-primary)",
  fontSize: 13,
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--text-muted)",
  display: "block",
  marginBottom: 4,
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--text-muted)",
        marginBottom: 12,
      }}
    >
      {children}
    </h2>
  );
}

function ProviderEditor({ providers }: { providers: ProviderDTO[] }) {
  const t = useTranslations("components.admin.LlmConfigPanel");
  const [isPending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState("openai_compat");
  const [baseUrl, setBaseUrl] = useState("https://api.groq.com/openai/v1");
  const [apiKey, setApiKey] = useState("");

  function add() {
    if (!label.trim() || !baseUrl.trim()) return;
    startTransition(async () => {
      await createProvider({ label, kind, baseUrl, apiKey });
      setLabel("");
      setApiKey("");
      setAdding(false);
    });
  }

  return (
    <section style={{ marginBottom: 32 }}>
      <SectionTitle>Dostawcy</SectionTitle>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {providers.map((p) => (
          <ProviderRow key={p.id} provider={p} />
        ))}
      </div>

      {adding ? (
        <div
          style={{
            marginTop: 12,
            padding: 16,
            border: "1px solid var(--border)",
            borderRadius: 10,
            background: "var(--bg-surface)",
            display: "grid",
            gap: 12,
          }}
        >
          <div>
            <label style={labelStyle}>Nazwa</label>
            <input style={inputStyle} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="np. OpenAI" />
          </div>
          <div>
            <label style={labelStyle}>Rodzaj API</label>
            <select style={inputStyle} value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="openai_compat">{KIND_LABELS.openai_compat}</option>
              <option value="anthropic">{KIND_LABELS.anthropic}</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Adres bazowy (base URL)</label>
            <input
              style={inputStyle}
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={kind === "anthropic" ? "https://api.anthropic.com/v1" : "https://api.groq.com/openai/v1"}
            />
          </div>
          <div>
            <label style={labelStyle}>Klucz API (token)</label>
            <input style={inputStyle} type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="••••" />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={add}
              disabled={isPending}
              className="flex items-center gap-2 px-3 py-2 rounded text-sm font-medium disabled:opacity-40"
              style={{ background: "var(--accent-blue)", color: "var(--on-accent)" }}
            >
              <Plus size={14} /> Dodaj
            </button>
            <button
              onClick={() => setAdding(false)}
              className="px-3 py-2 rounded text-sm"
              style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}
            >
              Anuluj
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 px-3 py-2 rounded text-sm mt-3"
          style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}
        >
          <Plus size={14} /> {t("dodajDostawce")}
        </button>
      )}
    </section>
  );
}

function ProviderRow({ provider }: { provider: ProviderDTO }) {
  const t = useTranslations("components.admin.LlmConfigPanel");
  const [isPending, startTransition] = useTransition();
  const [editingKey, setEditingKey] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [saved, setSaved] = useState(false);

  function saveKey() {
    startTransition(async () => {
      await updateProvider(provider.id, { apiKey });
      setSaved(true);
      setEditingKey(false);
      setApiKey("");
      setTimeout(() => setSaved(false), 2000);
    });
  }

  function remove() {
    startTransition(async () => {
      try {
        await deleteProvider(provider.id);
      } catch (e) {
        alert(e instanceof Error ? e.message : "Nie udało się usunąć");
      }
    });
  }

  return (
    <div
      style={{
        padding: "12px 14px",
        border: "1px solid var(--border)",
        borderRadius: 10,
        background: "var(--bg-surface)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Cpu size={15} style={{ color: "var(--accent-purple)", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, color: "var(--text-primary)" }}>{provider.label}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {KIND_LABELS[provider.kind] ?? provider.kind} · {provider.baseUrl}
          </div>
        </div>
        <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {saved ? "zapisano" : provider.hasKey ? provider.apiKeyMasked : "brak klucza"}
        </span>
        {/*
          104 (punkt 5): klucz zapisany przed wprowadzeniem szyfrowania leży w bazie otwartym
          tekstem — działa, bo odczyt jest wstecznie zgodny, i właśnie dlatego nic tego nie
          zdradzało. Ponowny zapis tej samej wartości go zaszyfruje.
        */}
        {provider.hasKey && !provider.zaszyfrowany && (
          <span
            style={{ fontSize: 11, fontWeight: 600, color: "var(--accent-amber)", whiteSpace: "nowrap" }}
            title={t("kluczJawnyTytul")}
          >
            {t("kluczJawny")}
          </span>
        )}
        <button onClick={() => setEditingKey((v) => !v)} className="text-xs px-2 py-1 rounded" style={{ color: "var(--text-secondary)" }}>
          Klucz
        </button>
        <button onClick={remove} disabled={isPending} className="p-1 rounded" style={{ color: "var(--accent-red)" }} title={t("usun")}>
          <Trash2 size={14} />
        </button>
      </div>
      {editingKey && (
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <input
            style={inputStyle}
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") saveKey(); }}
            placeholder="Nowy klucz API"
            autoFocus
          />
          <button
            onClick={saveKey}
            disabled={isPending || !apiKey.trim()}
            className="flex items-center gap-1 px-3 py-2 rounded text-sm disabled:opacity-40"
            style={{ background: "var(--accent-blue)", color: "var(--on-accent)" }}
          >
            <Check size={14} /> Zapisz
          </button>
        </div>
      )}
    </div>
  );
}

function AssignmentRow({ assignment, providers }: { assignment: AssignmentDTO; providers: ProviderDTO[] }) {
  const t = useTranslations("components.admin.LlmConfigPanel");
  const [isPending, startTransition] = useTransition();
  const [providerId, setProviderId] = useState(assignment.providerId ?? providers[0]?.id ?? "");
  // 034: pusty model na poziomie innym niż standardowy = świadome dziedziczenie ze standardowego,
  // więc NIE podstawiamy tu wartości domyślnej — placeholder mówi, co zadziała.
  const isBase = assignment.level === "standard";
  const [model, setModel] = useState(assignment.model ?? (isBase ? assignment.defaultModel : ""));
  const inheritedModelHint = assignment.inheritedModel ?? assignment.defaultModel;
  // 033: pokrętła modelu — wysiłek, temperatura i limit odpowiedzi. Puste = wartość domyślna
  // dostawcy (nie wysyłamy parametru).
  const [effort, setEffort] = useState<LlmEffort>(assignment.effort);
  const [temperature, setTemperature] = useState(assignment.temperature === null ? "" : String(assignment.temperature));
  const [maxTokens, setMaxTokens] = useState(assignment.maxTokens === null ? "" : String(assignment.maxTokens));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Możliwości liczymy z AKTUALNIE wybranego dostawcy i wpisanego modelu, więc komunikat
  // przelicza się od razu — admin widzi go PRZED zapisem (AC-3).
  const kind = (providers.find((p) => p.id === providerId)?.kind ?? "openai_compat") as ProviderKind;
  const canEffort = effortSupported(kind, model);
  const canTemperature = supportsTemperature(kind);

  function save() {
    if (!providerId || (isBase && !model.trim())) return;
    setError(null);
    startTransition(async () => {
      try {
        await setAssignment({
          operationType: assignment.operationType,
          level: assignment.level,
          providerId,
          model,
          effort,
          temperature: temperature.trim() === "" ? null : Number(temperature.replace(",", ".")),
          maxTokens: maxTokens.trim() === "" ? null : Number(maxTokens),
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Nie udało się zapisać ustawień.");
      }
    });
  }

  return (
    <div
      style={{
        padding: "14px 16px",
        border: "1px solid var(--border)",
        borderRadius: 10,
        background: "var(--bg-surface)",
      }}
    >
      <div style={{ fontSize: 14, color: "var(--text-primary)", marginBottom: 2 }}>{assignment.label}</div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>{assignment.description}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, alignItems: "end" }}>
        <div>
          <label style={labelStyle}>Dostawca</label>
          <select style={inputStyle} value={providerId} onChange={(e) => setProviderId(e.target.value)}>
            {providers.length === 0 && <option value="">{t("brakDostawcow")}</option>}
            {providers.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Model</label>
          <input
            style={inputStyle}
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={isBase ? assignment.defaultModel : `dziedziczy: ${inheritedModelHint}`}
          />
        </div>
        <button
          onClick={save}
          disabled={isPending || !providerId || (isBase && !model.trim())}
          className="flex items-center gap-1 px-3 py-2 rounded text-sm font-medium disabled:opacity-40"
          style={{ background: saved ? "var(--accent-green)" : "var(--accent-blue)", color: "var(--on-accent)", height: 35 }}
        >
          {saved ? <Check size={14} /> : null}
          {saved ? "Zapisano" : "Zapisz"}
        </button>
      </div>

      {/* 033: parametry modelu. Na telefonie jedna kolumna (C-31). */}
      <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 8, marginTop: 10 }}>
        <div style={{ opacity: canEffort ? 1 : 0.55 }}>
          <label style={labelStyle}>{t("wysilekModelu")}</label>
          <select style={inputStyle} value={effort} onChange={(e) => setEffort(e.target.value as LlmEffort)}>
            {LLM_EFFORT_LEVELS.map((lvl) => (
              <option key={lvl} value={lvl}>{LLM_EFFORT_LABELS[lvl]}</option>
            ))}
          </select>
        </div>
        <div style={{ opacity: canTemperature ? 1 : 0.55 }}>
          <label style={labelStyle}>Temperatura (0–2)</label>
          <input
            style={inputStyle}
            type="number"
            step="0.1"
            min={0}
            max={2}
            value={temperature}
            onChange={(e) => setTemperature(e.target.value)}
            placeholder={t("domyslna")}
          />
        </div>
        <div>
          <label style={labelStyle}>Limit odpowiedzi (tokeny)</label>
          <input
            style={inputStyle}
            type="number"
            min={1}
            max={32000}
            value={maxTokens}
            onChange={(e) => setMaxTokens(e.target.value)}
            placeholder={t("domyslny")}
          />
        </div>
      </div>

      {/* Uczciwa informacja o możliwościach — zamiast pozwalać ustawiać coś bez efektu (AC-3). */}
      {(effort !== "none" && !canEffort) || (temperature.trim() !== "" && !canTemperature) ? (
        <div style={{ marginTop: 8, fontSize: 11, color: "var(--accent-amber)", lineHeight: 1.5 }}>
          {effort !== "none" && !canEffort && (
            <div>
              Ten model nie obsługuje wysiłku — ustawienie zostanie pominięte przy wywołaniu.
              {kind === "anthropic"
                ? " Rozszerzone myślenie mają modele Claude 4 i nowsze."
                : " Wysiłek przyjmują modele rozumujące (np. GPT-5, o3, Qwen3, GPT-OSS)."}
            </div>
          )}
          {temperature.trim() !== "" && !canTemperature && (
            <div>
              {t("dostawcaAnthropicIgnorujeTemperature")}
            </div>
          )}
        </div>
      ) : null}

      {error && (
        <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--accent-red)" }}>{error}</div>
      )}
    </div>
  );
}

// Jednoklikowy profil rekomendowany: Anthropic Sonnet (rozumowanie/generowanie/
// wizja) + Haiku (klasyfikacja). Groq zostaje jako fallback.
function AnthropicProfileCard() {
  const t = useTranslations("components.admin.LlmConfigPanel");
  const [isPending, startTransition] = useTransition();
  const [apiKey, setApiKey] = useState("");
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function apply() {
    if (!apiKey.trim()) return;
    setErr(null);
    startTransition(async () => {
      try {
        await applyAnthropicProfile({ apiKey });
        setApiKey("");
        setDone(true);
        setTimeout(() => setDone(false), 2500);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Nie udało się zastosować profilu");
      }
    });
  }

  return (
    <section style={{ marginBottom: 32 }}>
      <SectionTitle>Rekomendowany profil Anthropic</SectionTitle>
      <div
        style={{
          padding: 16,
          border: "1px solid var(--border)",
          borderRadius: 10,
          background: "var(--bg-surface)",
          display: "grid",
          gap: 12,
        }}
      >
        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
          Ustaw jednym kliknięciem zestaw modeli z rekomendacji architektury:{" "}
          <strong>Claude Sonnet</strong> do rozumowania/generowania/wizji i{" "}
          <strong>Claude Haiku</strong> {t("doSzybkiejKlasyfikacjiDispatch")}
        </p>
        <div>
          <label style={labelStyle}>Klucz API Anthropic</label>
          <input
            style={inputStyle}
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") apply(); }}
            placeholder="sk-ant-…"
          />
        </div>
        {err && <div style={{ fontSize: 12, color: "var(--accent-red)" }}>{err}</div>}
        <div>
          <button
            onClick={apply}
            disabled={isPending || !apiKey.trim()}
            className="flex items-center gap-2 px-3 py-2 rounded text-sm font-medium disabled:opacity-40"
            style={{ background: done ? "var(--accent-green)" : "var(--accent-purple)", color: "var(--on-accent)" }}
          >
            {done ? <Check size={14} /> : <Sparkles size={14} />}
            {done ? "Zastosowano" : "Zastosuj profil Anthropic (Sonnet + Haiku)"}
          </button>
        </div>
      </div>
    </section>
  );
}

// 029: kwoty USD pokazujemy z równowartością w PLN (przelicznik z /admin/llm).
function fmtUsd(n: number, rate: number): string {
  return withPln(`$${n.toFixed(n < 1 ? 4 : 2)}`, n, rate);
}

const tdStyle: React.CSSProperties = { padding: "8px 10px", fontSize: 12, color: "var(--text-secondary)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" };
const thStyle: React.CSSProperties = { padding: "8px 10px", fontSize: 11, color: "var(--text-muted)", textAlign: "left", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" };


/**
 * 082 (zadanie 27): BUDŻETY AI. Trzy ustawienia w jednym miejscu, bo odpowiadają na jedno pytanie
 * („ile wolno wydać"), ale robią trzy różne rzeczy — i pomylenie ich kosztuje albo pieniądze, albo
 * działającego asystenta:
 *   * wyłącznik awaryjny — natychmiast, ręcznie, bez warunków;
 *   * kwota budżetu — podstawa alarmów 50/80/100 %;
 *   * „twardy" — czy przekroczenie kwoty ma ZATRZYMAĆ wywołania, czy tylko powiadomić.
 */
function AiBudgetSection({ stan, rate }: { stan: StanBudzetuDTO; rate: number }) {
  const t = useTranslations("components.admin.LlmConfigPanel");
  const [isPending, startTransition] = useTransition();
  const [wylaczone, setWylaczone] = useState(stan.wylaczone);
  const [budzet, setBudzet] = useState(stan.budzetUsd > 0 ? String(stan.budzetUsd) : "");
  const [twardy, setTwardy] = useState(stan.twardy);
  const [error, setError] = useState<string | null>(null);
  const [zapisano, setZapisano] = useState(false);

  const kwotaBudzetu = Number(budzet) || 0;
  const udzial = kwotaBudzetu > 0 ? Math.min(1, stan.wydanoUsd / kwotaBudzetu) : 0;

  function przelaczWylacznik(next: boolean) {
    setWylaczone(next);
    setError(null);
    startTransition(async () => {
      try {
        await setAiKillSwitch(next);
      } catch (e) {
        setWylaczone(!next);
        setError(e instanceof Error ? e.message : "Nie udało się zapisać ustawienia.");
      }
    });
  }

  function zapiszBudzet() {
    setError(null);
    setZapisano(false);
    startTransition(async () => {
      try {
        await setAiMonthlyBudget(kwotaBudzetu, twardy);
        setZapisano(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Nie udało się zapisać budżetu.");
      }
    });
  }

  return (
    <section style={{ marginBottom: 32 }}>
      <SectionTitle>{t("budzetAiIWylacznik")}</SectionTitle>

      <label
        className="py-3"
        style={{
          display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer",
          padding: "12px", border: `1px solid ${wylaczone ? "var(--accent-red)" : "var(--border)"}`,
          borderRadius: 8, background: "var(--bg-surface)", marginBottom: 12,
        }}
      >
        <input
          type="checkbox"
          checked={wylaczone}
          disabled={isPending}
          onChange={(e) => przelaczWylacznik(e.target.checked)}
          style={{ width: 20, height: 20, flexShrink: 0, accentColor: "var(--accent-red)", cursor: "pointer" }}
        />
        <span style={{ minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 13, color: "var(--text-primary)" }}>
            {t("wylaczAiWCalym")}
          </span>
          <span style={{ display: "block", fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.5, marginTop: 2 }}>
            {t("hamulecBezpieczenstwaZatrzymuje")} <strong>wszystkie</strong> {t("wywolaniaModeluTakzeZadania")}
          </span>
        </span>
      </label>

      <div style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-surface)" }}>
        <div style={{ fontSize: 13, color: "var(--text-primary)", marginBottom: 8 }}>
          {t("miesiecznyBudzetInstalacji")}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>$</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={budzet}
            onChange={(e) => { setBudzet(e.target.value); setZapisano(false); }}
            placeholder={t("0BezBudzetu")}
            style={{
              width: 130, padding: "6px 8px", fontSize: 13, borderRadius: 6,
              border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-primary)",
            }}
          />
          <button
            type="button"
            onClick={zapiszBudzet}
            disabled={isPending}
            style={{
              padding: "6px 12px", fontSize: 12, borderRadius: 6, cursor: "pointer",
              border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--text-primary)",
            }}
          >
            Zapisz
          </button>
          {zapisano && <span style={{ fontSize: 11.5, color: "var(--accent-green)" }}>Zapisano</span>}
        </div>

        <label className="py-3" style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", marginBottom: 10 }}>
          <input
            type="checkbox"
            checked={twardy}
            disabled={isPending}
            onChange={(e) => { setTwardy(e.target.checked); setZapisano(false); }}
            style={{ width: 20, height: 20, flexShrink: 0, accentColor: "var(--accent-amber)", cursor: "pointer" }}
          />
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 12.5, color: "var(--text-primary)" }}>
              {t("poWyczerpaniuBudzetu")} <strong>zatrzymaj</strong> {t("wywolania")}
            </span>
            <span style={{ display: "block", fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.5, marginTop: 2 }}>
              {t("wylaczoneBudzetJestTylko")}
            </span>
          </span>
        </label>

        {kwotaBudzetu > 0 && (
          <div>
            <div style={{ height: 6, borderRadius: 3, background: "var(--bg-elevated)", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${Math.round(udzial * 100)}%`,
                  background: udzial >= 1 ? "var(--accent-red)" : udzial >= 0.8 ? "var(--accent-amber)" : "var(--accent-green)",
                }}
              />
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6 }}>
              Wykorzystano {fmtUsd(stan.wydanoUsd, rate)} z {fmtUsd(kwotaBudzetu, rate)} w miesiącu {stan.miesiac}.
            </div>
          </div>
        )}
      </div>

      {error && <div style={{ fontSize: 11.5, color: "var(--accent-red)", marginTop: 8 }}>{error}</div>}
    </section>
  );
}

/**
 * 036: propozycje kolejnych pytań pod odpowiedzią asystenta. Model dopisuje je do KAŻDEJ odpowiedzi,
 * więc kosztują tokeny przy każdej wiadomości — stąd przełącznik obok cennika, czyli tam, gdzie
 * patrzy się na koszty.
 */
function FollowupsSection({ enabled }: { enabled: boolean }) {
  const t = useTranslations("components.admin.LlmConfigPanel");
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  function toggle(next: boolean) {
    setValue(next);
    setError(null);
    startTransition(async () => {
      try {
        await setFollowupsEnabled(next);
      } catch (e) {
        setValue(!next);
        setError(e instanceof Error ? e.message : "Nie udało się zapisać ustawienia.");
      }
    });
  }

  return (
    <section style={{ marginBottom: 32 }}>
      <SectionTitle>{t("propozycjeKolejnychPytan")}</SectionTitle>
      <label
        className="py-3"
        style={{
          display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer",
          padding: "12px", border: "1px solid var(--border)", borderRadius: 8,
          background: "var(--bg-surface)",
        }}
      >
        <input
          type="checkbox"
          checked={value}
          disabled={isPending}
          onChange={(e) => toggle(e.target.checked)}
          style={{ width: 20, height: 20, flexShrink: 0, accentColor: "var(--accent-blue)", cursor: "pointer" }}
        />
        <span style={{ minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 13, color: "var(--text-primary)" }}>
            {t("podpowiadajKolejnePytaniaPod")}
          </span>
          <span style={{ display: "block", fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.5, marginTop: 2 }}>
            {t("asystentDopisuje23")} <strong>{t("kazdej")}</strong> {t("odpowiedziAKazdaZ")}
          </span>
        </span>
      </label>
      {error && <p style={{ fontSize: 12, color: "var(--accent-red)", marginTop: 8 }}>{error}</p>}
    </section>
  );
}

/**
 * 037: widoczność licznika kosztu przy treściach generowanych przez AI — w asystencie i we
 * wszystkich modułach. Przełącznik siedzi obok follow-upów, czyli tam, gdzie patrzy się na koszty.
 */
function CostBadgeSection({ enabled }: { enabled: boolean }) {
  const t = useTranslations("components.admin.LlmConfigPanel");
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  function toggle(next: boolean) {
    setValue(next);
    setError(null);
    startTransition(async () => {
      try {
        await setCostBadgeEnabled(next);
      } catch (e) {
        setValue(!next);
        setError(e instanceof Error ? e.message : "Nie udało się zapisać ustawienia.");
      }
    });
  }

  return (
    <section style={{ marginBottom: 32 }}>
      <SectionTitle>{t("licznikKosztuPrzyTresciach")}</SectionTitle>
      <label
        className="py-3"
        style={{
          display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer",
          padding: "12px", border: "1px solid var(--border)", borderRadius: 8,
          background: "var(--bg-surface)",
        }}
      >
        <input
          type="checkbox"
          checked={value}
          disabled={isPending}
          onChange={(e) => toggle(e.target.checked)}
          style={{ width: 20, height: 20, flexShrink: 0, accentColor: "var(--accent-blue)", cursor: "pointer" }}
        />
        <span style={{ minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 13, color: "var(--text-primary)" }}>
            {t("pokazujKosztPrzyTresciach")}
          </span>
          <span style={{ display: "block", fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.5, marginTop: 2 }}>
            {t("tenSamWskaznikCo")} <strong>{t("wylacznieAdministrator")}</strong>{t("wylaczenieGasiWskaznikW")}
          </span>
        </span>
      </label>
      {error && <p style={{ fontSize: 12, color: "var(--accent-red)", marginTop: 8 }}>{error}</p>}
    </section>
  );
}

/**
 * 041: systemowe domyślne trybów odświeżania sekcji AI.
 *
 * Dotyczy WYŁĄCZNIE użytkowników bez własnego wyboru — czyjś świadomy wybór w module zostaje
 * nietknięty (preferencja mieszka w `AiSectionPref`, domyślne w `Config`, to dwa rozłączne zapisy).
 * Sekcja stoi obok pozostałych przełączników AI, bo odpowiada na to samo pytanie: ile model robi
 * sam z siebie i ile to kosztuje.
 */
function SectionModesSection({ modes }: { modes: Record<string, AiSectionMode> }) {
  const t = useTranslations("components.admin.LlmConfigPanel");
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(modes);
  const [error, setError] = useState<string | null>(null);

  function change(kind: string, mode: AiSectionMode) {
    const next = { ...value, [kind]: mode };
    setValue(next);
    setError(null);
    startTransition(async () => {
      try {
        await setDefaultSectionModes(next);
      } catch (e) {
        setValue(value);
        setError(e instanceof Error ? e.message : "Nie udało się zapisać ustawienia.");
      }
    });
  }

  return (
    <section style={{ marginBottom: 32 }}>
      <SectionTitle>{t("domyslneOdswiezanieSekcjiAi")}</SectionTitle>
      <p style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.5, margin: "0 0 10px" }}>
        {t("dotyczyUzytkownikowKtorzy")} <strong>nie wybrali</strong> {t("wlasnegoTrybuWModule")}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {AI_SECTION_KINDS.map((kind) => (
          <div
            key={kind}
            style={{
              display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between",
              gap: 8, padding: 12, border: "1px solid var(--border)", borderRadius: 8,
              background: "var(--bg-surface)",
            }}
          >
            <span style={{ minWidth: 0, fontSize: 13, color: "var(--text-primary)" }}>
              {AI_SECTION_LABELS[kind]}
            </span>
            <select
              value={value[kind] ?? "onDemand"}
              disabled={isPending}
              onChange={(e) => change(kind, e.target.value as AiSectionMode)}
              className="py-3"
              style={{
                fontSize: 12.5, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)",
                background: "var(--bg-elevated)", color: "var(--text-primary)", outline: "none",
              }}
            >
              {(Object.keys(AI_SECTION_MODE_LABELS) as AiSectionMode[]).map((m) => (
                <option key={m} value={m}>
                  {AI_SECTION_MODE_LABELS[m].label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      {error && <p style={{ fontSize: 12, color: "var(--accent-red)", marginTop: 8 }}>{error}</p>}
    </section>
  );
}

/**
 * 034: cennik modeli. Wcześniej stawki były zaszyte w kodzie — model spoza listy „kosztował 0",
 * a aktualizacja ceny wymagała wdrożenia. Dopasowanie idzie po POCZĄTKU nazwy modelu, bo
 * identyfikatory bywają z sufiksami wersji („claude-haiku-4-5-20251001").
 */
function ModelPricesSection({ prices }: { prices: ModelPriceDTO[] }) {
  const t = useTranslations("components.admin.LlmConfigPanel");
  const [isPending, startTransition] = useTransition();
  const [prefix, setPrefix] = useState("");
  const [label, setLabel] = useState("");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);

  function add() {
    setError(null);
    startTransition(async () => {
      try {
        await setModelPrice({
          modelPrefix: prefix,
          label: label || null,
          inputPer1M: Number(input.replace(",", ".")),
          outputPer1M: Number(output.replace(",", ".")),
        });
        setPrefix(""); setLabel(""); setInput(""); setOutput("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Nie udało się zapisać cennika.");
      }
    });
  }

  return (
    <section style={{ marginBottom: 32 }}>
      <SectionTitle>Cennik modeli</SectionTitle>
      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 12px", lineHeight: 1.5 }}>
        {t("stawkiWDolarachZa")} <strong>nieznany</strong> {t("nieZerowyWysilekModelu")}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
        {prices.map((p) => (
          <div
            key={p.id}
            style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", minWidth: 0,
              border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-surface)",
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis" }}>
                {p.label || p.modelPrefix}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {p.modelPrefix}… · wejście ${p.inputPer1M} / wyjście ${p.outputPer1M} za 1M tok.
              </div>
            </div>
            <button
              onClick={() => startTransition(async () => { await deleteModelPrice(p.id); })}
              title={t("usunStawke")}
              aria-label={`Usuń stawkę ${p.modelPrefix}`}
              style={{ flexShrink: 0, background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex" }}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
        {prices.length === 0 && (
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
            {t("cennikJestPustyKoszty")}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4" style={{ gap: 8, alignItems: "end" }}>
        <div>
          <label style={labelStyle}>{t("poczatekNazwyModelu")}</label>
          <input style={inputStyle} value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="claude-haiku-4-5" />
        </div>
        <div>
          <label style={labelStyle}>{t("nazwaWlasnaOpcjonalnie")}</label>
          <input style={inputStyle} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Claude Haiku 4.5" />
        </div>
        <div>
          <label style={labelStyle}>{t("wejscieUsd1m")}</label>
          <input style={inputStyle} value={input} onChange={(e) => setInput(e.target.value)} placeholder="1.0" inputMode="decimal" />
        </div>
        <div>
          <label style={labelStyle}>{t("wyjscieUsd1m")}</label>
          <input style={inputStyle} value={output} onChange={(e) => setOutput(e.target.value)} placeholder="5.0" inputMode="decimal" />
        </div>
      </div>
      <button
        onClick={add}
        disabled={isPending || !prefix.trim() || !input.trim() || !output.trim()}
        className="flex items-center gap-1 px-3 py-2 rounded text-sm font-medium disabled:opacity-40"
        style={{ background: "var(--accent-blue)", color: "var(--on-accent)", marginTop: 10 }}
      >
        <Plus size={14} /> {t("zapiszStawke")}
      </button>
      {error && <p style={{ fontSize: 12, color: "var(--accent-red)", marginTop: 8 }}>{error}</p>}
    </section>
  );
}

function CostSection({ cost, threshold, usdPlnRate }: { cost: AiCostBreakdown; threshold: number; usdPlnRate: number }) {
  const t = useTranslations("components.admin.LlmConfigPanel");
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(String(threshold || ""));
  const [saved, setSaved] = useState(false);
  // 029: przelicznik USD→PLN — lokalny stan pola + zapis.
  const [rateValue, setRateValue] = useState(String(usdPlnRate));
  const [rateSaved, setRateSaved] = useState(false);
  const [ratePending, startRateTransition] = useTransition();

  function saveThreshold() {
    startTransition(async () => {
      await setCostAlertThreshold(Number(value) || 0);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  function saveRate() {
    const parsed = Number(rateValue.trim().replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    startRateTransition(async () => {
      await setUsdPlnRate(parsed);
      setRateSaved(true);
      setTimeout(() => setRateSaved(false), 2000);
    });
  }

  return (
    <section style={{ marginBottom: 32 }}>
      <SectionTitle>Zużycie i koszty (ostatnie {cost.days} dni)</SectionTitle>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 12, fontSize: 13, color: "var(--text-secondary)" }}>
        <span>{t("wywolan")} <strong style={{ color: "var(--text-primary)" }}>{cost.totalCalls}</strong></span>
        <span>Koszt (szac.): <strong style={{ color: "var(--text-primary)" }}>{fmtUsd(cost.totalCostUsd, usdPlnRate)}</strong></span>
        <span>{t("dzis")} <strong style={{ color: "var(--text-primary)" }}>{fmtUsd(cost.todayCostUsd, usdPlnRate)}</strong></span>
      </div>

      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: 10,
          background: "var(--bg-surface)",
          overflowX: "auto",
          marginBottom: 16,
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
          <thead>
            <tr>
              <th style={thStyle}>Model</th>
              <th style={thStyle}>Operacja</th>
              <th style={thStyle}>{t("wywolan2")}</th>
              <th style={thStyle}>Tokeny (we/wy)</th>
              <th style={thStyle}>Cache (odczyt)</th>
              <th style={thStyle}>Koszt (szac.)</th>
              <th style={thStyle}>{t("srCzas")}</th>
            </tr>
          </thead>
          <tbody>
            {cost.rows.length === 0 ? (
              <tr>
                <td style={tdStyle} colSpan={7}>{t("brakZarejestrowanychWywolanW")}</td>
              </tr>
            ) : (
              cost.rows.map((r, i) => (
                <tr key={`${r.model}-${r.operationType}-${i}`}>
                  <td style={{ ...tdStyle, color: "var(--text-primary)" }}>{r.model}</td>
                  <td style={tdStyle}>{r.operationType}</td>
                  <td style={tdStyle}>{r.calls}</td>
                  <td style={tdStyle}>{r.promptTokens} / {r.completionTokens}</td>
                  <td style={tdStyle}>{r.cacheReadTokens}</td>
                  <td style={{ ...tdStyle, color: "var(--text-primary)" }}>{fmtUsd(r.costUsd, usdPlnRate)}</td>
                  <td style={tdStyle}>{r.avgLatencyMs} ms</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div
        style={{
          padding: 16,
          border: "1px solid var(--border)",
          borderRadius: 10,
          background: "var(--bg-surface)",
        }}
      >
        <label style={labelStyle}>{t("dziennyProgAlertuKosztowego")}</label>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 10px" }}>
          {t("poPrzekroczeniuSzacowanegoDziennego")}
        </p>
        <div style={{ display: "flex", gap: 8, alignItems: "center", maxWidth: 320 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <DollarSign size={14} style={{ position: "absolute", left: 10, top: 10, color: "var(--text-muted)" }} />
            <input
              style={{ ...inputStyle, paddingLeft: 28 }}
              type="number"
              min={0}
              step="0.5"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0"
            />
          </div>
          <button
            onClick={saveThreshold}
            disabled={isPending}
            className="flex items-center gap-1 px-3 py-2 rounded text-sm font-medium disabled:opacity-40"
            style={{ background: saved ? "var(--accent-green)" : "var(--accent-blue)", color: "var(--on-accent)" }}
          >
            {saved ? <Check size={14} /> : null}
            {saved ? "Zapisano" : "Zapisz"}
          </button>
        </div>
      </div>

      {/* 029: przelicznik USD→PLN — kwoty w USD pokazujemy z równowartością w PLN. */}
      <div
        style={{
          marginTop: 16,
          padding: 16,
          border: "1px solid var(--border)",
          borderRadius: 10,
          background: "var(--bg-surface)",
        }}
      >
        <label style={labelStyle}>Przelicznik USD → PLN</label>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 10px" }}>
          {t("ileZlotychZa1")}
        </p>
        <div style={{ display: "flex", gap: 8, alignItems: "center", maxWidth: 320 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <DollarSign size={14} style={{ position: "absolute", left: 10, top: 10, color: "var(--text-muted)" }} />
            <input
              style={{ ...inputStyle, paddingLeft: 28 }}
              type="number"
              min={0}
              step="0.01"
              value={rateValue}
              onChange={(e) => setRateValue(e.target.value)}
              placeholder="3.81"
            />
          </div>
          <button
            onClick={saveRate}
            disabled={ratePending}
            className="flex items-center gap-1 px-3 py-2 rounded text-sm font-medium disabled:opacity-40"
            style={{ background: rateSaved ? "var(--accent-green)" : "var(--accent-blue)", color: "var(--on-accent)" }}
          >
            {rateSaved ? <Check size={14} /> : null}
            {rateSaved ? "Zapisano" : "Zapisz"}
          </button>
        </div>
      </div>
    </section>
  );
}

export function LlmConfigPanel({
  providers,
  assignmentsByLevel,
  cost,
  costThreshold,
  usdPlnRate,
  speech,
  prices,
  followupsEnabled,
  costBadgeEnabled,
  sectionModes,
  budzet,
}: {
  providers: ProviderDTO[];
  assignmentsByLevel: Record<ConfigLevel, AssignmentDTO[]>;
  cost: AiCostBreakdown;
  costThreshold: number;
  usdPlnRate: number;
  speech: SpeechConfigDTO;
  prices: ModelPriceDTO[];
  followupsEnabled: boolean;
  costBadgeEnabled: boolean;
  sectionModes: Record<string, AiSectionMode>;
  budzet: StanBudzetuDTO;
}) {
  const t = useTranslations("components.admin.LlmConfigPanel");
  // 034: poziom pracy asystenta wybierany zakładką nad siatką typów operacji. Wcześniej admin
  // konfigurował wyłącznie poziom standardowy, a dwa pozostałe były regułami zaszytymi w kodzie.
  const [level, setLevel] = useState<ConfigLevel>("standard");
  const assignments = assignmentsByLevel[level] ?? [];

  return (
    <div>
      <AnthropicProfileCard />

      <ProviderEditor providers={providers} />

      <section style={{ marginBottom: 32 }}>
        <SectionTitle>{t("przypisanieModeliDoTypow")}</SectionTitle>

        {/* Zakładki poziomów. Na telefonie zawijają się w kolejny wiersz (C-31). */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {CONFIG_LEVELS.map((lvl) => (
            <button
              key={lvl}
              onClick={() => setLevel(lvl)}
              aria-pressed={level === lvl}
              style={{
                fontSize: 12.5, padding: "8px 12px", borderRadius: 8, cursor: "pointer",
                border: `1px solid ${level === lvl ? "var(--accent-blue)" : "var(--border)"}`,
                background: level === lvl ? "var(--bg-elevated)" : "transparent",
                color: level === lvl ? "var(--text-primary)" : "var(--text-muted)",
              }}
            >
              {CONFIG_LEVEL_LABELS[lvl]}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 12px", lineHeight: 1.5 }}>
          {CONFIG_LEVEL_DESCRIPTIONS[level]}
          {level !== "standard" && " Pole zostawione puste dziedziczy wartość z poziomu standardowego."}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {assignments.map((a) =>
            // 032: synteza mowy ma własny wiersz — z listami dostawców/modeli/głosów z katalogu,
            // kosztem, wymaganiami i próbką. Reszta typów operacji zostaje bez zmian.
            // 034: lektor nie zależy od poziomu pracy asystenta, więc pokazujemy go tylko raz.
            a.operationType === "speech" ? (
              level === "standard" ? (
                <SpeechAssignmentRow key={a.operationType} label={a.label} description={a.description} config={speech} />
              ) : null
            ) : (
              // Klucz z poziomem = stan wiersza resetuje się przy zmianie zakładki.
              <AssignmentRow key={`${a.operationType}-${level}`} assignment={a} providers={providers} />
            )
          )}
        </div>
      </section>

      <AiBudgetSection stan={budzet} rate={usdPlnRate} />

      <FollowupsSection enabled={followupsEnabled} />

      <CostBadgeSection enabled={costBadgeEnabled} />

      <SectionModesSection modes={sectionModes} />

      <ModelPricesSection prices={prices} />

      <CostSection cost={cost} threshold={costThreshold} usdPlnRate={usdPlnRate} />
    </div>
  );
}
