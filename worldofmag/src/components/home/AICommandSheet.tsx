"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sparkles, Loader2, CheckCircle, XCircle, X } from "lucide-react";
import { SmartTextarea } from "@/components/ui/SmartTextarea";
import { ActionDrawer } from "@/components/home/ActionDrawer";
import type { AIAction } from "@/app/api/llm/home/interpret/route";
import type { ActionResult } from "@/app/api/llm/home/execute/route";

interface RouteContext {
  context: string[];
  placeholder: string;
  routeHint: string;
  activeListId?: string;
}

const LIST_SUB_PAGES = ["products", "units", "categories", "icons", "stores"];

function deriveContextFromPath(pathname: string): RouteContext {
  if (pathname.startsWith("/shopping/")) {
    const seg = pathname.split("/")[2] ?? "";
    const isListView = seg && !LIST_SUB_PAGES.includes(seg);
    return {
      context: ["shopping"],
      placeholder: 'Np. "Dodaj mleko i chleb" lub "Odznacz jabłka jako kupione"',
      routeHint: isListView
        ? "Użytkownik ogląda konkretną listę zakupów"
        : "Użytkownik jest na stronie głównej zakupów",
      activeListId: isListView ? seg : undefined,
    };
  }
  if (pathname === "/shopping") {
    return {
      context: ["shopping"],
      placeholder: 'Np. "Dodaj mleko do zakupów" lub "Stwórz nową listę"',
      routeHint: "Użytkownik jest na stronie głównej modułu Zakupy",
    };
  }
  if (pathname.startsWith("/tasks/")) {
    const seg = pathname.split("/")[2] ?? "";
    const viewNames: Record<string, string> = {
      today: "widok zadań na dziś",
      upcoming: "widok nadchodzących zadań",
      overdue: "widok zaległych zadań",
      all: "widok wszystkich zadań",
    };
    return {
      context: ["tasks"],
      placeholder: 'Np. "Dodaj zadanie na jutro" lub "Przesuń mycie auta o tydzień"',
      routeHint: `Użytkownik jest na ${viewNames[seg] ?? "widoku projektu zadań"}`,
    };
  }
  if (pathname === "/tasks") {
    return {
      context: ["tasks"],
      placeholder: 'Np. "Dodaj zadanie kupić leki na jutro"',
      routeHint: "Użytkownik jest na stronie głównej modułu Zadania",
    };
  }
  if (pathname.startsWith("/notes")) {
    return {
      context: ["notes"],
      placeholder: 'Np. "Dodaj notatkę o..." lub "Dopisz do notatki X..."',
      routeHint: "Użytkownik jest w module Notatki",
    };
  }
  return {
    context: ["shopping", "tasks", "notes"],
    placeholder: 'Np. "Dodaj mleko do zakupów" lub "Stwórz zadanie na jutro"',
    routeHint: "Użytkownik jest na stronie głównej aplikacji",
  };
}

export function AICommandSheet() {
  const pathname = usePathname();
  const router = useRouter();
  const { context, placeholder, routeHint, activeListId } = deriveContextFromPath(pathname);

  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  const [isInterpreting, setIsInterpreting] = useState(false);
  const [pendingActions, setPendingActions] = useState<AIAction[] | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [results, setResults] = useState<ActionResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    setIsOpen(false);
    setInputText("");
    setError(null);
    setResults(null);
    setPendingActions(null);
  }

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
        body: JSON.stringify({ text, context, routeHint, today: new Date().toISOString() }),
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
        body: JSON.stringify({ actions: confirmedActions, activeListId }),
      });
      const data = (await res.json()) as { results?: ActionResult[] };
      setResults(data.results ?? []);
      setInputText("");
      setPendingActions(null);
      router.refresh();
    } catch {
      setResults([]);
    } finally {
      setIsExecuting(false);
    }
  }

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setIsOpen(true)}
        title="Polecenie AI"
        style={{
          position: "fixed",
          bottom: 24,
          right: 20,
          zIndex: 30,
          width: 52,
          height: 52,
          borderRadius: "50%",
          border: "none",
          background: "var(--accent-blue)",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
          cursor: "pointer",
        }}
      >
        <Sparkles size={22} />
      </button>

      {/* Bottom-sheet */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 flex items-end md:items-center md:justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <div
            className="w-full md:max-w-lg md:mx-4"
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "16px 16px 0 0",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Handle bar (mobile) */}
            <div className="md:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--border)" }} />
            </div>

            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-3 flex-shrink-0"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Sparkles size={15} style={{ color: "var(--accent-blue)" }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                  Polecenie AI
                </span>
              </div>
              <button
                onClick={handleClose}
                style={{
                  padding: 4,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <SmartTextarea
                value={inputText}
                onChange={setInputText}
                placeholder={placeholder}
                rows={4}
                onSubmit={handleInterpret}
              />

              <button
                onClick={handleInterpret}
                disabled={!inputText.trim() || isInterpreting}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "10px 0",
                  borderRadius: 10,
                  border: "none",
                  background: !inputText.trim() || isInterpreting ? "var(--bg-elevated)" : "var(--accent-blue)",
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
                    Interpretuj i wykonaj
                  </>
                )}
              </button>

              {error && (
                <p style={{ fontSize: 12, color: "var(--accent-red)", textAlign: "center", margin: 0 }}>
                  {error}
                </p>
              )}

              {results && !pendingActions && (
                <div
                  style={{
                    padding: "14px 16px",
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    background: "var(--bg-elevated)",
                  }}
                >
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", margin: 0, marginBottom: 8 }}>
                    Wyniki
                  </p>
                  {results.map((r) => (
                    <div key={r.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
                      <span style={{ flexShrink: 0, marginTop: 1, color: r.success ? "var(--accent-green)" : "var(--accent-red)" }}>
                        {r.success ? <CheckCircle size={13} /> : <XCircle size={13} />}
                      </span>
                      <div>
                        <p style={{ fontSize: 13, color: "var(--text-primary)", margin: 0 }}>{r.description}</p>
                        {r.error && <p style={{ fontSize: 11, color: "var(--accent-red)", margin: 0 }}>{r.error}</p>}
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={handleClose}
                    style={{
                      marginTop: 12,
                      width: "100%",
                      padding: "8px 0",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: "transparent",
                      color: "var(--text-secondary)",
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    Zamknij
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ActionDrawer renders above sheet (z-50) */}
      {pendingActions && (
        <ActionDrawer
          actions={pendingActions}
          onConfirm={handleExecute}
          onClose={() => { setPendingActions(null); setResults(null); }}
          isExecuting={isExecuting}
        />
      )}
    </>
  );
}
