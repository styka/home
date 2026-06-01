"use client";

import { useState, useTransition } from "react";
import { Check, Eye, EyeOff } from "lucide-react";
import { setConfigValue } from "@/actions/config";

interface AdminConfigFormProps {
  groqKey: string | null;
  braveKey: string | null;
}

export function AdminConfigForm({ groqKey, braveKey }: AdminConfigFormProps) {
  return (
    <>
      <ApiKeyCard
        sectionTitle="Konfiguracja LLM (Groq)"
        label="Klucz API Groq"
        configKey="groq_api_key"
        initial={groqKey}
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
        sectionTitle="Wyszukiwarka internetowa (Wiadomości)"
        label="Klucz API Brave Search"
        configKey="brave_search_api_key"
        initial={braveKey}
        placeholder="BSA..."
        help={
          <>
            Opcjonalny. Używany przy budowaniu <strong>bazowej bazy wiedzy</strong> w module
            Wiadomości (gdy z ostatnich 24h nic nie ma — moduł doszukuje informacje w internecie).
            Bez klucza działa darmowy fallback (DuckDuckGo), ale bywa zawodny z serwerowni. Darmowy
            klucz: <span style={{ color: "var(--accent-blue)" }}>brave.com/search/api</span>.
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
  initial,
  placeholder,
  help,
}: {
  sectionTitle: string;
  label: string;
  configKey: string;
  initial: string | null;
  placeholder: string;
  help: React.ReactNode;
}) {
  const [key, setKey] = useState(initial ?? "");
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      await setConfigValue(configKey, key.trim());
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  const maskedDisplay = initial
    ? `${"•".repeat(Math.max(0, initial.length - 4))}${initial.slice(-4)}`
    : "Nie ustawiony";

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

          {initial && !showKey && (
            <div
              className="flex items-center gap-2 mb-3 px-3 py-2 rounded text-xs mono"
              style={{
                backgroundColor: "var(--bg-elevated)",
                color: "var(--text-muted)",
                border: "1px solid var(--border)",
              }}
            >
              <span className="flex-1">{maskedDisplay}</span>
              <button onClick={() => setShowKey(true)} className="focus:outline-none" style={{ color: "var(--text-muted)" }}>
                <Eye size={13} />
              </button>
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
                color: "#fff",
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
