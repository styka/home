"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Check, Eye, EyeOff } from "lucide-react";
import { setConfigValue } from "@/actions/config";

type MaskedKey = { hasValue: boolean; masked: string };

interface AdminConfigFormProps {
  groqKey: MaskedKey;
  braveKey: MaskedKey;
  /** 031: id projektu-skrzynki zgłoszeń (jawna wartość, nie sekret). */
  feedbackProjectId: string;
}

export function AdminConfigForm({ groqKey, braveKey, feedbackProjectId }: AdminConfigFormProps) {
  const t = useTranslations("app.admin.config.AdminConfigForm");
  return (
    <>
      <ApiKeyCard
        sectionTitle="Konfiguracja LLM (Groq)"
        label="Klucz API Groq"
        configKey="groq_api_key"
        current={groqKey}
        placeholder="gsk_..."
        help={
          <>
            Uzyskaj bezpłatny klucz na{" "}
            <span style={{ color: "var(--accent-blue)" }}>console.groq.com/keys</span>{t("uzywanyDoRozpoznawaniaListy")}
          </>
        }
      />

      <div style={{ height: 24 }} />

      <ApiKeyCard
        sectionTitle="Wyszukiwarka internetowa (Asystent AI + Wiadomości)"
        label="Klucz API Brave Search"
        configKey="brave_search_api_key"
        current={braveKey}
        placeholder="BSA..."
        help={
          <>
            Opcjonalny, ale <strong>zalecany</strong>. Z tego klucza korzysta narzędzie{" "}
            <code>web_search</code> <strong>asystenta AI</strong> {t("gdyPotrzebujeInformacjiSpoza")} <strong>{t("wiadomosci")}</strong> {t("przyBudowaniuBazowejBazy")}
            <br />
            <br />
            <strong>{t("jakZdobycDarmowyKlucz")}</strong>
            <ol style={{ margin: "6px 0 0", paddingLeft: 18, lineHeight: 1.6 }}>
              <li>
                Wejdź na{" "}
                <a
                  href="https://brave.com/search/api/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--accent-blue)" }}
                >
                  brave.com/search/api
                </a>{" "}
                i kliknij „Get started”.
              </li>
              <li>{t("zalozKontoBraveSearch")}</li>
              <li>
                W panelu wybierz plan <strong>„Free”</strong> {t("dataForSearchFree")}
              </li>
              <li>
                {t("przejdzDo")} <strong>API Keys</strong> → „Add API key”, skopiuj token (zaczyna się od{" "}
                <code>BSA…</code>).
              </li>
              <li>{t("wklejTokenPonizejI")}</li>
            </ol>
          </>
        }
      />

      <div style={{ height: 24 }} />

      <PlainValueCard
        sectionTitle="Skrzynka zgłoszeń od użytkowników"
        label={t("projektSkrzynkaIdentyfikatorProjektu")}
        configKey="feedback_project_id"
        current={feedbackProjectId}
        placeholder="np. cmpq1l67f000gyt0vvfnfifob"
        help={
          <>
            Do tego projektu trafiają zgłoszenia błędów i sugestii wysyłane przez{" "}
            <strong>wszystkich</strong> {t("uzytkownikowRobaczekWAsystencie")} <strong>nie zyskuje</strong> {t("prawaDoOdczytuTego")}
            <br />
            <br />
            Identyfikator znajdziesz w adresie projektu: <code>/tasks/&lt;identyfikator&gt;</code>.{" "}
            <strong>Puste pole</strong> {t("zachowanieDomyslneCzyliProjekt")}
          </>
        }
      />
    </>
  );
}

// 031: karta dla wartości JAWNEJ (nie sekretu) — w przeciwieństwie do `ApiKeyCard` pokazuje
// aktualną wartość i pozwala ją wyczyścić (puste = zachowanie domyślne).
function PlainValueCard({
  sectionTitle,
  label,
  configKey,
  current,
  placeholder,
  help,
}: {
  sectionTitle: string;
  label: string;
  configKey: string;
  current: string;
  placeholder: string;
  help: React.ReactNode;
}) {
  const [value, setValue] = useState(current);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      await setConfigValue(configKey, value.trim());
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <section>
      <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 10px" }}>
        {sectionTitle}
      </h2>
      <div style={{ padding: 16, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
          {label}
        </label>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") save(); }}
            placeholder={placeholder}
            className="mono text-sm focus:outline-none"
            style={{
              flex: 1, minWidth: 0, padding: "8px 10px", borderRadius: 6,
              border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--text-primary)",
            }}
          />
          <button
            onClick={save}
            disabled={isPending}
            className="flex items-center gap-2 px-3 py-2 rounded text-sm font-medium focus:outline-none disabled:opacity-40"
            style={{
              backgroundColor: saved ? "var(--accent-green)" : "var(--accent-blue)",
              color: "var(--on-accent)",
              transition: "background-color 0.2s",
            }}
          >
            {saved ? <Check size={14} /> : null}
            {saved ? "Zapisano" : "Zapisz"}
          </button>
        </div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "10px 0 0", lineHeight: 1.6 }}>{help}</p>
      </div>
    </section>
  );
}

function ApiKeyCard({
  sectionTitle,
  label,
  configKey,
  current,
  placeholder,
  help,
}: {
  sectionTitle: string;
  label: string;
  configKey: string;
  current: { hasValue: boolean; masked: string };
  placeholder: string;
  help: React.ReactNode;
}) {
  const t = useTranslations("app.admin.config.AdminConfigForm");
  // A2: nie mamy surowego klucza po stronie klienta — pole służy tylko do wpisania NOWEGO.
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedHasValue, setSavedHasValue] = useState(current.hasValue);
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      await setConfigValue(configKey, key.trim());
      setSaved(true);
      setSavedHasValue(!!key.trim());
      setKey("");
      setTimeout(() => setSaved(false), 2000);
    });
  }

  const maskedDisplay = current.hasValue ? current.masked : "Nie ustawiony";

  return (
    <section>
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
        {sectionTitle}
      </h2>

      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "16px" }}>
          <p className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>
            {label}
          </p>
          <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
            {help}
          </p>

          {savedHasValue && (
            <div
              className="flex items-center gap-2 mb-3 px-3 py-2 rounded text-xs mono"
              style={{
                backgroundColor: "var(--bg-elevated)",
                color: "var(--text-muted)",
                border: "1px solid var(--border)",
              }}
              title={t("kluczJestZaszyfrowanyPokazujemy")}
            >
              <span className="flex-1">Ustawiony: {maskedDisplay}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <div
              className="flex-1 flex items-center gap-1"
              style={{
                backgroundColor: "var(--bg-base)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: "6px 10px",
              }}
            >
              <input
                type={showKey ? "text" : "password"}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") save();
                }}
                placeholder={placeholder}
                className="flex-1 bg-transparent mono text-sm focus:outline-none"
                style={{ color: "var(--text-primary)" }}
              />
              <button
                onClick={() => setShowKey((v) => !v)}
                className="focus:outline-none flex-shrink-0"
                style={{ color: "var(--text-muted)" }}
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>

            <button
              onClick={save}
              disabled={isPending}
              className="flex items-center gap-2 px-3 py-2 rounded text-sm font-medium focus:outline-none disabled:opacity-40"
              style={{
                backgroundColor: saved ? "var(--accent-green)" : "var(--accent-blue)",
                color: "var(--on-accent)",
                transition: "background-color 0.2s",
              }}
            >
              {saved ? <Check size={14} /> : null}
              {saved ? "Zapisano" : "Zapisz"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
