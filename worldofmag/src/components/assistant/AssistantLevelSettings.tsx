"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { RotateCcw } from "lucide-react";
import {
  getAssistantLevelConfig,
  updateUserLlmPref,
  resetUserLlmPrefs,
  type AssistantLevelConfigDTO,
  type AssistantOperationPrefDTO,
} from "@/actions/assistantPrefs";
import { LLM_EFFORT_LABELS, LLM_EFFORT_LEVELS, type LlmEffort } from "@/platform/llm/effort";

/**
 * 034: ustawienia WŁASNEGO poziomu pracy asystenta.
 *
 * 035: komponent jest OSOBNYM widokiem (sekcja `level` w oknie asystenta), otwieranym ikoną przy
 * pozycji „Własny" w menu poziomu — a nie sekcją schowaną w ustawieniach asystenta, gdzie nie dało
 * się go przewinąć. Zniknął też suwak „szybko ↔ dokładnie": mieszał wysiłek wszystkich rodzajów
 * działań naraz i nie niósł żadnej informacji, której nie ma niżej.
 *
 * Limitu odpowiedzi (tokenów) użytkownik NIE ustawia — to parametr kosztowo-techniczny
 * administratora.
 */

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
  const t = useTranslations("components.assistant.AssistantLevelSettings");
  const [config, setConfig] = useState<AssistantLevelConfigDTO | null>(null);
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
    return <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>{t("wczytujeUstawienia")}</p>;
  }

  if (config.choices.length === 0) {
    return (
      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
        {t("administratorNieSkonfigurowalJeszcze")}
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
        {t("ustawModelWysilekI")}
      </p>

      {config.operations.map((op) => {
        const caps = capabilitiesFor(config, op);
        const effort = op.effort ?? op.defaultEffort;
        // 035: pole modelu jest zawsze WYPEŁNIONE — startuje od wartości poziomu standardowego.
        // Wcześniej pierwszą pozycją listy było „Jak u administratora", co dla użytkownika nic nie
        // znaczyło i ukrywało realnie działający model.
        const modelValue = op.key ?? op.defaultKey ?? "";
        return (
          <div
            key={op.operationType}
            style={{ padding: "12px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-surface)", minWidth: 0 }}
          >
            <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{op.label}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8, lineHeight: 1.4 }}>{op.description}</div>

            {modelValue === "" ? (
              <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
                {t("administratorNiePrzypisalModelu")}
              </p>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 8, minWidth: 0 }}>
                  <div style={{ minWidth: 0 }}>
                    <label style={labelStyle}>Model</label>
                    <select
                      style={inputStyle}
                      value={modelValue}
                      onChange={(e) => save(op, { key: e.target.value })}
                    >
                      {config.choices.map((c) => (
                        <option key={c.key} value={c.key}>{c.model} — {c.providerLabel}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ minWidth: 0, opacity: caps.effort ? 1 : 0.55 }}>
                    <label style={labelStyle}>{t("wysilek")}</label>
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

                  <div style={{ minWidth: 0, opacity: caps.temperature ? 1 : 0.55 }}>
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
              </>
            )}
          </div>
        );
      })}

      <button
        onClick={reset}
        disabled={isPending}
        className="py-3"
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
          fontSize: 12.5, padding: "0 12px", minHeight: 44, borderRadius: 8,
          border: "1px solid var(--border)", background: "none", color: "var(--text-muted)", cursor: "pointer",
        }}
      >
        <RotateCcw size={13} /> {t("przywrocUstawieniaAdministratora")}
      </button>

      {error && <p style={{ fontSize: 11.5, color: "var(--accent-red)", margin: 0 }}>{error}</p>}
    </div>
  );
}
