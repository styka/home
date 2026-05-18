"use client";

import { useState } from "react";
import { Sparkles, Loader2, CheckCircle, XCircle } from "lucide-react";
import { SmartTextarea } from "@/components/ui/SmartTextarea";
import { ActionDrawer } from "@/components/home/ActionDrawer";
import type { AIAction } from "@/app/api/llm/home/interpret/route";
import type { ActionResult } from "@/app/api/llm/home/execute/route";

interface AICommandSectionProps {
  context: string[];
  placeholder?: string;
  label?: string;
}

export function AICommandSection({ context, placeholder, label }: AICommandSectionProps) {
  const [inputText, setInputText] = useState("");
  const [isInterpreting, setIsInterpreting] = useState(false);
  const [pendingActions, setPendingActions] = useState<AIAction[] | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [results, setResults] = useState<ActionResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleInterpret() {
    const text = inputText.trim();
    if (!text) return;
    setIsInterpreting(true);
    setError(null);
    setResults(null);
    try {
      const res = await fetch("/api/llm/home/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, context, today: new Date().toISOString() }),
      });
      const data = (await res.json()) as { actions?: AIAction[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Błąd interpretacji");
        return;
      }
      if (!data.actions?.length) {
        setError("Nie rozpoznano żadnych akcji. Spróbuj inaczej sformułować polecenie.");
        return;
      }
      setPendingActions(data.actions);
    } catch {
      setError("Nie udało się połączyć z LLM");
    } finally {
      setIsInterpreting(false);
    }
  }

  async function handleExecute(confirmedActions: AIAction[]) {
    setIsExecuting(true);
    try {
      const res = await fetch("/api/llm/home/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actions: confirmedActions }),
      });
      const data = (await res.json()) as { results?: ActionResult[] };
      setResults(data.results ?? []);
      setInputText("");
      setPendingActions(null);
    } catch {
      setResults([]);
    } finally {
      setIsExecuting(false);
    }
  }

  return (
    <div>
      {label && (
        <p
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: 8,
          }}
        >
          {label}
        </p>
      )}

      <SmartTextarea
        value={inputText}
        onChange={setInputText}
        placeholder={placeholder ?? "Wpisz lub powiedz co chcesz zrobić…"}
        rows={3}
        onSubmit={handleInterpret}
      />

      <button
        onClick={handleInterpret}
        disabled={!inputText.trim() || isInterpreting}
        style={{
          marginTop: 10,
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "10px 0",
          borderRadius: 10,
          border: "none",
          background:
            !inputText.trim() || isInterpreting ? "var(--bg-elevated)" : "var(--accent-blue)",
          color: !inputText.trim() || isInterpreting ? "var(--text-muted)" : "#fff",
          fontSize: 14,
          fontWeight: 600,
          cursor: !inputText.trim() || isInterpreting ? "not-allowed" : "pointer",
          transition: "background 0.1s",
        }}
      >
        {isInterpreting ? (
          <>
            <Loader2 size={15} className="animate-spin" />
            Interpretuję…
          </>
        ) : (
          <>
            <Sparkles size={15} />
            Wykonaj z AI
          </>
        )}
      </button>

      {error && (
        <p
          style={{
            fontSize: 12,
            color: "var(--accent-red)",
            marginTop: 8,
            textAlign: "center",
          }}
        >
          {error}
        </p>
      )}

      {results && !pendingActions && (
        <div
          style={{
            marginTop: 12,
            padding: "14px 16px",
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: "var(--bg-surface)",
          }}
        >
          <p
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-secondary)",
              margin: 0,
              marginBottom: 8,
            }}
          >
            Wyniki
          </p>
          {results.map((r) => (
            <div
              key={r.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                marginBottom: 4,
              }}
            >
              <span
                style={{
                  flexShrink: 0,
                  marginTop: 1,
                  color: r.success ? "var(--accent-green)" : "var(--accent-red)",
                }}
              >
                {r.success ? <CheckCircle size={13} /> : <XCircle size={13} />}
              </span>
              <div>
                <p style={{ fontSize: 13, color: "var(--text-primary)", margin: 0 }}>
                  {r.description}
                </p>
                {r.error && (
                  <p style={{ fontSize: 11, color: "var(--accent-red)", margin: 0 }}>
                    {r.error}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {pendingActions && (
        <ActionDrawer
          actions={pendingActions}
          onConfirm={handleExecute}
          onClose={() => {
            setPendingActions(null);
            setResults(null);
          }}
          isExecuting={isExecuting}
        />
      )}
    </div>
  );
}
