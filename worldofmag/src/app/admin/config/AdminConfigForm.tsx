"use client";

import { useState, useTransition } from "react";
import { Check, Eye, EyeOff } from "lucide-react";
import { setConfigValue } from "@/actions/config";

type MaskedKey = { hasValue: boolean; masked: string };

interface AdminConfigFormProps {
  groqKey: MaskedKey;
  braveKey: MaskedKey;
}

export function AdminConfigForm({ groqKey, braveKey }: AdminConfigFormProps) {
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
            <span style={{ color: "var(--accent-blue)" }}>console.groq.com/keys</span>. Używany do
            rozpoznawania listy zakupów z głosu i tekstu.
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
            <code>web_search</code> <strong>asystenta AI</strong> (gdy potrzebuje informacji spoza
            Twoich danych — ceny, fakty, definicje) oraz moduł <strong>Wiadomości</strong> przy
            budowaniu bazowej bazy wiedzy. Bez klucza działa darmowy fallback DuckDuckGo, ale bywa
            ograniczany dla IP serwerowni (Render), więc wyniki potrafią być puste.
            <br />
            <br />
            <strong>Jak zdobyć darmowy klucz (≈2&nbsp;000 zapytań/mc):</strong>
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
              <li>Załóż konto (Brave Search API) i potwierdź e-mail.</li>
              <li>
                W panelu wybierz plan <strong>„Free”</strong> (Data for Search / Free) — do ~2&nbsp;000
                zapytań miesięcznie, 1&nbsp;zapytanie/s. Brave może poprosić o kartę do weryfikacji,
                ale plan Free pozostaje bezpłatny.
              </li>
              <li>
                Przejdź do <strong>API Keys</strong> → „Add API key”, skopiuj token (zaczyna się od{" "}
                <code>BSA…</code>).
              </li>
              <li>Wklej token poniżej i kliknij „Zapisz”.</li>
            </ol>
          </>
        }
      />
    </>
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
              title="Klucz jest zaszyfrowany — pokazujemy tylko maskę. Wpisz nowy, aby nadpisać."
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
