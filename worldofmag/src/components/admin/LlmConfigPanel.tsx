"use client";

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
  type ProviderDTO,
  type AssignmentDTO,
  type AiCostBreakdown,
  type SpeechConfigDTO,
} from "@/actions/llmConfig";
import { SpeechAssignmentRow } from "@/components/admin/SpeechAssignmentRow";
import { withPln } from "@/lib/usdPln";

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
          <Plus size={14} /> Dodaj dostawcę
        </button>
      )}
    </section>
  );
}

function ProviderRow({ provider }: { provider: ProviderDTO }) {
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
        <button onClick={() => setEditingKey((v) => !v)} className="text-xs px-2 py-1 rounded" style={{ color: "var(--text-secondary)" }}>
          Klucz
        </button>
        <button onClick={remove} disabled={isPending} className="p-1 rounded" style={{ color: "var(--accent-red)" }} title="Usuń">
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
  const [isPending, startTransition] = useTransition();
  const [providerId, setProviderId] = useState(assignment.providerId ?? providers[0]?.id ?? "");
  const [model, setModel] = useState(assignment.model ?? assignment.defaultModel);
  const [saved, setSaved] = useState(false);

  function save() {
    if (!providerId || !model.trim()) return;
    startTransition(async () => {
      await setAssignment({ operationType: assignment.operationType, providerId, model });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
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
            {providers.length === 0 && <option value="">— brak dostawców —</option>}
            {providers.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Model</label>
          <input style={inputStyle} value={model} onChange={(e) => setModel(e.target.value)} placeholder={assignment.defaultModel} />
        </div>
        <button
          onClick={save}
          disabled={isPending || !providerId || !model.trim()}
          className="flex items-center gap-1 px-3 py-2 rounded text-sm font-medium disabled:opacity-40"
          style={{ background: saved ? "var(--accent-green)" : "var(--accent-blue)", color: "var(--on-accent)", height: 35 }}
        >
          {saved ? <Check size={14} /> : null}
          {saved ? "Zapisano" : "Zapisz"}
        </button>
      </div>
    </div>
  );
}

// Jednoklikowy profil rekomendowany: Anthropic Sonnet (rozumowanie/generowanie/
// wizja) + Haiku (klasyfikacja). Groq zostaje jako fallback.
function AnthropicProfileCard() {
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
          <strong>Claude Haiku</strong> do szybkiej klasyfikacji (dispatch). Domyślny dostawca (Groq)
          pozostaje jako zapas — środowisko bez klucza Anthropic działa dalej. Modele możesz potem
          zmienić w tabeli przypisań poniżej.
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

function CostSection({ cost, threshold, usdPlnRate }: { cost: AiCostBreakdown; threshold: number; usdPlnRate: number }) {
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
        <span>Wywołań: <strong style={{ color: "var(--text-primary)" }}>{cost.totalCalls}</strong></span>
        <span>Koszt (szac.): <strong style={{ color: "var(--text-primary)" }}>{fmtUsd(cost.totalCostUsd, usdPlnRate)}</strong></span>
        <span>Dziś: <strong style={{ color: "var(--text-primary)" }}>{fmtUsd(cost.todayCostUsd, usdPlnRate)}</strong></span>
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
              <th style={thStyle}>Wywołań</th>
              <th style={thStyle}>Tokeny (we/wy)</th>
              <th style={thStyle}>Cache (odczyt)</th>
              <th style={thStyle}>Koszt (szac.)</th>
              <th style={thStyle}>Śr. czas</th>
            </tr>
          </thead>
          <tbody>
            {cost.rows.length === 0 ? (
              <tr>
                <td style={tdStyle} colSpan={7}>Brak zarejestrowanych wywołań w tym okresie.</td>
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
        <label style={labelStyle}>Dzienny próg alertu kosztowego (USD, 0 = wyłączony)</label>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 10px" }}>
          Po przekroczeniu szacowanego dziennego kosztu administratorzy dostają powiadomienie (raz na dobę).
          Alert nie blokuje asystenta.
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
          Ile złotych za 1 USD. Wszędzie, gdzie pokazujemy kwotę w USD, doklejamy w nawiasie
          równowartość w PLN wg tego przelicznika (domyślnie 1 USD = 3,81 PLN).
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
  assignments,
  cost,
  costThreshold,
  usdPlnRate,
  speech,
}: {
  providers: ProviderDTO[];
  assignments: AssignmentDTO[];
  cost: AiCostBreakdown;
  costThreshold: number;
  usdPlnRate: number;
  speech: SpeechConfigDTO;
}) {
  return (
    <div>
      <AnthropicProfileCard />

      <ProviderEditor providers={providers} />

      <section style={{ marginBottom: 32 }}>
        <SectionTitle>Przypisanie modeli do typów operacji</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {assignments.map((a) =>
            // 032: synteza mowy ma własny wiersz — z listami dostawców/modeli/głosów z katalogu,
            // kosztem, wymaganiami i próbką. Reszta typów operacji zostaje bez zmian.
            a.operationType === "speech" ? (
              <SpeechAssignmentRow key={a.operationType} label={a.label} description={a.description} config={speech} />
            ) : (
              <AssignmentRow key={a.operationType} assignment={a} providers={providers} />
            )
          )}
        </div>
      </section>

      <CostSection cost={cost} threshold={costThreshold} usdPlnRate={usdPlnRate} />
    </div>
  );
}
