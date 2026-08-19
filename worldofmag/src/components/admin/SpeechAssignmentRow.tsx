"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { Check, Volume2, KeyRound, Loader2 } from "lucide-react";
import { applySpeechProvider, type SpeechConfigDTO } from "@/actions/llmConfig";

// 032: wiersz przypisania dla typu operacji „Synteza mowy (lektor)". Reszta typów operacji dalej
// używa `AssignmentRow` z ręcznie wpisywanym modelem — tutaj administrator NIE MA znać z pamięci
// dostawców, nazw modeli ani identyfikatorów głosów, więc wszystko jest listą z katalogu
// (`src/lib/tts/catalog.ts`), z informacją o koszcie, wymaganiach i jakości polskiego.

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

/** Krótkie zdanie o odtworzeniu próbki — stan przycisku „Próbka". */
type SampleState = { kind: "idle" } | { kind: "busy" } | { kind: "error"; message: string };

const SAMPLE_TEXT = "Dzień dobry, Wielki Magu. Tak brzmi wybrany głos lektora.";

export function SpeechAssignmentRow({
  label,
  description,
  config,
}: {
  label: string;
  description: string;
  config: SpeechConfigDTO;
}) {
  const t = useTranslations("components.admin.SpeechAssignmentRow");
  const [isPending, startTransition] = useTransition();
  const [catalogId, setCatalogId] = useState(config.currentCatalogId ?? config.catalog[0]?.id ?? "");
  const entry = useMemo(() => config.catalog.find((c) => c.id === catalogId), [config.catalog, catalogId]);

  // Model i głos trzymamy w stanie razem z dostawcą: zmiana dostawcy musi przełączyć OBIE listy,
  // bo model i głos jednego dostawcy nic nie znaczą u innego (AC-7).
  const [model, setModel] = useState(config.currentModel ?? "");
  const [voiceId, setVoiceId] = useState(config.currentVoiceId ?? "");
  const [baseUrl, setBaseUrl] = useState(entry?.baseUrl ?? "");
  const [apiKey, setApiKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sample, setSample] = useState<SampleState>({ kind: "idle" });

  function changeProvider(nextId: string) {
    setCatalogId(nextId);
    const next = config.catalog.find((c) => c.id === nextId);
    setModel(next?.models[0]?.id ?? "");
    setVoiceId(next?.voices[0]?.id ?? "");
    setBaseUrl(next?.baseUrl ?? "");
    setApiKey("");
    setErr(null);
    setSample({ kind: "idle" });
  }

  // Model/głos mogą pochodzić z innego dostawcy (stan początkowy z bazy) — pilnujemy, żeby listy
  // pokazywały wartość należącą do WYBRANEGO dostawcy.
  const effectiveModel = entry?.models.some((m) => m.id === model) ? model : (entry?.models[0]?.id ?? "");
  const effectiveVoice = entry?.voices.some((v) => v.id === voiceId) ? voiceId : (entry?.voices[0]?.id ?? "");

  const needsKey = !!entry?.requiresKey && !entry.hasKey;

  function save() {
    if (!entry || !effectiveModel) return;
    setErr(null);
    startTransition(async () => {
      try {
        await applySpeechProvider({
          catalogId: entry.id,
          model: effectiveModel,
          voiceId: effectiveVoice || null,
          apiKey: apiKey.trim() || undefined,
          baseUrl: baseUrl.trim() || undefined,
        });
        setApiKey("");
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Nie udało się zapisać konfiguracji lektora");
      }
    });
  }

  async function playSample() {
    setSample({ kind: "busy" });
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: SAMPLE_TEXT, voiceId: effectiveVoice || null }),
      });
      if (res.status === 501) {
        setSample({ kind: "error", message: "Lektor nie jest jeszcze skonfigurowany — zapisz wybór dostawcy i klucz." });
        return;
      }
      if (!res.ok) {
        setSample({ kind: "error", message: "Nie udało się odtworzyć próbki. Sprawdź klucz API i wybrany model." });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
      setSample({ kind: "idle" });
    } catch {
      setSample({ kind: "error", message: "Nie udało się odtworzyć próbki." });
    }
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
      <div style={{ fontSize: 14, color: "var(--text-primary)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>{description}</div>

      {/* Jedna kolumna na wąskim ekranie, trzy od `md` — panel admina jest desktopowy, ale nie może
          się rozjeżdżać na telefonie (C-31). */}
      <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 8, marginBottom: 10 }}>
        <div>
          <label style={labelStyle}>Dostawca</label>
          <select style={inputStyle} value={catalogId} onChange={(e) => changeProvider(e.target.value)}>
            {config.catalog.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label} — {c.paid ? "płatny" : "darmowy"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Model / wariant</label>
          <select style={inputStyle} value={effectiveModel} onChange={(e) => setModel(e.target.value)}>
            {entry?.models.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>{t("domyslnyGlos")}</label>
          <select style={inputStyle} value={effectiveVoice} onChange={(e) => setVoiceId(e.target.value)}>
            {entry?.voices.map((v) => (
              <option key={v.id} value={v.id}>{v.label} — {v.description}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Karta informacyjna — po to, żeby administrator nie musiał nic sprawdzać w dokumentacji
          dostawcy: koszt, czy potrzebny klucz, jak radzi sobie z polskim i skąd wziąć klucz. */}
      {entry && (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            background: "var(--bg-base)",
            border: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            gap: 4,
            marginBottom: 10,
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: entry.paid ? "var(--accent-amber)" : "var(--accent-green)",
                border: `1px solid ${entry.paid ? "var(--accent-amber)" : "var(--accent-green)"}`,
                borderRadius: 4,
                padding: "1px 5px",
              }}
            >
              {entry.paid ? "płatny" : "darmowy"}
            </span>
            <span style={{ fontSize: 11, color: entry.hasKey ? "var(--accent-green)" : "var(--text-muted)" }}>
              {entry.hasKey ? "klucz zapisany" : entry.requiresKey ? "wymaga klucza API" : "bez klucza"}
            </span>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>{entry.costHint}</p>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
            <strong>Polski:</strong> {entry.polishHint}
          </p>
          <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>{entry.setupHint}</p>
        </div>
      )}

      {/* Adres bazowy pokazujemy tylko tam, gdzie realnie zależy od wyboru administratora (region
          Azure) — dla pozostałych bierzemy go z katalogu i nie zawracamy nim głowy. */}
      {entry?.kind === "azure_tts" && (
        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>{t("adresBazowyPodmienRegion")}</label>
          <input style={inputStyle} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder={entry.baseUrl} />
        </div>
      )}

      {/* Klucz uzupełniany NA TYM SAMYM ekranie — bez wycieczki do innej sekcji administracyjnej. */}
      {needsKey && (
        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>
            <KeyRound size={11} style={{ display: "inline", verticalAlign: "-1px", marginRight: 4 }} />
            {t("kluczApiBezNiego")}
          </label>
          <input
            style={inputStyle}
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") save(); }}
            placeholder="••••"
          />
        </div>
      )}

      {err && <div style={{ fontSize: 12, color: "var(--accent-red)", marginBottom: 8 }}>{err}</div>}
      {sample.kind === "error" && (
        <div style={{ fontSize: 12, color: "var(--accent-amber)", marginBottom: 8 }}>{sample.message}</div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button
          onClick={save}
          disabled={isPending || !entry || !effectiveModel}
          className="flex items-center gap-1 px-3 py-2 rounded text-sm font-medium disabled:opacity-40"
          style={{ background: saved ? "var(--accent-green)" : "var(--accent-blue)", color: "var(--on-accent)" }}
        >
          {isPending ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : null}
          {saved ? "Zapisano" : "Zapisz lektora"}
        </button>
        <button
          onClick={playSample}
          disabled={sample.kind === "busy"}
          className="flex items-center gap-1 px-3 py-2 rounded text-sm disabled:opacity-40"
          style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}
        >
          {sample.kind === "busy" ? <Loader2 size={14} className="animate-spin" /> : <Volume2 size={14} />}
          Próbka
        </button>
      </div>
    </div>
  );
}
