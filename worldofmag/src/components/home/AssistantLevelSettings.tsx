"use client";

import { useEffect, useState, useTransition } from "react";
import { ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import {
  getAssistantLevelConfig,
  updateUserLlmPref,
  resetUserLlmPrefs,
  type AssistantLevelConfigDTO,
  type AssistantOperationPrefDTO,
} from "@/actions/assistantPrefs";
import { LLM_EFFORT_LABELS, LLM_EFFORT_LEVELS, type LlmEffort } from "@/lib/llm/effort";

/**
 * 034: ustawienia WŁASNEGO poziomu pracy asystenta.
 *
 * UX wzorowany na tym, jak robią to inne czaty AI: domyślnie widać JEDEN suwak „szybko ↔ dokładnie"
 * (wysiłek modelu dla całego asystenta), a szczegóły per rodzaj działania — model i temperatura —
 * chowają się pod „Ustawienia zaawansowane". Dzięki temu przeciętne użycie to jedno przeciągnięcie
 * suwaka, a pełna kontrola nadal jest o jedno kliknięcie dalej.
 *
 * Limitu odpowiedzi (tokenów) użytkownik NIE ustawia — to parametr kosztowo-techniczny
 * administratora.
 */

const EFFORT_INDEX: Record<LlmEffort, number> = { none: 0, low: 1, medium: 2, high: 3 };

const inputStyle: React.CSSProperties = {
  width: "100%", fontSize: 13, padding: "7px 9px", borderRadius: 8,
  border: "1px solid var(--border)", background: "var(--bg-surface)",
  color: "var(--text-primary)", outline: "none",
};

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 11.5, fontWeight: 600,
  color: "var(--text-secondary)", marginBottom: 4,
};

/** Czy dla wybranego modelu suwak wysiłku/temperatury cokolwiek zmieni (AC-8). */
function capabilitiesFor(config: AssistantLevelConfigDTO, op: AssistantOperationPrefDTO) {
  const key = op.key ?? op.defaultKey;
  const choice = config.choices.find((c) => c.key === key);
  return {
    effort: choice?.supportsEffort ?? false,
    temperature: choice?.supportsTemperature ?? false,
    modelLabel: choice ? `${choice.model} (${choice.providerLabel})` : null,
  };
}

export function AssistantLevelSettings() {
  const [config, setConfig] = useState<AssistantLevelConfigDTO | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getAssistantLevelConfig().then(setConfig).catch(() => setConfig({ choices: [], operations: [] }));
  }, []);

  function save(op: AssistantOperationPrefDTO, patch: Partial<AssistantOperationPrefDTO>) {
    const next = { ...op, ...patch };
    setConfig((c) =>
      c ? { ...c, operations: c.operations.map((o) => (o.operationType === op.operationType ? next : o)) } : c
    );
    setError(null);
    startTransition(async () => {
      try {
        await updateUserLlmPref({
          operationType: next.operationType,
          key: next.key,
          effort: next.effort,
          temperature: next.temperature,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Nie udało się zapisać ustawień.");
      }
    });
  }

  /** Jeden suwak dla całego asystenta — ustawia ten sam wysiłek każdemu rodzajowi działania. */
  function setEffortForAll(effort: LlmEffort) {
    if (!config) return;
    for (const op of config.operations) save(op, { effort });
  }

  function reset() {
    setError(null);
    startTransition(async () => {
      try {
        await resetUserLlmPrefs();
        setConfig(await getAssistantLevelConfig());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Nie udało się przywrócić ustawień.");
      }
    });
  }

  if (!config) {
    return <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>Wczytuję ustawienia…</p>;
  }

  if (config.choices.length === 0) {
    return (
      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
        Administrator nie skonfigurował jeszcze żadnego modelu, więc nie ma z czego wybierać. Poziom
        własny zacznie działać, gdy modele się pojawią.
      </p>
    );
  }

  // Wspólny wysiłek pokazujemy tylko wtedy, gdy wszystkie rodzaje działań mają go takiego samego.
  const efforts = config.operations.map((o) => o.effort ?? o.defaultEffort);
  const sharedEffort = efforts.every((e) => e === efforts[0]) ? efforts[0] : null;
  const anySupportsEffort = config.operations.some((o) => capabilitiesFor(config, o).effort);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <label htmlFor="assistant-effort-slider" style={labelStyle}>
          Jak dokładnie ma pracować asystent
        </label>
        <input
          id="assistant-effort-slider"
          type="range"
          min={0}
          max={3}
          step={1}
          value={sharedEffort ? EFFORT_INDEX[sharedEffort] : 0}
          onChange={(e) => setEffortForAll(LLM_EFFORT_LEVELS[Number(e.target.value)])}
          disabled={!anySupportsEffort}
          style={{ width: "100%", accentColor: "var(--accent-blue)" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "var(--text-muted)" }}>
          <span>Szybko i tanio</span>
          <span>Dokładnie i drożej</span>
        </div>
        <p style={{ fontSize: 11.5, color: "var(--text-secondary)", margin: "6px 0 0" }}>
          {sharedEffort
            ? `Wysiłek modelu: ${LLM_EFFORT_LABELS[sharedEffort]}.`
            : "Wysiłek ustawiony osobno dla różnych rodzajów działań (patrz ustawienia zaawansowane)."}
          {!anySupportsEffort && " Wybrane modele nie obsługują regulacji wysiłku — suwak nic nie zmieni."}
        </p>
      </div>

      <button
        onClick={() => setAdvanced((v) => !v)}
        aria-expanded={advanced}
        style={{
          display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-muted)",
          background: "none", border: "none", cursor: "pointer", padding: 0,
        }}
      >
        {advanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {advanced ? "Ukryj ustawienia zaawansowane" : "Ustawienia zaawansowane (model per rodzaj działania)"}
      </button>

      {advanced && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {config.operations.map((op) => {
            const caps = capabilitiesFor(config, op);
            const effort = op.effort ?? op.defaultEffort;
            return (
              <div
                key={op.operationType}
                style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-surface)" }}
              >
                <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{op.label}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8, lineHeight: 1.4 }}>{op.description}</div>

                <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 8 }}>
                  <div>
                    <label style={labelStyle}>Model</label>
                    <select
                      style={inputStyle}
                      value={op.key ?? ""}
                      onChange={(e) => save(op, { key: e.target.value || null })}
                    >
                      <option value="">Jak u administratora</option>
                      {config.choices.map((c) => (
                        <option key={c.key} value={c.key}>{c.model} — {c.providerLabel}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ opacity: caps.effort ? 1 : 0.55 }}>
                    <label style={labelStyle}>Wysiłek</label>
                    <select
                      style={inputStyle}
                      value={effort}
                      disabled={!caps.effort}
                      onChange={(e) => save(op, { effort: e.target.value as LlmEffort })}
                    >
                      {LLM_EFFORT_LEVELS.map((lvl) => (
                        <option key={lvl} value={lvl}>{LLM_EFFORT_LABELS[lvl]}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ opacity: caps.temperature ? 1 : 0.55 }}>
                    <label style={labelStyle}>Temperatura (0–2)</label>
                    <input
                      style={inputStyle}
                      inputMode="decimal"
                      disabled={!caps.temperature}
                      value={op.temperature === null ? "" : String(op.temperature)}
                      placeholder={op.defaultTemperature === null ? "domyślna" : String(op.defaultTemperature)}
                      onChange={(e) => {
                        const raw = e.target.value.trim().replace(",", ".");
                        save(op, { temperature: raw === "" ? null : Number(raw) });
                      }}
                    />
                  </div>
                </div>

                {(!caps.effort || !caps.temperature) && (
                  <p style={{ fontSize: 10.5, color: "var(--text-muted)", margin: "6px 0 0", lineHeight: 1.4 }}>
                    {!caps.effort && "Ten model nie obsługuje regulacji wysiłku. "}
                    {!caps.temperature && "Ten dostawca ignoruje temperaturę."}
                  </p>
                )}
              </div>
            );
          })}

          <button
            onClick={reset}
            disabled={isPending}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, alignSelf: "flex-start",
              fontSize: 12, padding: "7px 11px", borderRadius: 8, border: "1px solid var(--border)",
              background: "none", color: "var(--text-muted)", cursor: "pointer",
            }}
          >
            <RotateCcw size={13} /> Przywróć ustawienia administratora
          </button>
        </div>
      )}

      {error && <p style={{ fontSize: 11.5, color: "var(--accent-red)", margin: 0 }}>{error}</p>}
    </div>
  );
}
