"use client";

import { useState, useTransition } from "react";
import { Check, Eye, EyeOff } from "lucide-react";
import { setConfigValue } from "@/actions/config";

interface AdminConfigFormProps {
  groqKey: string | null;
}

export function AdminConfigForm({ groqKey }: AdminConfigFormProps) {
  const [key, setKey] = useState(groqKey ?? "");
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      await setConfigValue("groq_api_key", key.trim());
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  const maskedDisplay = groqKey
    ? `${"•".repeat(Math.max(0, groqKey.length - 4))}${groqKey.slice(-4)}`
    : "Nie ustawiony";

  return (
    <section>
      <h2 style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--text-muted)",
        marginBottom: 12,
      }}>
        Konfiguracja LLM (Groq)
      </h2>

      <div style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        overflow: "hidden",
      }}>
        <div style={{ padding: "16px" }}>
          <p className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>
            Klucz API Groq
          </p>
          <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
            Uzyskaj bezpłatny klucz na{" "}
            <span style={{ color: "var(--accent-blue)" }}>console.groq.com/keys</span>.
            Używany do rozpoznawania listy zakupów z głosu i tekstu.
          </p>

          {groqKey && !showKey && (
            <div
              className="flex items-center gap-2 mb-3 px-3 py-2 rounded text-xs mono"
              style={{ backgroundColor: "var(--bg-elevated)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
            >
              <span className="flex-1">{maskedDisplay}</span>
              <button
                onClick={() => setShowKey(true)}
                className="focus:outline-none"
                style={{ color: "var(--text-muted)" }}
              >
                <Eye size={13} />
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-1" style={{
              backgroundColor: "var(--bg-base)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: "6px 10px",
            }}>
              <input
                type={showKey ? "text" : "password"}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") save(); }}
                placeholder="gsk_..."
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
