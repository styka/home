"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sparkles, Loader2, CheckCircle, XCircle, X, ChevronDown, ChevronUp, ArrowRight } from "lucide-react";
import { SmartTextarea } from "@/components/ui/SmartTextarea";
import { ActionDrawer } from "@/components/home/ActionDrawer";
import { markdownToHtml, MARKDOWN_STYLES } from "@/lib/markdown";
import type { AIAction } from "@/app/api/llm/home/interpret/route";
import type { ActionResult } from "@/app/api/llm/home/execute/route";

interface RouteContext {
  context: string[];
  placeholder: string;
  routeHint: string;
  activeListId?: string;
  activeProjectId?: string;
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface LogEntry {
  iter: number;
  step: string;
  thought: string;
  tools?: { tool: string; args: Record<string, unknown> }[];
  results?: unknown;
  question?: string;
  options?: string[];
  actionsCount?: number;
}

interface AgentResponse {
  step?: "clarify" | "answer" | "plan" | "navigate";
  question?: string;
  options?: string[];
  answer?: string;
  actions?: AIAction[];
  url?: string;
  label?: string;
  log?: LogEntry[];
  messages?: ChatMessage[];
  error?: string;
}

type Phase = "idle" | "running" | "clarify" | "answer" | "plan" | "navigate" | "results";

const LIST_SUB_PAGES = ["products", "units", "categories", "icons", "stores"];

function deriveContextFromPath(pathname: string): RouteContext {
  if (pathname.startsWith("/shopping/")) {
    const seg = pathname.split("/")[2] ?? "";
    const isListView = seg && !LIST_SUB_PAGES.includes(seg);
    return {
      context: ["shopping"],
      placeholder: 'Np. "Dodaj mleko i chleb" lub "Co jeszcze muszę kupić?"',
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
    const isVirtualView = seg in viewNames;
    return {
      context: ["tasks"],
      placeholder: 'Np. "Które zadanie jest teraz najważniejsze?" lub "Zakończ zadania o remoncie"',
      routeHint: `Użytkownik jest na ${viewNames[seg] ?? "widoku projektu zadań"}`,
      activeProjectId: !isVirtualView && seg ? seg : undefined,
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
      placeholder: 'Np. "Dodaj notatkę o..." lub "Znajdź notatkę o..."',
      routeHint: "Użytkownik jest w module Notatki",
    };
  }
  if (pathname.startsWith("/pets")) {
    return {
      context: ["pets"],
      placeholder: 'Np. "Zważ Reksia 12 kg" lub "Kiedy odrobaczanie Reksia?"',
      routeHint: "Użytkownik jest w module Zwierzęta",
    };
  }
  return {
    context: ["shopping", "tasks", "notes", "pets"],
    placeholder: 'Zapytaj o cokolwiek lub wydaj polecenie…',
    routeHint: "Użytkownik jest na stronie głównej aplikacji",
  };
}

function ReasoningLog({ log }: { log: LogEntry[] }) {
  const [expanded, setExpanded] = useState(false);
  if (!log.length) return null;
  return (
    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
      {/* Uproszczony log — myśli agenta */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {log.filter((l) => l.thought).map((l, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
            <Sparkles size={11} style={{ color: "var(--text-muted)", flexShrink: 0, marginTop: 3 }} />
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{l.thought}</span>
          </div>
        ))}
      </div>
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8, fontSize: 11, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
      >
        {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        {expanded ? "Ukryj pełny log rozumowania" : "Pokaż pełny log rozumowania"}
      </button>
      {expanded && (
        <pre
          style={{
            marginTop: 8,
            padding: "10px 12px",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 10.5,
            lineHeight: 1.5,
            color: "var(--text-secondary)",
            overflowX: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            maxHeight: 280,
            overflowY: "auto",
          }}
        >
          {log
            .map((l) => {
              const head = `#${l.iter} [${l.step}] ${l.thought}`;
              if (l.step === "query") {
                return `${head}\n  narzędzia: ${JSON.stringify(l.tools)}\n  wyniki: ${JSON.stringify(l.results)}`;
              }
              if (l.step === "clarify") return `${head}\n  pytanie: ${l.question}`;
              if (l.step === "plan") return `${head}\n  akcje: ${l.actionsCount}`;
              return head;
            })
            .join("\n\n")}
        </pre>
      )}
    </div>
  );
}

export function AICommandSheet() {
  const pathname = usePathname();
  const router = useRouter();
  const { context, placeholder, routeHint, activeListId, activeProjectId } = deriveContextFromPath(pathname);

  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [log, setLog] = useState<LogEntry[]>([]);
  const [answer, setAnswer] = useState<string | null>(null);
  const [clarify, setClarify] = useState<{ question: string; options?: string[] } | null>(null);
  const [clarifyInput, setClarifyInput] = useState("");
  const [runMessages, setRunMessages] = useState<ChatMessage[] | null>(null);
  const [pendingActions, setPendingActions] = useState<AIAction[] | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [results, setResults] = useState<ActionResult[] | null>(null);
  const [navTarget, setNavTarget] = useState<{ url: string; label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function resetRun() {
    setPhase("idle");
    setLog([]);
    setAnswer(null);
    setClarify(null);
    setClarifyInput("");
    setRunMessages(null);
    setPendingActions(null);
    setResults(null);
    setNavTarget(null);
    setError(null);
  }

  function goTo(url: string) {
    handleClose();
    router.push(url);
  }

  function handleClose() {
    setIsOpen(false);
    setInputText("");
    resetRun();
  }

  function applyResponse(data: AgentResponse) {
    if (data.log) setLog(data.log);
    if (data.error) {
      setError(data.error);
      setPhase("idle");
      return;
    }
    if (data.step === "clarify") {
      setClarify({ question: data.question ?? "Doprecyzuj polecenie.", options: data.options });
      setRunMessages(data.messages ?? null);
      setClarifyInput("");
      setPhase("clarify");
      return;
    }
    if (data.step === "answer") {
      setAnswer(data.answer ?? "");
      setPhase("answer");
      return;
    }
    if (data.step === "navigate" && data.url) {
      setNavTarget({ url: data.url, label: data.label ?? "Otwórz widok" });
      setPhase("navigate");
      return;
    }
    if (data.step === "plan") {
      setPendingActions(data.actions ?? []);
      setPhase("plan");
      return;
    }
    setError("Nieoczekiwana odpowiedź asystenta.");
    setPhase("idle");
  }

  async function runAgent(payload: Record<string, unknown>) {
    setError(null);
    setPhase("running");
    try {
      const res = await fetch("/api/llm/home/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as AgentResponse;
      if (!res.ok && !data.step) {
        setError(data.error ?? "Błąd asystenta");
        setPhase("idle");
        return;
      }
      applyResponse(data);
    } catch {
      setError("Nie udało się połączyć z asystentem");
      setPhase("idle");
    }
  }

  function handleSend() {
    const text = inputText.trim();
    if (!text) return;
    void runAgent({
      text,
      context,
      routeHint,
      activeListId,
      currentProjectId: activeProjectId,
      today: new Date().toISOString(),
    });
  }

  function submitClarify(value: string) {
    const v = value.trim();
    if (!v || !runMessages) return;
    void runAgent({
      messages: runMessages,
      clarifyAnswer: v,
      context,
      routeHint,
      activeListId,
      currentProjectId: activeProjectId,
      today: new Date().toISOString(),
    });
  }

  async function handleExecute(confirmedActions: AIAction[]) {
    setIsExecuting(true);
    try {
      const res = await fetch("/api/llm/home/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actions: confirmedActions, activeListId, currentProjectId: activeProjectId }),
      });
      const data = (await res.json()) as { results?: ActionResult[] };
      setResults(data.results ?? []);
      setPendingActions(null);
      setPhase("results");
      router.refresh();
    } catch {
      setResults([]);
      setPendingActions(null);
      setPhase("results");
    } finally {
      setIsExecuting(false);
    }
  }

  const busy = phase === "running";

  return (
    <>
      <style>{MARKDOWN_STYLES}</style>

      {/* FAB */}
      <button
        onClick={() => setIsOpen(true)}
        title="Asystent AI"
        className="fixed right-5 z-40 bottom-[calc(72px+env(safe-area-inset-bottom))] md:bottom-6"
        style={{
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
                  Asystent AI
                </span>
              </div>
              <button
                onClick={handleClose}
                style={{ padding: 4, background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center" }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* INPUT (idle) */}
              {(phase === "idle" || phase === "running") && (
                <>
                  <SmartTextarea
                    value={inputText}
                    onChange={setInputText}
                    placeholder={placeholder}
                    rows={4}
                    onSubmit={handleSend}
                    disabled={busy}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!inputText.trim() || busy}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      padding: "10px 0", borderRadius: 10, border: "none",
                      background: !inputText.trim() || busy ? "var(--bg-elevated)" : "var(--accent-blue)",
                      color: !inputText.trim() || busy ? "var(--text-muted)" : "#fff",
                      fontSize: 14, fontWeight: 600, cursor: !inputText.trim() || busy ? "not-allowed" : "pointer",
                    }}
                  >
                    {busy ? (<><Loader2 size={15} className="animate-spin" /> Myślę…</>) : (<><Sparkles size={15} /> Wyślij</>)}
                  </button>
                </>
              )}

              {/* CLARIFY */}
              {phase === "clarify" && clarify && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <p style={{ fontSize: 14, color: "var(--text-primary)", margin: 0, fontWeight: 500 }}>{clarify.question}</p>
                  {clarify.options && clarify.options.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {clarify.options.map((opt) => (
                        <button
                          key={opt}
                          onClick={() => submitClarify(opt)}
                          style={{
                            fontSize: 13, padding: "7px 14px", borderRadius: 8,
                            border: "1px solid var(--border)", background: "var(--bg-elevated)",
                            color: "var(--text-primary)", cursor: "pointer",
                          }}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                  <SmartTextarea
                    value={clarifyInput}
                    onChange={setClarifyInput}
                    placeholder="Twoja odpowiedź…"
                    rows={2}
                    onSubmit={() => submitClarify(clarifyInput)}
                  />
                  <button
                    onClick={() => submitClarify(clarifyInput)}
                    disabled={!clarifyInput.trim()}
                    style={{
                      width: "100%", padding: "9px 0", borderRadius: 10, border: "none",
                      background: clarifyInput.trim() ? "var(--accent-blue)" : "var(--bg-elevated)",
                      color: clarifyInput.trim() ? "#fff" : "var(--text-muted)",
                      fontSize: 13, fontWeight: 600, cursor: clarifyInput.trim() ? "pointer" : "not-allowed",
                    }}
                  >
                    Odpowiedz
                  </button>
                  <ReasoningLog log={log} />
                </div>
              )}

              {/* ANSWER */}
              {phase === "answer" && answer !== null && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div dangerouslySetInnerHTML={{ __html: markdownToHtml(answer) }} />
                  <ReasoningLog log={log} />
                  <button
                    onClick={handleClose}
                    style={{
                      width: "100%", padding: "9px 0", borderRadius: 8,
                      border: "1px solid var(--border)", background: "transparent",
                      color: "var(--text-secondary)", fontSize: 13, cursor: "pointer",
                    }}
                  >
                    Zamknij
                  </button>
                </div>
              )}

              {/* NAVIGATE — propozycja przekierowania do gotowego widoku */}
              {phase === "navigate" && navTarget && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <p style={{ fontSize: 14, color: "var(--text-primary)", margin: 0 }}>
                    Przejść do: <strong>{navTarget.label}</strong>?
                  </p>
                  <ReasoningLog log={log} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => goTo(navTarget.url)}
                      style={{
                        flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        padding: "10px 0", borderRadius: 10, border: "none",
                        background: "var(--accent-blue)", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer",
                      }}
                    >
                      <ArrowRight size={15} /> Przejdź
                    </button>
                    <button
                      onClick={handleClose}
                      style={{
                        padding: "10px 16px", borderRadius: 10,
                        border: "1px solid var(--border)", background: "transparent",
                        color: "var(--text-secondary)", fontSize: 13, cursor: "pointer",
                      }}
                    >
                      Zostań
                    </button>
                  </div>
                </div>
              )}

              {/* RESULTS */}
              {phase === "results" && results && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div
                    style={{ padding: "14px 16px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-elevated)" }}
                  >
                    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", margin: 0, marginBottom: 8 }}>
                      Wykonano
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
                  </div>
                  {/* Przejście do utworzonych elementów (params.openAfter) */}
                  {results.filter((r) => r.success && r.navigateTo).map((r) => (
                    <button
                      key={`nav-${r.id}`}
                      onClick={() => goTo(r.navigateTo!)}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        padding: "10px 0", borderRadius: 10, border: "none",
                        background: "var(--accent-blue)", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer",
                      }}
                    >
                      <ArrowRight size={15} /> {r.navigateLabel ?? "Przejdź"}
                    </button>
                  ))}
                  <ReasoningLog log={log} />
                  <button
                    onClick={handleClose}
                    style={{
                      width: "100%", padding: "9px 0", borderRadius: 8,
                      border: "1px solid var(--border)", background: "transparent",
                      color: "var(--text-secondary)", fontSize: 13, cursor: "pointer",
                    }}
                  >
                    Zamknij
                  </button>
                </div>
              )}

              {error && (
                <p style={{ fontSize: 12, color: "var(--accent-red)", textAlign: "center", margin: 0 }}>
                  {error}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ActionDrawer (plan) renders above sheet */}
      {phase === "plan" && pendingActions && (
        <ActionDrawer
          actions={pendingActions}
          onConfirm={handleExecute}
          onClose={() => { setPendingActions(null); setPhase("idle"); }}
          isExecuting={isExecuting}
        />
      )}
    </>
  );
}
